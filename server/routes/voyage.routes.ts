import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { saveBase64File } from "../file-storage";
import { insertVoyageSchema } from "@shared/schema";
import { emitToUser, emitToVoyage } from "../socket";
import { logAction, getClientIp } from "../audit";
import { db } from "../db";
import { eq, desc, asc } from "drizzle-orm";
import multer from "multer";
import { logVoyageActivity } from "../voyage-activity";
import { voyageActivities, voyageCargoLogs, voyageCargoReceivers, voyages } from "@shared/schema";
import { users } from "@shared/models/auth";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const role = req.user?.activeRole || req.user?.userRole || "shipowner";
    const voyageList = await storage.getVoyagesByUser(userId, role);
    res.json(voyageList);
  } catch (error) {
    console.error("[voyages:GET] fetch failed:", error);
    next(error);
  }
});


router.post("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageParsed = insertVoyageSchema.partial().safeParse(req.body);
    if (!voyageParsed.success) return res.status(400).json({ error: "Invalid input", details: voyageParsed.error.errors });
    const data = { ...req.body, userId };
    if (data.eta) data.eta = new Date(data.eta);
    if (data.etd) data.etd = new Date(data.etd);
    const voyage = await storage.createVoyage(data);
    logAction(userId, "create", "voyage", voyage.id, { portId: voyage.portId, vesselName: voyage.vesselName, status: voyage.status }, getClientIp(req));
    logVoyageActivity({ voyageId: voyage.id, userId, activityType: 'voyage_created', title: 'Voyage created', description: voyage.purposeOfCall ? `Purpose: ${voyage.purposeOfCall}` : undefined });
    res.json(voyage);
  } catch (error) {
    console.error("[voyages:POST] create failed:", error);
    next(error);
  }
});


router.get("/:id/activities", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const voyageId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const activities = await db
      .select({
        id: voyageActivities.id,
        voyageId: voyageActivities.voyageId,
        activityType: voyageActivities.activityType,
        title: voyageActivities.title,
        description: voyageActivities.description,
        metadata: voyageActivities.metadata,
        createdAt: voyageActivities.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(voyageActivities)
      .leftJoin(users, eq(users.id, voyageActivities.userId))
      .where(eq(voyageActivities.voyageId, voyageId))
      .orderBy(desc(voyageActivities.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({ activities, total: activities.length });
  } catch (error) { next(error); }
});

router.post("/:id/activities", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const voyageId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const { title, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "title required" });
    const [activity] = await db.insert(voyageActivities).values({
      voyageId, userId,
      activityType: 'custom_note',
      title: title.trim(),
      description: description?.trim() || null,
    }).returning();
    res.status(201).json(activity);
  } catch (error) { next(error); }
});

router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const voyage = await storage.getVoyageById(id);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    res.json(voyage);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch voyage" });
  }
});


router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyagePatchParsed = insertVoyageSchema.partial().safeParse(req.body);
    if (!voyagePatchParsed.success) return res.status(400).json({ error: "Invalid input", details: voyagePatchParsed.error.errors });
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

    if (updateData.status && updateData.status !== existing.status) {
      logVoyageActivity({ voyageId: id, userId, activityType: 'status_changed', title: `Status changed to ${updateData.status}` });
    }
    if (etaChanged) {
      logVoyageActivity({ voyageId: id, userId, activityType: 'eta_updated', title: `ETA updated to ${updateData.eta ? new Date(updateData.eta).toLocaleDateString('en-GB') : 'cancelled'}` });
    }

    if (etaChanged && existing.agentUserId && existing.agentUserId !== userId) {
      const oldEtaFmt = existing.eta ? new Date(existing.eta).toLocaleDateString("en-GB") : "not set";
      const newEtaFmt = updateData.eta ? new Date(updateData.eta).toLocaleDateString("en-GB") : "cancelled";
      await storage.createNotification({
        userId: existing.agentUserId,
        type: "eta_change",
        title: "ETA Updated",
        message: `Voyage #${id} ETA changed: ${oldEtaFmt} → ${newEtaFmt}`,
        link: `/voyages/${id}`,
      });
    }
    if (etaChanged && existing.userId && existing.userId !== userId) {
      const oldEtaFmt = existing.eta ? new Date(existing.eta).toLocaleDateString("en-GB") : "not set";
      const newEtaFmt = updateData.eta ? new Date(updateData.eta).toLocaleDateString("en-GB") : "cancelled";
      await storage.createNotification({
        userId: existing.userId,
        type: "eta_change",
        title: "ETA Updated",
        message: `Voyage #${id} ETA changed: ${oldEtaFmt} → ${newEtaFmt}`,
        link: `/voyages/${id}`,
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("updateVoyage error:", error);
    res.status(500).json({ message: "Failed to update voyage" });
  }
});


