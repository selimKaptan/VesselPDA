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


export default router;
