import { emitToConversation } from "../socket";
import { parsePaginationParams, paginateArray } from "../utils/pagination";
import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

// ─── VOYAGES ──────────────────────────────────────────────────────────────────

router.get("/voyages", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const role = req.user?.activeRole || req.user?.userRole || "shipowner";
    const { page, limit } = parsePaginationParams(req.query);
    const search = (req.query.search as string || "").toLowerCase();
    const status = req.query.status as string | undefined;
    let voyageList = await storage.getVoyagesByUser(userId, role);
    if (search) {
      voyageList = voyageList.filter((v: any) =>
        v.vesselName?.toLowerCase().includes(search) ||
        v.portName?.toLowerCase().includes(search) ||
        v.status?.toLowerCase().includes(search)
      );
    }
    if (status && status !== "all") {
      voyageList = voyageList.filter((v: any) => v.status === status);
    }
    res.json(paginateArray(voyageList, page, limit));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch voyages" });
  }
});

router.post("/voyages", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const data = { ...req.body, userId };
    if (data.eta) data.eta = new Date(data.eta);
    if (data.etd) data.etd = new Date(data.etd);
    const voyage = await storage.createVoyage(data);
    logAction(userId, "create", "voyage", voyage.id, { portId: voyage.portId, vesselName: voyage.vesselName, status: voyage.status }, getClientIp(req));
    res.json(voyage);
  } catch (error) {
    res.status(500).json({ message: "Failed to create voyage" });
  }
});

router.get("/voyages/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const voyage = await storage.getVoyageById(id);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    res.json(voyage);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch voyage" });
  }
});

router.patch("/voyages/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const id = parseInt(req.params.id);
    const existing = await storage.getVoyageById(id);
    if (!existing) return res.status(404).json({ message: "Voyage not found" });
    if (existing.userId !== userId && existing.agentUserId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { eta, etd, notes, purposeOfCall, vesselName, imoNumber, mmsi, status } = req.body;
    const updateData: any = {};
    if (eta !== undefined) updateData.eta = eta ? new Date(eta) : null;
    if (etd !== undefined) updateData.etd = etd ? new Date(etd) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (purposeOfCall !== undefined) updateData.purposeOfCall = purposeOfCall;
    if (vesselName !== undefined) updateData.vesselName = vesselName;
    if (imoNumber !== undefined) updateData.imoNumber = imoNumber;
    if (mmsi !== undefined) updateData.mmsi = mmsi;
    if (status !== undefined) updateData.status = status;

    const oldEtaStr = existing.eta ? new Date(existing.eta).toISOString().slice(0, 10) : null;
    const newEtaStr = updateData.eta ? new Date(updateData.eta).toISOString().slice(0, 10) : null;
    const etaChanged = oldEtaStr !== newEtaStr;

    const updated = await storage.updateVoyage(id, updateData);

    if (etaChanged && existing.agentUserId && existing.agentUserId !== userId) {
      const oldEtaFmt = existing.eta ? new Date(existing.eta).toLocaleDateString("tr-TR") : "belirtilmemiş";
      const newEtaFmt = updateData.eta ? new Date(updateData.eta).toLocaleDateString("tr-TR") : "iptal edildi";
      await storage.createNotification({
        userId: existing.agentUserId,
        type: "eta_change",
        title: "ETA Güncellendi",
        message: `Sefer #${id} ETA değişti: ${oldEtaFmt} → ${newEtaFmt}`,
        link: `/voyages/${id}`,
      });
    }
    if (etaChanged && existing.userId && existing.userId !== userId) {
      const oldEtaFmt = existing.eta ? new Date(existing.eta).toLocaleDateString("tr-TR") : "belirtilmemiş";
      const newEtaFmt = updateData.eta ? new Date(updateData.eta).toLocaleDateString("tr-TR") : "iptal edildi";
      await storage.createNotification({
        userId: existing.userId,
        type: "eta_change",
        title: "ETA Güncellendi",
        message: `Sefer #${id} ETA değişti: ${oldEtaFmt} → ${newEtaFmt}`,
        link: `/voyages/${id}`,
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("updateVoyage error:", error);
    res.status(500).json({ message: "Failed to update voyage" });
  }
});

router.patch("/voyages/:id/status", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const voyage = await storage.updateVoyageStatus(id, status);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    const uid = req.user?.claims?.sub || req.user?.id;
    logAction(uid, "update", "voyage", id, { newStatus: status }, getClientIp(req));
    res.json(voyage);
  } catch (error) {
    res.status(500).json({ message: "Failed to update voyage status" });
  }
});