router.patch("/:id/status", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const voyage = await storage.updateVoyageStatus(id, status);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    const uid = req.user?.claims?.sub || req.user?.id;
    logAction(uid, "update", "voyage", id, { newStatus: status }, getClientIp(req));
    logVoyageActivity({ voyageId: id, userId: uid, activityType: 'status_changed', title: `Status changed to ${status}` });
    res.json(voyage);
  } catch (error) {
    res.status(500).json({ message: "Failed to update voyage status" });
  }
});


router.post("/:id/checklist", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const item = await storage.createChecklistItem({ ...req.body, voyageId });
    const userId = req.user?.claims?.sub || req.user?.id;
    logVoyageActivity({ voyageId, userId, activityType: 'checklist_added', title: `Checklist item added: ${req.body.title}` });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to add checklist item" });
  }
});


router.patch("/:id/checklist/:itemId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const item = await storage.toggleChecklistItem(itemId, voyageId);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.isCompleted) {
      const userId = req.user?.claims?.sub || req.user?.id;
      logVoyageActivity({ voyageId, userId, activityType: 'checklist_completed', title: `Completed: ${item.title}` });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle checklist item" });
  }
});


router.delete("/:id/checklist/:itemId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    await storage.deleteChecklistItem(itemId, voyageId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete checklist item" });
  }
});


router.get("/:id/documents", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const docs = await storage.getVoyageDocuments(voyageId);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: "Failed to get documents" });
  }
});


router.post("/:id/documents", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { name, docType, fileBase64, fileUrl, fileName, fileSize, notes } = req.body;
    if (!name || (!fileBase64 && !fileUrl)) return res.status(400).json({ message: "name and file required" });

    // Save base64 to filesystem; keep old base64-in-DB records untouched
    let resolvedUrl = fileUrl || null;
    let base64ToStore: string | null = null;
    if (fileBase64 && !fileUrl) {
      try {
        resolvedUrl = saveBase64File(fileBase64, "documents");
      } catch {
        base64ToStore = fileBase64; // fallback if FS write fails
      }
    }

    const doc = await storage.createVoyageDocument({
      voyageId,
      name,
      docType: docType || "other",
      fileBase64: base64ToStore,
      fileUrl: resolvedUrl,
      fileName: fileName || null,
      fileSize: fileSize || null,
      notes: notes || null,
      uploadedByUserId: req.user.claims.sub,
    });
    const userId = req.user?.claims?.sub || req.user?.id;
    logVoyageActivity({ voyageId, userId, activityType: 'document_uploaded', title: `Document uploaded: ${req.body.name || 'file'}` });
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: "Failed to upload document" });
  }
});


