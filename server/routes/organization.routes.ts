import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { organizations, organizationMembers, organizationInvites, DEFAULT_ORG_PERMISSIONS, insertOrgSchema, insertOrgInviteSchema } from "../../shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { users } from "@shared/models/auth";
import { sendOrgInviteEmail } from "../email";
import crypto from "crypto";

export const orgRouter = Router();
export const inviteRouter = Router();

function getDefaultPermissions(role: string) {
  return DEFAULT_ORG_PERMISSIONS[role] ?? DEFAULT_ORG_PERMISSIONS.viewer;
}

function maxMembersForPlan(plan: string): number {
  if (plan === "unlimited") return 50;
  if (plan === "standard") return 5;
  return 1;
}

async function getMyMembership(userId: string, orgId: number) {
  const rows = await db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.isActive, true)
    ))
    .limit(1);
  return rows[0] ?? null;
}

function checkRole(member: any, allowed: string[]): boolean {
  return member && allowed.includes(member.role);
}

// ─── GET /api/organizations/my ────────────────────────────────────────────────
orgRouter.get("/my", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const memberships = await db
      .select({
        orgId: organizationMembers.organizationId,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.isActive, true)
      ));

    if (!memberships.length) return res.json([]);

    const orgIds = memberships.map((m) => m.orgId);
    const orgs = await db.select().from(organizations).where(inArray(organizations.id, orgIds));

    const result = await Promise.all(orgs.map(async (org) => {
      const myMem = memberships.find((m) => m.orgId === org.id);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.isActive, true)));
      return {
        ...org,
        myOrgRole: myMem?.role ?? "member",
        memberCount: Number(count),
      };
    }));

    res.json(result);
  } catch (err) {
    console.error("[org] GET /my error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/organizations ──────────────────────────────────────────────────
orgRouter.post("/", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = insertOrgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  try {
    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const maxMembers = maxMembersForPlan((userRow as any)?.subscriptionPlan ?? "free");

    const [org] = await db.insert(organizations).values({
      name: parsed.data.name,
      ownerId: userId,
      type: parsed.data.industry ?? parsed.data.type ?? "other",
      logoUrl: parsed.data.logoUrl ?? null,
      maxMembers,
      isActive: true,
    }).returning();

    const defaultPerms = getDefaultPermissions("owner");

    const [member] = await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      role: "owner",
      permissions: defaultPerms as any,
      isActive: true,
    }).returning();

    res.status(201).json({ organization: org, member });
  } catch (err) {
    console.error("[org] POST / error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/organizations/:id ───────────────────────────────────────────────
orgRouter.get("/:id", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org id" });

  const membership = await getMyMembership(userId, orgId);
  if (!membership) return res.status(403).json({ error: "Not a member" });

  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const members = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        department: organizationMembers.department,
        jobTitle: organizationMembers.jobTitle,
        permissions: organizationMembers.permissions,
        joinedAt: organizationMembers.joinedAt,
        isActive: organizationMembers.isActive,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
        userRole: users.userRole,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId));

    const [{ pendingInvites }] = await db
      .select({ pendingInvites: sql<number>`count(*)` })
      .from(organizationInvites)
      .where(and(
        eq(organizationInvites.organizationId, orgId),
        eq(organizationInvites.status, "pending")
      ));

    res.json({ ...org, members, pendingInviteCount: Number(pendingInvites) });
  } catch (err) {
    console.error("[org] GET /:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /api/organizations/:id ─────────────────────────────────────────────
orgRouter.patch("/:id", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org id" });

  const membership = await getMyMembership(userId, orgId);
  if (!checkRole(membership, ["owner", "admin"])) return res.status(403).json({ error: "Insufficient permissions" });

  try {
    const { name, logoUrl, type, industry } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (type !== undefined) updates.type = type;
    if (industry !== undefined) updates.type = industry;

    const [updated] = await db.update(organizations).set(updates).where(eq(organizations.id, orgId)).returning();
    res.json(updated);
  } catch (err) {
    console.error("[org] PATCH /:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/organizations/:id ────────────────────────────────────────────
orgRouter.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org id" });

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org || org.ownerId !== userId) return res.status(403).json({ error: "Only the owner can delete the organization" });

  try {
    await db.delete(organizations).where(eq(organizations.id, orgId));
    res.json({ success: true });
  } catch (err) {
    console.error("[org] DELETE /:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/organizations/:id/members ───────────────────────────────────────
orgRouter.get("/:id/members", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org id" });

  const membership = await getMyMembership(userId, orgId);
  if (!membership) return res.status(403).json({ error: "Not a member" });

  try {
    const members = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        department: organizationMembers.department,
        jobTitle: organizationMembers.jobTitle,
        permissions: organizationMembers.permissions,
        joinedAt: organizationMembers.joinedAt,
        isActive: organizationMembers.isActive,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
        userRole: users.userRole,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId))
      .orderBy(organizationMembers.joinedAt);

    res.json(members);
  } catch (err) {
    console.error("[org] GET /:id/members error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/organizations/:id/invite ───────────────────────────────────────
orgRouter.post("/:id/invite", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org id" });

  const membership = await getMyMembership(userId, orgId);
  if (!checkRole(membership, ["owner", "admin", "manager"])) return res.status(403).json({ error: "Insufficient permissions" });

  const body = req.body;
  const emailVal = body.email;
  if (!emailVal || !emailVal.includes("@")) return res.status(400).json({ error: "Valid email required" });
  const roleVal = body.orgRole ?? body.role ?? "member";

  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.isActive, true)));

    const [{ pending }] = await db
      .select({ pending: sql<number>`count(*)` })
      .from(organizationInvites)
      .where(and(eq(organizationInvites.organizationId, orgId), eq(organizationInvites.status, "pending")));

    if (Number(total) + Number(pending) >= (org.maxMembers ?? 5)) {
      return res.status(403).json({ error: "Member limit reached. Upgrade your plan." });
    }

    const existingInvite = await db
      .select()
      .from(organizationInvites)
      .where(and(
        eq(organizationInvites.organizationId, orgId),
        eq(organizationInvites.invitedEmail, emailVal),
        eq(organizationInvites.status, "pending")
      ))
      .limit(1);

    if (existingInvite.length) {
      return res.status(409).json({ error: "A pending invitation already exists for this email" });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invite] = await db.insert(organizationInvites).values({
      organizationId: orgId,
      invitedEmail: emailVal,
      role: roleVal,
      invitedByUserId: userId,
      token,
      status: "pending",
      expiresAt,
    }).returning();

    const [inviter] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const inviterName = inviter ? `${(inviter as any).firstName ?? ""} ${(inviter as any).lastName ?? ""}`.trim() : "A team member";
    const baseUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5000"}`;
    const acceptUrl = `${baseUrl}/invite/accept?token=${token}`;

    sendOrgInviteEmail(emailVal, {
      organizationName: org.name,
      inviterName,
      role: roleVal,
      acceptUrl,
    }).catch((err) => console.error("[org] Failed to send invite email:", err));

    res.status(201).json(invite);
  } catch (err) {
    console.error("[org] POST /:id/invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /api/organizations/:id/members/:memberId ───────────────────────────
orgRouter.patch("/:id/members/:memberId", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(orgId) || isNaN(memberId)) return res.status(400).json({ error: "Invalid id" });

  const myMembership = await getMyMembership(userId, orgId);
  if (!checkRole(myMembership, ["owner", "admin"])) return res.status(403).json({ error: "Insufficient permissions" });

  try {
    const [target] = await db.select().from(organizationMembers).where(eq(organizationMembers.id, memberId)).limit(1);
    if (!target || target.organizationId !== orgId) return res.status(404).json({ error: "Member not found" });
    if (target.role === "owner") return res.status(403).json({ error: "Cannot modify the owner" });

    const { orgRole, role, department, jobTitle, title, isActive, permissions } = req.body;
    const updates: any = {};
    const newRole = orgRole ?? role;
    if (newRole !== undefined) {
      updates.role = newRole;
      updates.permissions = getDefaultPermissions(newRole) as any;
    }
    if (department !== undefined) updates.department = department;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle;
    if (title !== undefined) updates.jobTitle = title;
    if (isActive !== undefined) updates.isActive = isActive;
    if (permissions !== undefined) updates.permissions = permissions;

    const [updated] = await db.update(organizationMembers).set(updates).where(eq(organizationMembers.id, memberId)).returning();
    res.json(updated);
  } catch (err) {
    console.error("[org] PATCH /:id/members/:memberId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/organizations/:id/members/:memberId ─────────────────────────
orgRouter.delete("/:id/members/:memberId", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(orgId) || isNaN(memberId)) return res.status(400).json({ error: "Invalid id" });

  const myMembership = await getMyMembership(userId, orgId);

  try {
    const [target] = await db.select().from(organizationMembers).where(eq(organizationMembers.id, memberId)).limit(1);
    if (!target || target.organizationId !== orgId) return res.status(404).json({ error: "Member not found" });
    if (target.role === "owner") return res.status(403).json({ error: "Cannot remove the owner" });

    const isSelf = target.userId === userId;
    const isAdminOrOwner = checkRole(myMembership, ["owner", "admin"]);
    if (!isSelf && !isAdminOrOwner) return res.status(403).json({ error: "Insufficient permissions" });

    await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
    res.json({ success: true });
  } catch (err) {
    console.error("[org] DELETE /:id/members/:memberId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/organizations/:id/members/:memberId/deactivate ─────────────────
orgRouter.post("/:id/members/:memberId/deactivate", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(orgId) || isNaN(memberId)) return res.status(400).json({ error: "Invalid id" });

  const myMembership = await getMyMembership(userId, orgId);
  if (!checkRole(myMembership, ["owner", "admin"])) return res.status(403).json({ error: "Insufficient permissions" });

  try {
    const [updated] = await db
      .update(organizationMembers)
      .set({ isActive: false })
      .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, orgId)))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error("[org] POST deactivate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/organizations/:id/invites ───────────────────────────────────────
orgRouter.get("/:id/invites", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org id" });

  const membership = await getMyMembership(userId, orgId);
  if (!checkRole(membership, ["owner", "admin", "manager"])) return res.status(403).json({ error: "Insufficient permissions" });

  try {
    const invites = await db
      .select({
        id: organizationInvites.id,
        invitedEmail: organizationInvites.invitedEmail,
        role: organizationInvites.role,
        invitedByUserId: organizationInvites.invitedByUserId,
        token: organizationInvites.token,
        status: organizationInvites.status,
        expiresAt: organizationInvites.expiresAt,
        acceptedAt: organizationInvites.acceptedAt,
        createdAt: organizationInvites.createdAt,
        inviterFirstName: users.firstName,
        inviterLastName: users.lastName,
      })
      .from(organizationInvites)
      .leftJoin(users, eq(organizationInvites.invitedByUserId, users.id))
      .where(eq(organizationInvites.organizationId, orgId))
      .orderBy(sql`${organizationInvites.createdAt} DESC`);

    res.json(invites);
  } catch (err) {
    console.error("[org] GET /:id/invites error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/organizations/:id/invites/:inviteId ─────────────────────────
orgRouter.delete("/:id/invites/:inviteId", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  const inviteId = parseInt(req.params.inviteId as string);
  if (isNaN(orgId) || isNaN(inviteId)) return res.status(400).json({ error: "Invalid id" });

  const membership = await getMyMembership(userId, orgId);
  if (!checkRole(membership, ["owner", "admin"])) return res.status(403).json({ error: "Insufficient permissions" });

  try {
    await db.delete(organizationInvites).where(and(
      eq(organizationInvites.id, inviteId),
      eq(organizationInvites.organizationId, orgId)
    ));
    res.json({ success: true });
  } catch (err) {
    console.error("[org] DELETE invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/organizations/:id/invites/:inviteId/resend ─────────────────────
orgRouter.post("/:id/invites/:inviteId/resend", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  const inviteId = parseInt(req.params.inviteId as string);
  if (isNaN(orgId) || isNaN(inviteId)) return res.status(400).json({ error: "Invalid id" });

  const membership = await getMyMembership(userId, orgId);
  if (!checkRole(membership, ["owner", "admin", "manager"])) return res.status(403).json({ error: "Insufficient permissions" });

  try {
    const newToken = crypto.randomUUID();
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(organizationInvites)
      .set({ token: newToken, expiresAt: newExpiry, status: "pending" })
      .where(and(eq(organizationInvites.id, inviteId), eq(organizationInvites.organizationId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Invite not found" });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const [inviter] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const inviterName = inviter ? `${(inviter as any).firstName ?? ""} ${(inviter as any).lastName ?? ""}`.trim() : "A team member";
    const baseUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5000"}`;
    const acceptUrl = `${baseUrl}/invite/accept?token=${newToken}`;

    sendOrgInviteEmail(updated.invitedEmail, {
      organizationName: org?.name ?? "your organization",
      inviterName,
      role: updated.role ?? "member",
      acceptUrl,
    }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error("[org] POST resend error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/organizations/:id/stats ────────────────────────────────────────
orgRouter.get("/:id/stats", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orgId = parseInt(req.params.id as string);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org id" });

  const membership = await getMyMembership(userId, orgId);
  if (!membership) return res.status(403).json({ error: "Not a member" });

  try {
    const [{ memberCount }] = await db
      .select({ memberCount: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.isActive, true)));

    const [{ pendingInvites }] = await db
      .select({ pendingInvites: sql<number>`count(*)` })
      .from(organizationInvites)
      .where(and(eq(organizationInvites.organizationId, orgId), eq(organizationInvites.status, "pending")));

    res.json({
      memberCount: Number(memberCount),
      pendingInvites: Number(pendingInvites),
    });
  } catch (err) {
    console.error("[org] GET stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── INVITE ROUTER: POST /api/invites/:token/accept ───────────────────────────
inviteRouter.post("/:token/accept", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { token } = req.params;

  try {
    const [invite] = await db
      .select()
      .from(organizationInvites)
      .where(and(
        eq(organizationInvites.token, token),
        eq(organizationInvites.status, "pending"),
        sql`${organizationInvites.expiresAt} > NOW()`
      ))
      .limit(1);

    if (!invite) return res.status(404).json({ error: "Invite not found or expired" });

    const existing = await getMyMembership(userId, invite.organizationId);
    if (existing) return res.status(409).json({ error: "Already a member of this organization" });

    const [member] = await db.insert(organizationMembers).values({
      organizationId: invite.organizationId,
      userId,
      role: invite.role ?? "member",
      permissions: getDefaultPermissions(invite.role ?? "member") as any,
      invitedBy: invite.invitedByUserId,
      isActive: true,
    }).returning();

    await db.update(organizationInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(organizationInvites.id, invite.id));

    const [org] = await db.select().from(organizations).where(eq(organizations.id, invite.organizationId)).limit(1);
    res.json({ organization: org, member });
  } catch (err) {
    console.error("[org] POST invite accept error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── INVITE ROUTER: POST /api/invites/:token/decline ─────────────────────────
inviteRouter.post("/:token/decline", isAuthenticated, async (req: any, res: any) => {
  const { token } = req.params;
  try {
    await db.update(organizationInvites)
      .set({ status: "expired" })
      .where(eq(organizationInvites.token, token));
    res.json({ success: true });
  } catch (err) {
    console.error("[org] POST invite decline error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