router.post("/voyages/:id/checklist", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const item = await storage.createChecklistItem({ ...req.body, voyageId });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to add checklist item" });
  }
});

router.patch("/voyages/:id/checklist/:itemId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const item = await storage.toggleChecklistItem(itemId, voyageId);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle checklist item" });
  }
});

router.delete("/voyages/:id/checklist/:itemId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    await storage.deleteChecklistItem(itemId, voyageId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete checklist item" });
  }
});

// ─── VOYAGE DOCUMENTS ──────────────────────────────────────────────────────

router.get("/voyages/:id/documents", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const docs = await storage.getVoyageDocuments(voyageId);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: "Failed to get documents" });
  }
});

router.post("/voyages/:id/documents", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { name, docType, fileBase64, fileUrl, fileName, fileSize, notes } = req.body;
    if (!name || (!fileBase64 && !fileUrl)) return res.status(400).json({ message: "name and file required" });
    const doc = await storage.createVoyageDocument({
      voyageId,
      name,
      docType: docType || "other",
      fileBase64: fileBase64 || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      notes: notes || null,
      uploadedByUserId: req.user.claims.sub,
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: "Failed to upload document" });
  }
});

router.delete("/voyages/:id/documents/:docId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    const ok = await storage.deleteVoyageDocument(docId, voyageId);
    if (!ok) return res.status(404).json({ message: "Document not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// ─── VOYAGE CHAT ────────────────────────────────────────────────────────────

router.get("/voyages/:id/chat", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const role = req.user?.claims?.role || req.user?.role;
    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    if (role !== "admin" && voyage.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const msgs = await storage.getVoyageChatMessages(voyageId);
    res.json(msgs);
  } catch (error) {
    res.status(500).json({ message: "Failed to get chat messages" });
  }
});

router.post("/voyages/:id/chat", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const role = req.user?.claims?.role || req.user?.role;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "content required" });
    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    if (role !== "admin" && voyage.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const msg = await storage.createVoyageChatMessage({
      voyageId,
      senderId: userId,
      content: content.trim(),
    });
    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ message: "Failed to send message" });
  }
});

// ─── VOYAGE REVIEWS ────────────────────────────────────────────────────────

router.get("/voyages/:id/reviews", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const reviews = await storage.getVoyageReviews(voyageId);
    const userId = req.user?.claims?.sub || req.user?.id;
    const myReview = userId ? await storage.getMyVoyageReview(voyageId, userId) : null;
    res.json({ reviews, myReview: myReview ?? null });
  } catch (error) {
    res.status(500).json({ message: "Failed to get reviews" });
  }
});

router.post("/voyages/:id/reviews", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { revieweeUserId, rating, comment } = req.body;
    if (!revieweeUserId || !rating) return res.status(400).json({ message: "revieweeUserId and rating required" });
    const reviewerUserId = req.user?.claims?.sub || req.user?.id;
    const existing = await storage.getMyVoyageReview(voyageId, reviewerUserId);
    if (existing) return res.status(409).json({ message: "Already reviewed" });
    const review = await storage.createVoyageReview({
      voyageId,
      reviewerUserId,
      revieweeUserId,
      rating: parseInt(rating),
      comment: comment || null,
    });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: "Failed to create review" });
  }
});