router.delete("/:id/documents/:docId", isAuthenticated, async (req: any, res) => {
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


router.get("/:id/chat", isAuthenticated, async (req: any, res) => {
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


router.post("/:id/chat", isAuthenticated, async (req: any, res) => {
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
    logVoyageActivity({ voyageId, userId, activityType: 'chat_message', title: `Message from ${req.user?.firstName || 'User'}`, description: typeof content === 'string' ? content.substring(0, 100) : undefined });
    emitToVoyage(voyageId, "voyage:chat:new", {
      id: msg.id,
      voyageId,
      senderId: userId,
      content: msg.content,
      createdAt: msg.createdAt,
    });
    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ message: "Failed to send message" });
  }
});


router.get("/:id/reviews", isAuthenticated, async (req: any, res) => {
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


router.post("/:id/reviews", isAuthenticated, async (req: any, res) => {
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
    logVoyageActivity({ voyageId, userId: reviewerUserId, activityType: 'review_submitted', title: `Review submitted: ${rating}/5` });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: "Failed to create review" });
  }
});


router.get("/:voyageId/appointments", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.voyageId);
    const appointments = await storage.getPortCallAppointments(voyageId);
    res.json(appointments);
  } catch {
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
});


router.post("/:voyageId/appointments", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.voyageId);
    const userId = req.user.claims.sub;
    const appt = await storage.createPortCallAppointment({ ...req.body, voyageId, userId });
    res.status(201).json(appt);
  } catch {
    res.status(500).json({ message: "Failed to create appointment" });
  }
});


router.patch("/:voyageId/appointments/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updatePortCallAppointment(id, req.body);
    if (!updated) return res.status(404).json({ message: "Appointment not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update appointment" });
  }
});


router.delete("/:voyageId/appointments/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePortCallAppointment(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete appointment" });
  }
});


router.post("/:id/documents/from-template", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const { templateId } = req.body;
    if (!templateId) return res.status(400).json({ message: "templateId required" });

    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });

    const templates = await storage.getDocumentTemplates();
    const template = templates.find((t: any) => t.id === templateId);
    if (!template) return res.status(404).json({ message: "Template not found" });

    const port = voyage.port || { name: "N/A" };
    const portName = typeof port === "object" ? (port.name || "N/A") : String(port);
    const formatDate = (d?: string | Date | null) => d ? new Date(d).toLocaleDateString("tr-TR") : "N/A";

    let content = template.content
      .replace(/\{\{vesselName\}\}/g, voyage.vesselName || "N/A")
      .replace(/\{\{imoNumber\}\}/g, voyage.imoNumber || "N/A")
      .replace(/\{\{port\}\}/g, portName)
      .replace(/\{\{grt\}\}/g, voyage.grt ? String(voyage.grt) : "N/A")
      .replace(/\{\{eta\}\}/g, formatDate(voyage.eta))
      .replace(/\{\{etd\}\}/g, formatDate(voyage.etd))
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("tr-TR"))
      .replace(/\{\{purposeOfCall\}\}/g, voyage.purposeOfCall || "N/A");

    const fileBase64 = Buffer.from(content).toString("base64");
    const doc = await storage.createVoyageDocument({
      voyageId,
      name: `${template.name} - ${voyage.vesselName || "Vessel"}`,
      docType: template.category.toLowerCase(),
      fileBase64: `data:text/html;base64,${fileBase64}`,
      notes: "Automatically created from template",
      uploadedByUserId: userId,
      version: 1,
      templateId: template.id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error("from-template error:", err);
    res.status(500).json({ message: "Failed to create document from template" });
  }
});


router.post("/:id/documents/:docId/sign", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    const { signatureText } = req.body;
    if (!signatureText) return res.status(400).json({ message: "signatureText required" });

    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    if (voyage.userId !== userId && voyage.agentUserId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const docs = await storage.getVoyageDocuments(voyageId);
    const doc = docs.find((d: any) => d.id === docId);
    await storage.signVoyageDocument(docId, signatureText, new Date());
    logVoyageActivity({ voyageId, userId, activityType: 'document_signed', title: `Document signed: ${doc?.name || 'document'}` });
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to sign document" });
  }
});


