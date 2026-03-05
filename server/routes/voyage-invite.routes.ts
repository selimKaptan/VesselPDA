import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { voyageCollaborators, voyages, ports, DEFAULT_PARTICIPANT_PERMISSIONS, VoyageParticipantPermissions } from "../../shared/schema";
import { eq, and, sql, or } from "drizzle-orm";
import { users } from "@shared/models/auth";
import { storage } from "../storage";
import { logVoyageActivity } from "../voyage-activity";
import { emitToUser, emitToVoyage } from "../socket";
import { sendVoyageInviteEmail } from "../email";
import crypto from "crypto";

export const voyageInviteRouter = Router();

const BASE_URL = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5000"}`;

function defaultPerms(role: string): VoyageParticipantPermissions {
  return DEFAULT_PARTICIPANT_PERMISSIONS[role] ?? DEFAULT_PARTICIPANT_PERMISSIONS.observer;
}

async function getVoyage(voyageId: number) {
  const rows = await db.select().from(voyages).where(eq(voyages.id, voyageId)).limit(1);
  return rows[0] ?? null;
}

async function getUser(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

async function canManageVoyage(voyageId: number, userId: string): Promise<boolean> {
  const v = await getVoyage(voyageId);
  if (!v) return false;
  if (v.userId === userId || v.agentUserId === userId) return true;
  const collab = await db.select().from(voyageCollaborators)
    .where(and(
      eq(voyageCollaborators.voyageId, voyageId),
      eq(voyageCollaborators.userId, userId),
      eq(voyageCollaborators.status, "accepted")
    )).limit(1);
  return collab.length > 0 && collab[0].role === "agent";
}

async function canViewVoyage(voyageId: number, userId: string): Promise<boolean> {
  const v = await getVoyage(voyageId);
  if (!v) return false;
  if (v.userId === userId || v.agentUserId === userId) return true;
  const collab = await db.select().from(voyageCollaborators)
    .where(and(
      eq(voyageCollaborators.voyageId, voyageId),
      eq(voyageCollaborators.userId, userId),
      eq(voyageCollaborators.status, "accepted")
    )).limit(1);
  return collab.length > 0;
}

async function getVoyageDisplay(v: any) {
  const vesselName = v.vesselName ?? "Unknown Vessel";
  let portName = "Unknown Port";
  if (v.portId) {
    const portRows = await db.select({ name: ports.name }).from(ports).where(eq(ports.id, v.portId)).limit(1);
    if (portRows[0]) portName = portRows[0].name;
  }
  return { vesselName, portName };
}

// ─── GET /api/voyages/:voyageId/invitations ────────────────────────────────────
voyageInviteRouter.get("/voyages/:voyageId/invitations", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  if (isNaN(voyageId)) return res.status(400).json({ error: "Invalid voyage id" });

  if (!await canViewVoyage(voyageId, userId)) return res.status(403).json({ error: "Access denied" });

  try {
    const collabs = await db
      .select({
        id: voyageCollaborators.id,
        voyageId: voyageCollaborators.voyageId,
        userId: voyageCollaborators.userId,
        inviteeEmail: voyageCollaborators.inviteeEmail,
        inviteeCompanyId: voyageCollaborators.inviteeCompanyId,
        role: voyageCollaborators.role,
        serviceType: voyageCollaborators.serviceType,
        permissions: voyageCollaborators.permissions,
        status: voyageCollaborators.status,
        token: voyageCollaborators.token,
        expiresAt: voyageCollaborators.expiresAt,
        invitedAt: voyageCollaborators.invitedAt,
        respondedAt: voyageCollaborators.respondedAt,
        declineReason: voyageCollaborators.declineReason,
        message: voyageCollaborators.message,
        invitedByUserId: voyageCollaborators.invitedByUserId,
      })
      .from(voyageCollaborators)
      .where(eq(voyageCollaborators.voyageId, voyageId))
      .orderBy(sql`${voyageCollaborators.invitedAt} DESC`);

    const enriched = await Promise.all(collabs.map(async (c) => {
      const [inviter, invitee] = await Promise.all([
        getUser(c.invitedByUserId),
        c.userId ? getUser(c.userId) : Promise.resolve(null),
      ]);
      return {
        ...c,
        inviterFirstName: (inviter as any)?.firstName,
        inviterLastName: (inviter as any)?.lastName,
        inviterProfileImageUrl: (inviter as any)?.profileImageUrl,
        firstName: (invitee as any)?.firstName,
        lastName: (invitee as any)?.lastName,
        email: (invitee as any)?.email,
        profileImageUrl: (invitee as any)?.profileImageUrl,
      };
    }));

    const invitations = enriched.filter((c) => c.status === "pending" || c.status === "cancelled" || c.status === "declined");
    const participants = enriched.filter((c) => c.status === "accepted");

    res.json({ invitations, participants });
  } catch (err) {
    console.error("[voyage-invite] GET invitations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/voyages/:voyageId/invite ───────────────────────────────────────
voyageInviteRouter.post("/voyages/:voyageId/invite", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  if (isNaN(voyageId)) return res.status(400).json({ error: "Invalid voyage id" });

  if (!await canManageVoyage(voyageId, myUserId)) return res.status(403).json({ error: "Only the voyage owner or agent can invite" });

  const { userId, inviteeEmail, inviteeCompanyId, role = "observer", serviceType, message } = req.body;
  if (!userId && !inviteeEmail) return res.status(400).json({ error: "Either userId or inviteeEmail is required" });

  try {
    const voyage = await getVoyage(voyageId);
    if (!voyage) return res.status(404).json({ error: "Voyage not found" });

    if (userId) {
      const existing = await db.select().from(voyageCollaborators)
        .where(and(
          eq(voyageCollaborators.voyageId, voyageId),
          eq(voyageCollaborators.userId, userId),
          or(eq(voyageCollaborators.status, "pending"), eq(voyageCollaborators.status, "accepted"))
        )).limit(1);
      if (existing.length) return res.status(409).json({ error: "This user already has a pending or accepted invitation" });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000);
    const permissions = defaultPerms(role);

    const [collab] = await db.insert(voyageCollaborators).values({
      voyageId,
      userId: userId ?? null,
      invitedByUserId: myUserId,
      inviteeEmail: inviteeEmail ?? null,
      inviteeCompanyId: inviteeCompanyId ?? null,
      role,
      serviceType: serviceType ?? null,
      permissions: permissions as any,
      status: "pending",
      token,
      expiresAt,
      message: message ?? null,
    }).returning();

    const inviter = await getUser(myUserId);
    const inviterName = inviter ? `${(inviter as any).firstName ?? ""} ${(inviter as any).lastName ?? ""}`.trim() || "A voyage manager" : "A voyage manager";
    const { vesselName, portName } = await getVoyageDisplay(voyage);
    const acceptUrl = `${BASE_URL}/voyage-invitations`;

    if (userId) {
      const notif = await storage.createNotification({
        userId,
        type: "nomination_received",
        title: "Voyage Invitation",
        message: `${inviterName} invited you to join voyage ${vesselName} at ${portName} as ${role}`,
        link: "/voyage-invitations",
      });
      if (notif) emitToUser(userId, "new_notification", notif);

      const invitee = await getUser(userId);
      if (invitee && (invitee as any).email) {
        sendVoyageInviteEmail((invitee as any).email, {
          recipientName: `${(invitee as any).firstName ?? ""} ${(invitee as any).lastName ?? ""}`.trim(),
          inviterName,
          vesselName,
          portName,
          role,
          serviceType,
          message,
          eta: voyage.eta ? new Date(voyage.eta).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : undefined,
          acceptUrl,
        }).catch(console.error);
      }
    } else if (inviteeEmail) {
      sendVoyageInviteEmail(inviteeEmail, {
        recipientName: inviteeEmail.split("@")[0],
        inviterName,
        vesselName,
        portName,
        role,
        serviceType,
        message,
        eta: voyage.eta ? new Date(voyage.eta).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : undefined,
        acceptUrl: `${BASE_URL}/voyage-invites/${token}/accept`,
      }).catch(console.error);
    }

    const inviteeName = userId ? (await getUser(userId) as any)?.firstName ?? inviteeEmail ?? "someone" : inviteeEmail ?? "someone";
    logVoyageActivity({
      voyageId,
      userId: myUserId,
      activityType: "nomination_sent",
      title: "Invitation sent",
      description: `Invited ${inviteeName} to join as ${role}`,
    }).catch(console.error);

    res.status(201).json(collab);
  } catch (err) {
    console.error("[voyage-invite] POST invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/voyages/:voyageId/invite-bulk ──────────────────────────────────
voyageInviteRouter.post("/voyages/:voyageId/invite-bulk", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  if (isNaN(voyageId)) return res.status(400).json({ error: "Invalid voyage id" });

  if (!await canManageVoyage(voyageId, myUserId)) return res.status(403).json({ error: "Access denied" });

  const { invitations } = req.body;
  if (!Array.isArray(invitations) || invitations.length === 0) return res.status(400).json({ error: "invitations array required" });
  if (invitations.length > 20) return res.status(400).json({ error: "Maximum 20 invitations per bulk request" });

  const voyage = await getVoyage(voyageId);
  if (!voyage) return res.status(404).json({ error: "Voyage not found" });

  const inviter = await getUser(myUserId);
  const inviterName = inviter ? `${(inviter as any).firstName ?? ""} ${(inviter as any).lastName ?? ""}`.trim() : "A voyage manager";
  const { vesselName, portName } = await getVoyageDisplay(voyage);

  const sent: number[] = [];
  const failed: string[] = [];

  for (const inv of invitations) {
    try {
      if (!inv.email || !inv.email.includes("@")) { failed.push(inv.email ?? "invalid"); continue; }
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 86400 * 1000);
      const [collab] = await db.insert(voyageCollaborators).values({
        voyageId,
        invitedByUserId: myUserId,
        inviteeEmail: inv.email,
        role: inv.role ?? "observer",
        serviceType: inv.serviceType ?? null,
        permissions: defaultPerms(inv.role ?? "observer") as any,
        status: "pending",
        token,
        expiresAt,
      }).returning();
      sent.push(collab.id);
      sendVoyageInviteEmail(inv.email, {
        recipientName: inv.email.split("@")[0],
        inviterName,
        vesselName,
        portName,
        role: inv.role ?? "observer",
        eta: voyage.eta ? new Date(voyage.eta).toLocaleDateString("en-GB") : undefined,
        acceptUrl: `${BASE_URL}/voyage-invites/${token}/accept`,
      }).catch(console.error);
    } catch {
      failed.push(inv.email ?? "unknown");
    }
  }

  res.json({ sent: sent.length, failed });
});

// ─── POST /api/voyages/:voyageId/invitations/:inviteId/accept ─────────────────
voyageInviteRouter.post("/voyages/:voyageId/invitations/:inviteId/accept", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  const inviteId = parseInt(req.params.inviteId as string);
  if (isNaN(voyageId) || isNaN(inviteId)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [collab] = await db.select().from(voyageCollaborators)
      .where(and(eq(voyageCollaborators.id, inviteId), eq(voyageCollaborators.voyageId, voyageId)))
      .limit(1);
    if (!collab) return res.status(404).json({ error: "Invitation not found" });
    if (collab.status !== "pending") return res.status(409).json({ error: "Invitation is no longer pending" });
    if (collab.expiresAt && new Date(collab.expiresAt) < new Date()) return res.status(410).json({ error: "Invitation has expired" });

    const me = await getUser(myUserId);
    const myEmail = (me as any)?.email;
    const isTarget = collab.userId === myUserId || (collab.inviteeEmail && myEmail && collab.inviteeEmail.toLowerCase() === myEmail.toLowerCase());
    if (!isTarget) return res.status(403).json({ error: "You are not the invited party" });

    const updates: any = { status: "accepted", respondedAt: new Date() };
    if (!collab.userId) updates.userId = myUserId;

    const [updated] = await db.update(voyageCollaborators).set(updates).where(eq(voyageCollaborators.id, inviteId)).returning();

    const myName = me ? `${(me as any).firstName ?? ""} ${(me as any).lastName ?? ""}`.trim() || myEmail : myEmail;
    const voyage = await getVoyage(voyageId);
    const { vesselName, portName } = voyage ? await getVoyageDisplay(voyage) : { vesselName: "voyage", portName: "" };

    logVoyageActivity({
      voyageId,
      userId: myUserId,
      activityType: "nomination_sent",
      title: `${myName} joined the voyage`,
      description: `${myName} joined as ${collab.role}`,
    }).catch(console.error);

    const notif = await storage.createNotification({
      userId: collab.invitedByUserId,
      type: "nomination_received",
      title: "Voyage Invitation Accepted",
      message: `${myName} accepted your invitation and joined ${vesselName} as ${collab.role}`,
      link: `/voyages/${voyageId}`,
    });
    if (notif) emitToUser(collab.invitedByUserId, "new_notification", notif);
    emitToVoyage(voyageId, "participant:joined", { userId: myUserId, name: myName, role: collab.role });

    res.json(updated);
  } catch (err) {
    console.error("[voyage-invite] accept error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/voyages/:voyageId/invitations/:inviteId/decline ────────────────
voyageInviteRouter.post("/voyages/:voyageId/invitations/:inviteId/decline", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  const inviteId = parseInt(req.params.inviteId as string);
  if (isNaN(voyageId) || isNaN(inviteId)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [collab] = await db.select().from(voyageCollaborators)
      .where(and(eq(voyageCollaborators.id, inviteId), eq(voyageCollaborators.voyageId, voyageId)))
      .limit(1);
    if (!collab) return res.status(404).json({ error: "Invitation not found" });

    const me = await getUser(myUserId);
    const myEmail = (me as any)?.email;
    const isTarget = collab.userId === myUserId || (collab.inviteeEmail && myEmail && collab.inviteeEmail.toLowerCase() === myEmail.toLowerCase());
    if (!isTarget) return res.status(403).json({ error: "You are not the invited party" });

    const { reason } = req.body;
    const [updated] = await db.update(voyageCollaborators).set({
      status: "declined",
      respondedAt: new Date(),
      declineReason: reason ?? null,
    }).where(eq(voyageCollaborators.id, inviteId)).returning();

    const myName = me ? `${(me as any).firstName ?? ""} ${(me as any).lastName ?? ""}`.trim() || myEmail : myEmail;
    const voyage = await getVoyage(voyageId);
    const { vesselName } = voyage ? await getVoyageDisplay(voyage) : { vesselName: "voyage" };

    const notif = await storage.createNotification({
      userId: collab.invitedByUserId,
      type: "nomination_received",
      title: "Voyage Invitation Declined",
      message: `${myName} declined the invitation for ${vesselName}`,
      link: `/voyages/${voyageId}`,
    });
    if (notif) emitToUser(collab.invitedByUserId, "new_notification", notif);

    logVoyageActivity({
      voyageId,
      userId: myUserId,
      activityType: "nomination_sent",
      title: `${myName} declined`,
      description: reason ? `Declined: ${reason}` : `${myName} declined the invitation`,
    }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error("[voyage-invite] decline error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/voyages/:voyageId/invitations/:inviteId ──────────────────────
voyageInviteRouter.delete("/voyages/:voyageId/invitations/:inviteId", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  const inviteId = parseInt(req.params.inviteId as string);
  if (isNaN(voyageId) || isNaN(inviteId)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [collab] = await db.select().from(voyageCollaborators)
      .where(and(eq(voyageCollaborators.id, inviteId), eq(voyageCollaborators.voyageId, voyageId)))
      .limit(1);
    if (!collab) return res.status(404).json({ error: "Invitation not found" });

    const isInviter = collab.invitedByUserId === myUserId;
    const canManage = await canManageVoyage(voyageId, myUserId);
    if (!isInviter && !canManage) return res.status(403).json({ error: "Insufficient permissions" });

    const [updated] = await db.update(voyageCollaborators).set({ status: "cancelled" }).where(eq(voyageCollaborators.id, inviteId)).returning();
    res.json(updated);
  } catch (err) {
    console.error("[voyage-invite] cancel error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/voyages/:voyageId/invitations/:inviteId/resend ─────────────────
voyageInviteRouter.post("/voyages/:voyageId/invitations/:inviteId/resend", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  const inviteId = parseInt(req.params.inviteId as string);
  if (isNaN(voyageId) || isNaN(inviteId)) return res.status(400).json({ error: "Invalid id" });

  if (!await canManageVoyage(voyageId, myUserId)) return res.status(403).json({ error: "Access denied" });

  try {
    const [collab] = await db.select().from(voyageCollaborators)
      .where(and(eq(voyageCollaborators.id, inviteId), eq(voyageCollaborators.voyageId, voyageId)))
      .limit(1);
    if (!collab) return res.status(404).json({ error: "Invitation not found" });

    const newToken = crypto.randomUUID();
    const newExpiry = new Date(Date.now() + 7 * 86400 * 1000);

    const [updated] = await db.update(voyageCollaborators).set({
      token: newToken,
      expiresAt: newExpiry,
      status: "pending",
    }).where(eq(voyageCollaborators.id, inviteId)).returning();

    const voyage = await getVoyage(voyageId);
    const inviter = await getUser(myUserId);
    const { vesselName, portName } = voyage ? await getVoyageDisplay(voyage) : { vesselName: "voyage", portName: "" };
    const inviterName = inviter ? `${(inviter as any).firstName ?? ""} ${(inviter as any).lastName ?? ""}`.trim() : "A voyage manager";

    const emailTo = collab.inviteeEmail;
    if (emailTo) {
      sendVoyageInviteEmail(emailTo, {
        recipientName: emailTo.split("@")[0],
        inviterName,
        vesselName,
        portName,
        role: collab.role,
        serviceType: collab.serviceType ?? undefined,
        message: collab.message ?? undefined,
        acceptUrl: `${BASE_URL}/voyage-invites/${newToken}/accept`,
      }).catch(console.error);
    } else if (collab.userId) {
      const invitee = await getUser(collab.userId);
      if (invitee && (invitee as any).email) {
        sendVoyageInviteEmail((invitee as any).email, {
          recipientName: `${(invitee as any).firstName ?? ""} ${(invitee as any).lastName ?? ""}`.trim(),
          inviterName,
          vesselName,
          portName,
          role: collab.role,
          serviceType: collab.serviceType ?? undefined,
          message: collab.message ?? undefined,
          acceptUrl: `${BASE_URL}/voyage-invitations`,
        }).catch(console.error);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("[voyage-invite] resend error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/voyages/:voyageId/participants ───────────────────────────────────
voyageInviteRouter.get("/voyages/:voyageId/participants", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  if (isNaN(voyageId)) return res.status(400).json({ error: "Invalid voyage id" });

  try {
    const collabs = await db.select({
      id: voyageCollaborators.id,
      voyageId: voyageCollaborators.voyageId,
      userId: voyageCollaborators.userId,
      role: voyageCollaborators.role,
      serviceType: voyageCollaborators.serviceType,
      permissions: voyageCollaborators.permissions,
      respondedAt: voyageCollaborators.respondedAt,
      invitedAt: voyageCollaborators.invitedAt,
      message: voyageCollaborators.message,
    })
    .from(voyageCollaborators)
    .where(and(
      eq(voyageCollaborators.voyageId, voyageId),
      eq(voyageCollaborators.status, "accepted")
    ))
    .orderBy(voyageCollaborators.respondedAt);

    const enriched = await Promise.all(collabs.map(async (c) => {
      const participant = c.userId ? await getUser(c.userId) : null;
      return {
        ...c,
        firstName: (participant as any)?.firstName,
        lastName: (participant as any)?.lastName,
        email: (participant as any)?.email,
        profileImageUrl: (participant as any)?.profileImageUrl,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("[voyage-invite] GET participants error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /api/voyages/:voyageId/participants/:participantId ──────────────────
voyageInviteRouter.patch("/voyages/:voyageId/participants/:participantId", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  const participantId = parseInt(req.params.participantId as string);
  if (isNaN(voyageId) || isNaN(participantId)) return res.status(400).json({ error: "Invalid id" });

  const voyage = await getVoyage(voyageId);
  if (!voyage || voyage.userId !== myUserId) return res.status(403).json({ error: "Only the voyage owner can update participants" });

  try {
    const { role, permissions } = req.body;
    const updates: any = {};
    if (role !== undefined) {
      updates.role = role;
      updates.permissions = DEFAULT_PARTICIPANT_PERMISSIONS[role] ?? DEFAULT_PARTICIPANT_PERMISSIONS.observer;
    }
    if (permissions !== undefined) updates.permissions = permissions;

    const [updated] = await db.update(voyageCollaborators).set(updates)
      .where(and(eq(voyageCollaborators.id, participantId), eq(voyageCollaborators.voyageId, voyageId)))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error("[voyage-invite] PATCH participant error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/voyages/:voyageId/participants/:participantId ────────────────
voyageInviteRouter.delete("/voyages/:voyageId/participants/:participantId", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const voyageId = parseInt(req.params.voyageId as string);
  const participantId = parseInt(req.params.participantId as string);
  if (isNaN(voyageId) || isNaN(participantId)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [collab] = await db.select().from(voyageCollaborators)
      .where(and(eq(voyageCollaborators.id, participantId), eq(voyageCollaborators.voyageId, voyageId)))
      .limit(1);
    if (!collab) return res.status(404).json({ error: "Participant not found" });

    const voyage = await getVoyage(voyageId);
    const isOwner = voyage?.userId === myUserId;
    const isSelf = collab.userId === myUserId;
    if (!isOwner && !isSelf) return res.status(403).json({ error: "Insufficient permissions" });

    const [updated] = await db.update(voyageCollaborators).set({ status: "cancelled" })
      .where(eq(voyageCollaborators.id, participantId)).returning();

    const me = await getUser(myUserId);
    const myName = me ? `${(me as any).firstName ?? ""} ${(me as any).lastName ?? ""}`.trim() : "Someone";
    const action = isSelf && !isOwner ? `${myName} left the voyage` : `${myName} was removed`;

    logVoyageActivity({
      voyageId,
      userId: myUserId,
      activityType: "status_changed",
      title: action,
      description: `Role was: ${collab.role}`,
    }).catch(console.error);

    if (isOwner && !isSelf && collab.userId) {
      const notif = await storage.createNotification({
        userId: collab.userId,
        type: "nomination_received",
        title: "Removed from Voyage",
        message: `You have been removed from voyage ${voyageId}`,
        link: "/voyages",
      });
      if (notif) emitToUser(collab.userId, "new_notification", notif);
    }

    res.json(updated);
  } catch (err) {
    console.error("[voyage-invite] DELETE participant error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/my-voyage-invitations ──────────────────────────────────────────
voyageInviteRouter.get("/my-voyage-invitations", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const me = await getUser(myUserId);
    const myEmail = (me as any)?.email;

    const collabs = await db.select({
      id: voyageCollaborators.id,
      voyageId: voyageCollaborators.voyageId,
      role: voyageCollaborators.role,
      serviceType: voyageCollaborators.serviceType,
      permissions: voyageCollaborators.permissions,
      status: voyageCollaborators.status,
      invitedAt: voyageCollaborators.invitedAt,
      expiresAt: voyageCollaborators.expiresAt,
      message: voyageCollaborators.message,
      invitedByUserId: voyageCollaborators.invitedByUserId,
    })
    .from(voyageCollaborators)
    .where(and(
      eq(voyageCollaborators.status, "pending"),
      or(
        eq(voyageCollaborators.userId, myUserId),
        myEmail ? eq(voyageCollaborators.inviteeEmail, myEmail) : sql`false`
      ),
      sql`(${voyageCollaborators.expiresAt} IS NULL OR ${voyageCollaborators.expiresAt} > NOW())`
    ))
    .orderBy(sql`${voyageCollaborators.invitedAt} DESC`);

    const enriched = await Promise.all(collabs.map(async (c) => {
      const [voyage, inviter] = await Promise.all([
        getVoyage(c.voyageId),
        getUser(c.invitedByUserId),
      ]);
      let portName = "Unknown Port";
      if (voyage?.portId) {
        const portRows = await db.select({ name: ports.name }).from(ports).where(eq(ports.id, voyage.portId)).limit(1);
        if (portRows[0]) portName = portRows[0].name;
      }
      return {
        ...c,
        vesselName: voyage?.vesselName ?? "Unknown Vessel",
        portName,
        eta: voyage?.eta,
        inviterFirstName: (inviter as any)?.firstName,
        inviterLastName: (inviter as any)?.lastName,
        inviterProfileImageUrl: (inviter as any)?.profileImageUrl,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("[voyage-invite] GET my-invitations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/my-voyage-invitations/count ────────────────────────────────────
voyageInviteRouter.get("/my-voyage-invitations/count", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const me = await getUser(myUserId);
    const myEmail = (me as any)?.email;

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(voyageCollaborators)
      .where(and(
        eq(voyageCollaborators.status, "pending"),
        or(
          eq(voyageCollaborators.userId, myUserId),
          myEmail ? eq(voyageCollaborators.inviteeEmail, myEmail) : sql`false`
        ),
        sql`(${voyageCollaborators.expiresAt} IS NULL OR ${voyageCollaborators.expiresAt} > NOW())`
      ));

    res.json({ count: Number(count) });
  } catch (err) {
    console.error("[voyage-invite] GET count error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/voyage-invites/:token/accept ───────────────────────────────────
voyageInviteRouter.post("/voyage-invites/:token/accept", isAuthenticated, async (req: any, res: any) => {
  const myUserId = req.user?.claims?.sub || req.user?.id;
  if (!myUserId) return res.status(401).json({ error: "Unauthorized" });
  const { token } = req.params;

  try {
    const [collab] = await db.select().from(voyageCollaborators)
      .where(and(
        eq(voyageCollaborators.token, token),
        eq(voyageCollaborators.status, "pending"),
        sql`(${voyageCollaborators.expiresAt} IS NULL OR ${voyageCollaborators.expiresAt} > NOW())`
      )).limit(1);

    if (!collab) return res.status(404).json({ error: "Invitation not found or expired" });

    const [updated] = await db.update(voyageCollaborators).set({
      userId: myUserId,
      status: "accepted",
      respondedAt: new Date(),
    }).where(eq(voyageCollaborators.id, collab.id)).returning();

    const me = await getUser(myUserId);
    const myName = me ? `${(me as any).firstName ?? ""} ${(me as any).lastName ?? ""}`.trim() : myUserId;
    const voyage = await getVoyage(collab.voyageId);
    const { vesselName } = voyage ? await getVoyageDisplay(voyage) : { vesselName: "voyage" };

    logVoyageActivity({
      voyageId: collab.voyageId,
      userId: myUserId,
      activityType: "nomination_sent",
      title: `${myName} joined the voyage`,
      description: `Joined as ${collab.role} via email link`,
    }).catch(console.error);

    const notif = await storage.createNotification({
      userId: collab.invitedByUserId,
      type: "nomination_received",
      title: "Invitation Accepted",
      message: `${myName} accepted your invitation for ${vesselName} as ${collab.role}`,
      link: `/voyages/${collab.voyageId}`,
    });
    if (notif) emitToUser(collab.invitedByUserId, "new_notification", notif);
    emitToVoyage(collab.voyageId, "participant:joined", { userId: myUserId, name: myName, role: collab.role });

    res.json({ voyageId: collab.voyageId, member: updated });
  } catch (err) {
    console.error("[voyage-invite] token accept error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