// ─── VOYAGE COLLABORATORS ────────────────────────────────────────────────────

async function canAccessVoyage(userId: string, voyageId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT v.user_id, v.agent_user_id, v.organization_id FROM voyages v WHERE v.id = $1`,
    [voyageId]
  );
  if (!rows.length) return false;
  const v = rows[0];
  if (v.user_id === userId || v.agent_user_id === userId) return true;
  // Check org membership
  if (v.organization_id) {
    const { rows: om } = await pool.query(
      "SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true",
      [v.organization_id, userId]
    );
    if (om.length > 0) return true;
  }
  // Check collaborator
  const { rows: col } = await pool.query(
    `SELECT 1 FROM voyage_collaborators vc
     WHERE vc.voyage_id = $1 AND vc.status = 'accepted'
       AND (vc.user_id = $2 OR vc.organization_id IN (
         SELECT organization_id FROM organization_members WHERE user_id = $2 AND is_active = true
       ))`,
    [voyageId, userId]
  );
  return col.length > 0;
}

async function getCollaboratorPerms(userId: string, voyageId: number): Promise<Record<string, boolean> | null> {
  const { rows } = await pool.query(
    `SELECT vc.permissions, v.user_id, v.agent_user_id FROM voyage_collaborators vc
     JOIN voyages v ON v.id = vc.voyage_id
     WHERE vc.voyage_id = $1 AND vc.status = 'accepted'
       AND (vc.user_id = $2 OR vc.organization_id IN (
         SELECT organization_id FROM organization_members WHERE user_id = $2 AND is_active = true
       ))
     LIMIT 1`,
    [voyageId, userId]
  );
  if (!rows.length) return null;
  return rows[0].permissions;
}

// GET /api/voyages/:id/collaborators
router.get("/voyages/:id/collaborators", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    if (!(await canAccessVoyage(userId, voyageId))) return res.status(403).json({ message: "Access denied" });

    const { rows } = await pool.query(
      `SELECT vc.*,
        u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email, u.profile_image_url AS user_avatar,
        inv.first_name AS inviter_first_name, inv.last_name AS inviter_last_name,
        o.name AS org_name, o.logo_url AS org_logo, o.type AS org_type
       FROM voyage_collaborators vc
       LEFT JOIN users u ON u.id = vc.user_id
       LEFT JOIN users inv ON inv.id = vc.invited_by_user_id
       LEFT JOIN organizations o ON o.id = vc.organization_id
       WHERE vc.voyage_id = $1
       ORDER BY vc.invited_at DESC`,
      [voyageId]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET collaborators error:", e);
    res.status(500).json({ message: "Failed to fetch collaborators" });
  }
});

// POST /api/voyages/:id/collaborators
router.post("/voyages/:id/collaborators", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    if (voyage.userId !== userId && voyage.agentUserId !== userId) {
      return res.status(403).json({ message: "Only voyage owner can invite collaborators" });
    }

    const { organizationId, userId: targetUserId, role, permissions, notes } = req.body;
    if (!organizationId && !targetUserId) return res.status(400).json({ message: "organizationId or userId required" });

    const defaultPerms = role === "manager"
      ? { viewVoyage: true, editVoyage: true, viewDocuments: true, uploadDocuments: true, deleteDocuments: true, signDocuments: true, viewProforma: true, editProforma: true, viewInvoice: true, viewChecklist: true, editChecklist: true, viewChat: true, sendChat: true, viewTimeline: true }
      : role === "editor"
      ? { viewVoyage: true, editVoyage: true, viewDocuments: true, uploadDocuments: true, deleteDocuments: false, signDocuments: false, viewProforma: true, editProforma: false, viewInvoice: true, viewChecklist: true, editChecklist: true, viewChat: true, sendChat: true, viewTimeline: true }
      : { viewVoyage: true, editVoyage: false, viewDocuments: true, uploadDocuments: false, deleteDocuments: false, signDocuments: false, viewProforma: true, editProforma: false, viewInvoice: true, viewChecklist: true, editChecklist: false, viewChat: true, sendChat: false, viewTimeline: true };

    const finalPerms = permissions || defaultPerms;

    const { rows } = await pool.query(
      `INSERT INTO voyage_collaborators (voyage_id, organization_id, user_id, invited_by_user_id, role, permissions, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [voyageId, organizationId || null, targetUserId || null, userId, role || "viewer", JSON.stringify(finalPerms), notes || null]
    );
    const collab = rows[0];

    // Notify invited user(s)
    const { rows: inviterRows } = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
    const inviterName = `${inviterRows[0]?.first_name || ""} ${inviterRows[0]?.last_name || ""}`.trim() || "Someone";

    if (targetUserId) {
      await storage.createNotification({
        userId: targetUserId,
        type: "voyage_invite",
        title: "Voyage Collaboration Invite",
        message: `${inviterName} invited you to collaborate on Voyage #${voyageId} (${voyage.vesselName || "vessel"}) as ${role || "viewer"}.`,
        link: `/voyages/${voyageId}`,
      });
    } else if (organizationId) {
      const { rows: orgMembers } = await pool.query(
        "SELECT user_id FROM organization_members WHERE organization_id = $1 AND is_active = true AND user_id != $2",
        [organizationId, userId]
      );
      for (const m of orgMembers) {
        await storage.createNotification({
          userId: m.user_id,
          type: "voyage_invite",
          title: "Voyage Collaboration Invite",
          message: `${inviterName} invited your organization to collaborate on Voyage #${voyageId} (${voyage.vesselName || "vessel"}) as ${role || "viewer"}.`,
          link: `/voyages/${voyageId}`,
        });
      }
    }

    res.status(201).json(collab);
  } catch (e) {
    console.error("POST collaborator error:", e);
    res.status(500).json({ message: "Failed to invite collaborator" });
  }
});