router.post("/:id/documents/:docId/new-version", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    const { name, fileBase64, notes } = req.body;
    if (!fileBase64) return res.status(400).json({ message: "fileBase64 required" });

    const docs = await storage.getVoyageDocuments(voyageId);
    const parentDoc = docs.find((d: any) => d.id === docId);
    if (!parentDoc) return res.status(404).json({ message: "Document not found" });

    const newDoc = await storage.createNewDocumentVersion(parentDoc, { name: name || parentDoc.name, fileBase64, notes, uploadedByUserId: userId });
    logVoyageActivity({ voyageId, userId, activityType: 'document_uploaded', title: `New version uploaded: ${newDoc.name}` });
    res.status(201).json(newDoc);
  } catch {
    res.status(500).json({ message: "Failed to create new version" });
  }
});


// ─── CARGO OPS ROUTES ─────────────────────────────────────────────────────────

router.get("/:id/cargo-receivers", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const receivers = await db.select().from(voyageCargoReceivers)
      .where(eq(voyageCargoReceivers.voyageId, voyageId))
      .orderBy(asc(voyageCargoReceivers.id));
    res.json(receivers);
  } catch {
    res.status(500).json({ message: "Failed to fetch cargo receivers" });
  }
});

router.post("/:id/cargo-receivers", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { name, allocatedMt } = req.body;
    if (!name || allocatedMt == null) return res.status(400).json({ message: "name and allocatedMt required" });
    const [receiver] = await db.insert(voyageCargoReceivers).values({
      voyageId,
      name,
      allocatedMt: Number(allocatedMt),
    }).returning();
    res.status(201).json(receiver);
  } catch {
    res.status(500).json({ message: "Failed to create cargo receiver" });
  }
});

router.delete("/:id/cargo-receivers/:receiverId", isAuthenticated, async (req: any, res) => {
  try {
    await db.delete(voyageCargoReceivers).where(eq(voyageCargoReceivers.id, parseInt(req.params.receiverId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to delete cargo receiver" });
  }
});

router.get("/:id/cargo-logs", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const logs = await db.select().from(voyageCargoLogs)
      .where(eq(voyageCargoLogs.voyageId, voyageId))
      .orderBy(asc(voyageCargoLogs.createdAt));
    res.json(logs);
  } catch {
    res.status(500).json({ message: "Failed to fetch cargo logs" });
  }
});

router.post("/:id/cargo-logs", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const { logDate, shift, fromTime, toTime, receiverId, amountHandled, cumulativeTotal, remarks, logType } = req.body;
    if (amountHandled == null) return res.status(400).json({ message: "amountHandled required" });
    const [log] = await db.insert(voyageCargoLogs).values({
      voyageId,
      logDate: fromTime ? new Date(fromTime) : (logDate ? new Date(logDate) : new Date()),
      shift: shift || null,
      fromTime: fromTime ? new Date(fromTime) : undefined,
      toTime: toTime ? new Date(toTime) : undefined,
      receiverId: receiverId ? Number(receiverId) : undefined,
      amountHandled: Number(amountHandled),
      cumulativeTotal: cumulativeTotal != null ? Number(cumulativeTotal) : undefined,
      logType: logType || "operation",
      remarks: remarks || null,
      createdBy: userId,
    }).returning();
    res.status(201).json(log);
  } catch {
    res.status(500).json({ message: "Failed to create cargo log" });
  }
});

router.delete("/:id/cargo-logs/:logId", isAuthenticated, async (req: any, res) => {
  try {
    await db.delete(voyageCargoLogs).where(eq(voyageCargoLogs.id, parseInt(req.params.logId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to delete cargo log" });
  }
});

router.patch("/:id/cargo-total", isAuthenticated, async (req: any, res) => {
  try {
    const { cargoTotalMt } = req.body;
    await db.update(voyages).set({ cargoTotalMt: Number(cargoTotalMt) }).where(eq(voyages.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to update cargo total" });
  }
});

export default router;