// PATCH /api/voyages/:id/collaborators/:collabId
router.patch("/voyages/:id/collaborators/:collabId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const collabId = parseInt(req.params.collabId);
    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    if (voyage.userId !== userId && voyage.agentUserId !== userId) {
      return res.status(403).json({ message: "Only voyage owner can update collaborators" });
    }

    const { role, permissions } = req.body;
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (role !== undefined) { sets.push(`role = $${i++}`); vals.push(role); }
    if (permissions !== undefined) { sets.push(`permissions = $${i++}`); vals.push(JSON.stringify(permissions)); }
    if (!sets.length) return res.status(400).json({ message: "Nothing to update" });
    vals.push(collabId, voyageId);
    const { rows } = await pool.query(
      `UPDATE voyage_collaborators SET ${sets.join(", ")} WHERE id = $${i} AND voyage_id = $${i + 1} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ message: "Collaborator not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: "Failed to update collaborator" });
  }
});

// DELETE /api/voyages/:id/collaborators/:collabId
router.delete("/voyages/:id/collaborators/:collabId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const collabId = parseInt(req.params.collabId);
    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    if (voyage.userId !== userId && voyage.agentUserId !== userId) {
      return res.status(403).json({ message: "Only voyage owner can remove collaborators" });
    }
    await pool.query("DELETE FROM voyage_collaborators WHERE id = $1 AND voyage_id = $2", [collabId, voyageId]);
    res.json({ message: "Removed" });
  } catch (e) {
    res.status(500).json({ message: "Failed to remove collaborator" });
  }
});

// PATCH /api/voyages/:id/collaborators/:collabId/respond
router.patch("/voyages/:id/collaborators/:collabId/respond", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const collabId = parseInt(req.params.collabId);
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) return res.status(400).json({ message: "status must be accepted or declined" });

    // Check: must be the invited user or member of invited org
    const { rows: existing } = await pool.query(
      "SELECT * FROM voyage_collaborators WHERE id = $1 AND voyage_id = $2",
      [collabId, voyageId]
    );
    if (!existing.length) return res.status(404).json({ message: "Not found" });
    const collab = existing[0];

    let authorized = collab.user_id === userId;
    if (!authorized && collab.organization_id) {
      const { rows: om } = await pool.query(
        "SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true",
        [collab.organization_id, userId]
      );
      authorized = om.length > 0;
    }
    if (!authorized) return res.status(403).json({ message: "Not authorized to respond" });

    const { rows } = await pool.query(
      "UPDATE voyage_collaborators SET status = $1, responded_at = NOW() WHERE id = $2 RETURNING *",
      [status, collabId]
    );

    // Notify voyage owner
    const voyage = await storage.getVoyageById(voyageId);
    if (voyage?.userId) {
      const { rows: ur } = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
      const respName = `${ur[0]?.first_name || ""} ${ur[0]?.last_name || ""}`.trim() || "Someone";
      await storage.createNotification({
        userId: voyage.userId,
        type: "collab_response",
        title: `Collaboration ${status === "accepted" ? "Accepted" : "Declined"}`,
        message: `${respName} ${status === "accepted" ? "accepted" : "declined"} the collaboration invite for Voyage #${voyageId}.`,
        link: `/voyages/${voyageId}`,
      });
    }

    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: "Failed to respond to invite" });
  }
});

// GET /api/voyages/shared
router.get("/voyages/shared", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { rows } = await pool.query(
      `SELECT vc.*, v.vessel_name, v.status AS voyage_status, v.eta, v.port_id,
        v.purpose_of_call, v.user_id AS owner_id, v.created_at AS voyage_created_at,
        u.first_name AS owner_first_name, u.last_name AS owner_last_name,
        o.name AS org_name, o.logo_url AS org_logo
       FROM voyage_collaborators vc
       JOIN voyages v ON v.id = vc.voyage_id
       JOIN users u ON u.id = v.user_id
       LEFT JOIN organizations o ON o.id = vc.organization_id
       WHERE (vc.user_id = $1 OR vc.organization_id IN (
         SELECT organization_id FROM organization_members WHERE user_id = $1 AND is_active = true
       ))
       ORDER BY vc.invited_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET shared voyages error:", e);
    res.status(500).json({ message: "Failed to fetch shared voyages" });
  }
});

// ─── PORT CALL APPOINTMENTS ─────────────────────────────────────────────────

router.get("/voyages/:voyageId/appointments", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.voyageId);
    const appointments = await storage.getPortCallAppointments(voyageId);
    res.json(appointments);
  } catch {
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
});

router.post("/voyages/:voyageId/appointments", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.voyageId);
    const userId = req.user.claims.sub;
    const appt = await storage.createPortCallAppointment({ ...req.body, voyageId, userId });
    res.status(201).json(appt);
  } catch {
    res.status(500).json({ message: "Failed to create appointment" });
  }
});

router.patch("/voyages/:voyageId/appointments/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updatePortCallAppointment(id, req.body);
    if (!updated) return res.status(404).json({ message: "Appointment not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update appointment" });
  }
});

router.delete("/voyages/:voyageId/appointments/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePortCallAppointment(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete appointment" });
  }
});


// ─── VOYAGE PORT CALLS ────────────────────────────────────────────────────────

// GET /api/voyages/:id/port-calls
router.get("/voyages/:id/port-calls", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { rows } = await pool.query(
      `SELECT vpc.*,
         p.name AS port_name, p.country AS port_country, p.locode AS port_locode,
         u.first_name AS agent_first_name, u.last_name AS agent_last_name, u.email AS agent_email
       FROM voyage_port_calls vpc
       LEFT JOIN ports p ON p.id = vpc.port_id
       LEFT JOIN users u ON u.id = vpc.agent_user_id
       WHERE vpc.voyage_id = $1
       ORDER BY vpc.port_call_order ASC, vpc.id ASC`,
      [voyageId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET port-calls error:", err);
    res.status(500).json({ message: "Failed to fetch port calls" });
  }
});

// POST /api/voyages/:id/port-calls
router.post("/voyages/:id/port-calls", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const canAccess = await canAccessVoyage(userId, voyageId);
    if (!canAccess) return res.status(403).json({ message: "Access denied" });

    const {
      portId, portCallOrder, portCallType, status,
      eta, etd, berthName, terminalName,
      cargoType, cargoQuantity, cargoUnit,
      agentUserId, notes, organizationId
    } = req.body;

    if (!portId) return res.status(400).json({ message: "portId is required" });

    const { rows: countRows } = await pool.query(
      "SELECT COALESCE(MAX(port_call_order), 0) + 1 AS next_order FROM voyage_port_calls WHERE voyage_id = $1",
      [voyageId]
    );
    const nextOrder = portCallOrder || countRows[0].next_order;

    const { rows } = await pool.query(
      `INSERT INTO voyage_port_calls
         (voyage_id, port_id, port_call_order, port_call_type, status, eta, etd, berth_name, terminal_name,
          cargo_type, cargo_quantity, cargo_unit, agent_user_id, notes, organization_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [voyageId, portId, nextOrder, portCallType || "discharging", status || "planned",
       eta ? new Date(eta) : null, etd ? new Date(etd) : null,
       berthName || null, terminalName || null,
       cargoType || null, cargoQuantity || null, cargoUnit || "MT",
       agentUserId || null, notes || null, organizationId || null]
    );

    const portCall = rows[0];

    // Update voyage load_port summary
    const { rows: allCalls } = await pool.query(
      `SELECT p.name FROM voyage_port_calls vpc JOIN ports p ON p.id = vpc.port_id WHERE vpc.voyage_id = $1 ORDER BY vpc.port_call_order`,
      [voyageId]
    );
    const loadPortSummary = allCalls.map((r: any) => r.name).join(" → ");
    await pool.query(
      "UPDATE voyages SET load_port = $1, voyage_type = CASE WHEN $2::int > 1 THEN 'multi' ELSE voyage_type END WHERE id = $3",
      [loadPortSummary, allCalls.length, voyageId]
    );

    res.status(201).json(portCall);
  } catch (err) {
    console.error("POST port-call error:", err);
    res.status(500).json({ message: "Failed to create port call" });
  }
});

// PATCH /api/voyages/:id/port-calls/:portCallId
router.patch("/voyages/:id/port-calls/:portCallId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const portCallId = parseInt(req.params.portCallId);
    const userId = req.user?.claims?.sub || req.user?.id;
    const canAccess = await canAccessVoyage(userId, voyageId);
    if (!canAccess) return res.status(403).json({ message: "Access denied" });

    const fields: string[] = [];
    const vals: any[] = [];
    let p = 1;
    const allowed = ["port_call_type","status","eta","etd","ata","atd","berth_name","terminal_name",
                     "cargo_type","cargo_quantity","cargo_unit","agent_user_id","notes","port_call_order"];
    const keyMap: Record<string, string> = {
      portCallType:"port_call_type", berthName:"berth_name", terminalName:"terminal_name",
      cargoType:"cargo_type", cargoQuantity:"cargo_quantity", cargoUnit:"cargo_unit",
      agentUserId:"agent_user_id", portCallOrder:"port_call_order"
    };

    for (const [k, v] of Object.entries(req.body)) {
      const col = keyMap[k] || k;
      if (!allowed.includes(col)) continue;
      const parsedVal = (col === "eta" || col === "etd" || col === "ata" || col === "atd") && v
        ? new Date(v as string) : v;
      fields.push(`${col} = $${p++}`);
      vals.push(parsedVal);
    }
    if (!fields.length) return res.status(400).json({ message: "No valid fields" });
    vals.push(portCallId, voyageId);

    const { rows } = await pool.query(
      `UPDATE voyage_port_calls SET ${fields.join(", ")} WHERE id = $${p++} AND voyage_id = $${p} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ message: "Port call not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("PATCH port-call error:", err);
    res.status(500).json({ message: "Failed to update port call" });
  }
});

// PATCH /api/voyages/:id/port-calls/:portCallId/status — quick status change
router.patch("/voyages/:id/port-calls/:portCallId/status", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const portCallId = parseInt(req.params.portCallId);
    const { status } = req.body;
    const VALID = ["planned","approaching","at_anchor","berthed","operations","completed","skipped"];
    if (!VALID.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const { rows } = await pool.query(
      "UPDATE voyage_port_calls SET status = $1 WHERE id = $2 AND voyage_id = $3 RETURNING *",
      [status, portCallId, voyageId]
    );
    if (!rows.length) return res.status(404).json({ message: "Port call not found" });

    if (status === "berthed" || status === "operations") {
      await pool.query("UPDATE voyages SET current_port_call_id = $1 WHERE id = $2", [portCallId, voyageId]);
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to update port call status" });
  }
});

// DELETE /api/voyages/:id/port-calls/:portCallId
router.delete("/voyages/:id/port-calls/:portCallId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const portCallId = parseInt(req.params.portCallId);
    const userId = req.user?.claims?.sub || req.user?.id;
    const canAccess = await canAccessVoyage(userId, voyageId);
    if (!canAccess) return res.status(403).json({ message: "Access denied" });
    await pool.query("DELETE FROM voyage_port_calls WHERE id = $1 AND voyage_id = $2", [portCallId, voyageId]);

    // Renumber remaining port calls
    const { rows } = await pool.query(
      "SELECT id FROM voyage_port_calls WHERE voyage_id = $1 ORDER BY port_call_order ASC, id ASC",
      [voyageId]
    );
    for (let i = 0; i < rows.length; i++) {
      await pool.query("UPDATE voyage_port_calls SET port_call_order = $1 WHERE id = $2", [i + 1, rows[i].id]);
    }
    // Update load_port summary
    const { rows: allCalls } = await pool.query(
      `SELECT p.name FROM voyage_port_calls vpc JOIN ports p ON p.id = vpc.port_id WHERE vpc.voyage_id = $1 ORDER BY vpc.port_call_order`,
      [voyageId]
    );
    const loadPortSummary = allCalls.map((r: any) => r.name).join(" → ");
    await pool.query("UPDATE voyages SET load_port = $1 WHERE id = $2", [loadPortSummary, voyageId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete port call" });
  }
});

// PATCH /api/voyages/:id/port-calls/reorder
router.patch("/voyages/:id/port-calls/reorder", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { order } = req.body as { order: Array<{ id: number; order: number }> };
    if (!Array.isArray(order)) return res.status(400).json({ message: "order must be array" });

    for (const item of order) {
      await pool.query(
        "UPDATE voyage_port_calls SET port_call_order = $1 WHERE id = $2 AND voyage_id = $3",
        [item.order, item.id, voyageId]
      );
    }
    // Update load_port summary
    const { rows: allCalls } = await pool.query(
      `SELECT p.name FROM voyage_port_calls vpc JOIN ports p ON p.id = vpc.port_id WHERE vpc.voyage_id = $1 ORDER BY vpc.port_call_order`,
      [voyageId]
    );
    const loadPortSummary = allCalls.map((r: any) => r.name).join(" → ");
    await pool.query("UPDATE voyages SET load_port = $1, voyage_type = CASE WHEN $2::int > 1 THEN 'multi' ELSE voyage_type END WHERE id = $3",
      [loadPortSummary, allCalls.length, voyageId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to reorder port calls" });
  }
});

export default router;
