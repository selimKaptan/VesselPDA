import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { saveBase64File } from "../file-storage";
import { insertVoyageSchema } from "@shared/schema";
import { emitToUser, emitToVoyage } from "../socket";
import { logAction, getClientIp } from "../audit";
import { db } from "../db";
import { eq, desc, asc, inArray } from "drizzle-orm";
import multer from "multer";
import { logVoyageActivity } from "../voyage-activity";
import { voyageActivities, voyageCargoLogs, voyageCargoReceivers, voyages, voyageContacts } from "@shared/schema";
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
    const body = { ...req.body };
    if (body.eta) body.eta = new Date(body.eta);
    if (body.etd) body.etd = new Date(body.etd);
    const voyageParsed = insertVoyageSchema.partial().safeParse(body);
    if (!voyageParsed.success) return res.status(400).json({ error: "Invalid input", details: voyageParsed.error.errors });
    const data = { ...body, userId };
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

// ─── CREW LOGISTICS ──────────────────────────────────────────────────────────

router.get("/:id/crew-logistics", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const crew = await storage.getVoyageCrewLogistics(voyageId);
    res.json(crew);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew logistics" });
  }
});

router.put("/:id/crew-logistics", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const crew = req.body;
    if (!Array.isArray(crew)) {
      return res.status(400).json({ message: "Body must be an array of crew members" });
    }
    const saved = await storage.saveVoyageCrewLogistics(voyageId, crew.map((c: any) => ({
      voyageId,
      sortOrder: c.sortOrder ?? 0,
      name: c.name ?? "",
      rank: c.rank ?? "",
      side: c.side ?? "on",
      nationality: c.nationality ?? "",
      passportNo: c.passportNo ?? "",
      flight: c.flight ?? "",
      flightEta: c.flightEta ?? "",
      flightDelayed: c.flightDelayed ?? false,
      visaRequired: c.visaRequired ?? false,
      eVisaStatus: c.eVisaStatus ?? "n/a",
      okToBoard: c.okToBoard ?? "pending",
      arrivalStatus: c.arrivalStatus ?? "pending",
      timeline: c.timeline ?? [],
      docs: c.docs ?? {},
      requiresHotel: c.requiresHotel ?? false,
      hotelName: c.hotelName ?? "",
      hotelCheckIn: c.hotelCheckIn ?? "",
      hotelCheckOut: c.hotelCheckOut ?? "",
      hotelStatus: c.hotelStatus ?? "none",
      hotelPickupTime: c.hotelPickupTime ?? "",
    })));
    res.json(saved);
  } catch (err) {
    console.error("crew-logistics save error:", err);
    res.status(500).json({ message: "Failed to save crew logistics" });
  }
});


router.post("/:id/generate-port-document", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const { templateId } = req.body;

    const VALID_IDS = [
      "police_arrival","police_departure","passport_arrival",
      "tcdd_berth","tcdd_depart",
      "kiyi_emniyeti","arrival_decl","shore_pass_notif",
      "departure_decl","power_of_attorney",
      "tcdd_m10","tcdd_watch_table","port_arrival","shore_pass"
    ];
    if (!templateId || !VALID_IDS.includes(templateId)) {
      return res.status(400).json({ message: "Invalid templateId" });
    }

    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });

    const TEMPLATE_META: Record<string, { tr: string; en: string }> = {
      police_arrival:    { tr: "Emniyet Deniz Limani - Gelis",         en: "Maritime Police - Arrival Declaration" },
      police_departure:  { tr: "Emniyet Deniz Limani - Gidis",         en: "Maritime Police - Departure Declaration" },
      passport_arrival:  { tr: "Denizlimani - Giris (Pasaport)",       en: "Port Immigration - Turkish Crew Arrival" },
      tcdd_berth:        { tr: "TCDD Yanasma Mektubu",                 en: "TCDD Berthing Letter" },
      tcdd_depart:       { tr: "TCDD Kalkis Mektubu",                  en: "TCDD Departure Letter" },
      kiyi_emniyeti:     { tr: "Kiyi Emniyeti - Yanasma/Kalkma Talep", en: "Coastguard - Pilotage/Towage Request" },
      arrival_decl:      { tr: "Gelis Bildirim Tutanagi",              en: "Arrival Declaration (Immigration)" },
      shore_pass_notif:  { tr: "Teblig ve Tebellug Belgesi",           en: "Shore Pass Notification Document" },
      departure_decl:    { tr: "Gidis Bildirim Tutanagi",              en: "Departure Declaration (Immigration)" },
      power_of_attorney: { tr: "Hususi Vekaletname",                   en: "Private Power of Attorney" },
      tcdd_m10:          { tr: "TCDD M.10 - Yukleme/Bosaltma Talep",   en: "TCDD Cargo Operations Request (M.10)" },
      tcdd_watch_table:  { tr: "TCDD Amele Postasi Talep Tablosu",     en: "TCDD Watch/Labour Request Table" },
      port_arrival:      { tr: "Gemi Gelis Bildirimi - Liman Baskanligi", en: "Vessel Arrival Report - Port Authority" },
      shore_pass:        { tr: "Liman Sehri Gezer Belgesi",            en: "Request Shore Pass (Landing Card)" },
    };
    const tmpl = TEMPLATE_META[templateId];

    const fmtDate = (d?: string | Date | null) => d ? new Date(d).toLocaleDateString("tr-TR") : "...";
    const fmtDateTime = (d?: string | Date | null) => d ? new Date(d).toLocaleString("tr-TR") : "...";
    const v = voyage;
    const today = new Date().toLocaleDateString("tr-TR");
    const todayFull = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const gemi = v.vesselName || "...";
    const bayrak = v.flag || "...";
    const imo = v.imoNumber || "...";
    const grt = v.grt ? String(v.grt) : "...";
    const nrt = (v as any).nrt ? String((v as any).nrt) : "...";
    const liman = v.portName || "IZMIR";
    const eta = fmtDate(v.eta);
    const etd = fmtDate(v.etd);
    const amac = v.purposeOfCall || "...";
    // Company info from Selim Denizcilik
    const ACENTE_ADI = "SELIM DENIZCILIK NAK.GEM.SAN.TIC.LTD.STI.";
    const ACENTE_ADRES = "1443 Sk. No:148 Kat: 5 D:503 - 504 Alsancak-IZMIR";
    const ACENTE_TEL = "Tel: 0.232 464 47 11 (PBX)  Fax: 0.232 464 18 31 - 464 32 71";
    const ACENTE_TELEX = "Telex: 51133  Tic.Sic. No: Merkez 89899";
    const ACENTE_YETKILI = "MURAT SIRINEL";

    const PDFDocumentModule = await import("pdfkit");
    const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));

    // Helper: horizontal rule
    const hline = (y?: number, x1 = 50, x2 = 545) => {
      const yPos = y ?? doc.y;
      doc.moveTo(x1, yPos).lineTo(x2, yPos).strokeColor("#000000").lineWidth(0.5).stroke();
      doc.lineWidth(1);
    };

    // Helper: draw a table row with label-value pairs
    const tableRow = (label: string, value: string, y: number, labelW = 200) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000").text(label, 50, y, { width: labelW });
      doc.font("Helvetica").fontSize(9).text(`: ${value}`, 50 + labelW, y, { width: 545 - 50 - labelW });
    };

    // Helper: standard Selim header (big logo-text style)
    const selimHeader = () => {
      doc.fontSize(28).font("Helvetica-Bold").fillColor("#000000")
        .text("SELIM", 0, 40, { align: "center", width: 595 });
      doc.fontSize(12).font("Helvetica-Bold")
        .text("Denizcilik,Nakliyat, Gemicilik", 0, 78, { align: "center", width: 595 });
      doc.fontSize(12).font("Helvetica-Bold")
        .text("Sanayi Ticaret Limited Sirketi", 0, 95, { align: "center", width: 595 });
    };

    // Helper: Selim footer
    const selimFooter = () => {
      hline(798, 30, 565);
      doc.fontSize(8).font("Helvetica").fillColor("#000000")
        .text(ACENTE_ADRES, 0, 803, { align: "center", width: 595 });
      doc.fontSize(8).text(ACENTE_TEL, 0, 813, { align: "center", width: 595 });
      doc.fontSize(8).text(ACENTE_TELEX, 0, 823, { align: "center", width: 595 });
    };

    // Helper: TC Valilik header (Immigration)
    const valikHeader = () => {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000")
        .text("T.C.", 0, 40, { align: "center", width: 595 });
      doc.text("IZMIR VALILIGI", 0, 54, { align: "center", width: 595 });
      doc.fontSize(9).font("Helvetica")
        .text("Deniz Limani Sube Mudurlugu", 0, 68, { align: "center", width: 595 });
      doc.text("(REPUBLIC OF TURKEY)", 0, 80, { align: "center", width: 595 });
      doc.text("IZMIR SECURITY DEPARTMENT", 0, 92, { align: "center", width: 595 });
      doc.text("PORT OFFICE", 0, 104, { align: "center", width: 595 });
    };

    await new Promise<void>((resolve) => {
      doc.on("end", resolve);

      // =====================================================================
      if (templateId === "police_arrival") {
        // PAGE 1: Emniyet Deniz Limani GELiS
        selimHeader();
        doc.moveDown(5.5);
        doc.fontSize(9).font("Helvetica-Bold").text("EMNIYET DENIZ LIMANI SUBE MUDURLUGU'NE", 50, doc.y);
        doc.text("IZMIR", 50, doc.y + 12);
        doc.fontSize(9).font("Helvetica").text(`${liman},        ${todayFull}`, 380, doc.y - 12);
        doc.moveDown(2.5);
        doc.fontSize(12).font("Helvetica-Bold").text("G E L I S", { align: "center" });
        doc.moveDown(1);
        doc.fontSize(9).font("Helvetica");
        doc.font("Helvetica").text(`ACENTELIGIMIZE BAGLI  ${bayrak}  BAYRAKLI  ${gemi}  ISIMLI GEMININ GELIS KONTROLUNUN YAPILMASINI EMIR VE MUSADELERINIZE ARZ EDERIZ.`, 50, doc.y, { width: 490 });
        doc.moveDown(1);
        doc.text("SAYGLARIMIZLA", 380, doc.y);
        doc.font("Helvetica-Bold").text(ACENTE_YETKILI, 380, doc.y + 12);
        doc.moveDown(3.5);
        const fieldY = doc.y;
        const fields2 = [
          ["GEMININ ADI",       gemi],
          ["BAYRAGI",           bayrak],
          ["BAGLAMA LIMANI",    (v as any).portOfRegistry || "..."],
          ["NRT / GRT",         `${nrt}/        ${grt}/`],
          ["GELDIGI YER",       (v as any).lastPort || (v as any).comingFrom || liman],
          ["GELECEGI TARIH",    eta],
          ["YUKLEYECEGI YUK",   "YOK                0"],
          ["TAHLIYE EDECEGI YUK", (v as any).cargoQuantity ? `${(v as any).cargoQuantity} MTON    ${(v as any).cargoType || ""}` : "..."],
          ["GIDECEGI YER",       (v as any).nextPort || "..."],
          ["GIDECEGI TARIH",     etd === "..." ? "IS BITIMI" : etd],
          ["TRANSIT YUKU",       (v as any).transitCargo || "..."],
          ["YANASACAGI LIMAN",   (v as any).berthName || "ALSANCAK"],
          ["IMO NO",             imo],
        ];
        fields2.forEach(([label, val], i) => {
          doc.font("Helvetica-Bold").fontSize(9).text(label, 50, fieldY + i * 16);
          doc.font("Helvetica").text(`: ${val}`, 200, fieldY + i * 16);
        });
        selimFooter();

      // =====================================================================
      } else if (templateId === "police_departure") {
        selimHeader();
        doc.moveDown(5.5);
        doc.fontSize(9).font("Helvetica-Bold").text("EMNIYET DENIZ LIMANI SUBE MUDURLUGU'NE", 50);
        doc.text("IZMIR", 50, doc.y + 12);
        doc.fontSize(9).font("Helvetica").text(`${liman},        ${todayFull}`, 380, doc.y - 12);
        doc.moveDown(2.5);
        doc.fontSize(12).font("Helvetica-Bold").text("G I D I S", { align: "center" });
        doc.moveDown(1);
        doc.fontSize(9).font("Helvetica");
        doc.font("Helvetica").text(`ACENTELIGIMIZE BAGLI  ${bayrak}  BAYRAKLI  ${gemi}  ISIMLI GEMININ GIDIS KONTROLUNUN YAPILMASINI EMIR VE MUSADELERINIZE ARZ EDERIZ.`, 50, doc.y, { width: 490 });
        doc.moveDown(1);
        doc.text("SAYGLARIMIZLA", 380, doc.y);
        doc.font("Helvetica-Bold").text(ACENTE_YETKILI, 380, doc.y + 12);
        doc.moveDown(3.5);
        const fY = doc.y;
        const dFields = [
          ["GEMININ ADI",         gemi],
          ["BAYRAGI",             bayrak],
          ["BAGLAMA LIMANI",      (v as any).portOfRegistry || "..."],
          ["NRT / GRT",           `${nrt}/        ${grt}/`],
          ["GELDIGI YER",         (v as any).lastPort || liman],
          ["GELDIGI TARIH",       eta],
          ["YUKLEYECEGI YUK",     "YOK                0"],
          ["TAHLIYE ETTIGI YUK",  (v as any).cargoQuantity ? `${(v as any).cargoQuantity} MTON    ${(v as any).cargoType || ""}` : "..."],
          ["GIDECEGI YER",        "EMRE GORE"],
          ["GIDECEGI TARIH",      etd === "..." ? "IS BITIMI" : etd],
          ["TRANSIT YUKU",        (v as any).cargoType || "..."],
          ["YANASACAGI LIMAN",    (v as any).berthName || "ALSANCAK"],
          ["IMO NO",              imo],
        ];
        dFields.forEach(([label, val], i) => {
          doc.font("Helvetica-Bold").fontSize(9).text(label, 50, fY + i * 16);
          doc.font("Helvetica").text(`: ${val}`, 200, fY + i * 16);
        });
        selimFooter();

      // =====================================================================
      } else if (templateId === "passport_arrival") {
        selimHeader();
        doc.moveDown(5.5);
        doc.fontSize(9).font("Helvetica-Bold").text("DENIZLIMANI SUBE MUDURLUGU'NE", 50);
        doc.text("IZMIR", 50, doc.y + 12);
        doc.fontSize(9).font("Helvetica").text(`IZMIR,        ${todayFull}`, 380, doc.y - 12);
        doc.moveDown(2.5);
        doc.fontSize(12).font("Helvetica-Bold").text("G i r i s", { align: "center" });
        doc.moveDown(1);
        doc.fontSize(9).font("Helvetica");
        doc.font("Helvetica").text(`ACENTELIGIMIZE BAGLI  ${bayrak}  BAYRAKLI  ${gemi}  ISIMLI GEMININ TURK PERSONELLERININ GEREKLI PASAPORT GIRIS ISLEMLERININ YAPILMASINI ARZ DERIZ.`, 50, doc.y, { width: 490 });
        doc.moveDown(1);
        doc.text("SAYGLARIMIZLA", 380, doc.y);
        doc.font("Helvetica-Bold").text(ACENTE_YETKILI, 380, doc.y + 12);
        doc.moveDown(3);
        doc.fontSize(9).font("Helvetica-Bold").text("GEMININ");
        doc.font("Helvetica");
        doc.text(`GELECEGI LIMAN       : ${(v as any).nextPort || liman}`, 50, doc.y + 8);
        doc.text(`GELECEGI TARIH        : ${eta}`, 50, doc.y + 8);
        selimFooter();

      // =====================================================================
      } else if (templateId === "tcdd_berth") {
        selimHeader();
        doc.moveDown(5.5);
        doc.fontSize(9).font("Helvetica-Bold").text("TCDD IZMIR LIMAN ISLETME MUDURLUGU'NE", 50);
        doc.text("IZMIR", 50, doc.y + 12);
        doc.fontSize(9).font("Helvetica").text(`IZMIR,        ${todayFull}`, 380, doc.y - 12);
        doc.moveDown(2.5);
        doc.fontSize(12).font("Helvetica-Bold").text("YANASMA MEKTUBU", { align: "center" });
        doc.moveDown(1.5);
        doc.fontSize(9).font("Helvetica");
        doc.font("Helvetica").text(`        ACENTELIGIMIZE BAGLI  ${bayrak}  BAYRAKLI  ${gemi}  ISIMLI GEMIMIZIN\n        ${eta}  GUNU SAAT      'DA IZMIR LIMANINA YANASTIRILMASINI EMIR VE MUSADELERINIZE ARZ EDERIZ.`, 50, doc.y, { width: 490 });
        doc.moveDown(2);
        doc.fontSize(9).font("Helvetica-Bold").text("BAS:", 50);
        doc.text("KIC:", 50, doc.y + 14);
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(9).text("SAYGLARIMIZLA,", 380, doc.y);
        doc.font("Helvetica-Bold").text(ACENTE_YETKILI, 380, doc.y + 14);
        selimFooter();

      // =====================================================================
      } else if (templateId === "tcdd_depart") {
        selimHeader();
        doc.moveDown(5.5);
        doc.fontSize(9).font("Helvetica-Bold").text("TCDD IZMIR LIMAN ISLETME MUDURLUGU'NE", 50);
        doc.text("IZMIR", 50, doc.y + 12);
        doc.fontSize(9).font("Helvetica").text(`IZMIR,        ${todayFull}`, 380, doc.y - 12);
        doc.moveDown(2.5);
        doc.fontSize(12).font("Helvetica-Bold").text("KALKIS MEKTUBU", { align: "center" });
        doc.moveDown(1.5);
        doc.fontSize(9).font("Helvetica");
        doc.font("Helvetica").text(`        ACENTELIGIMIZE BAGLI  ${bayrak}  BAYRAKLI  ${gemi}  ISIMLI GEMIMIZIN\n        ${etd === "..." ? "..." : etd}  GUNU SAAT      'DA IZMIR LIMANINDAN KALDIRILMASINI EMIR VE MUSADELERINIZE ARZ.`, 50, doc.y, { width: 490 });
        doc.moveDown(2);
        doc.fontSize(9).font("Helvetica-Bold").text("RIHTIM NO:", 50);
        doc.text("BAS:", 50, doc.y + 14);
        doc.text("KIC:", 50, doc.y + 14);
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(9).text("SAYGLARIMIZLA,", 380, doc.y);
        doc.font("Helvetica-Bold").text(ACENTE_YETKILI, 380, doc.y + 14);
        selimFooter();

      // =====================================================================
      } else if (templateId === "kiyi_emniyeti") {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000")
          .text("KIYI EMNIYETI GENEL MUDURLUGU IZMIR", 0, 50, { align: "center", width: 595 });
        doc.moveDown(1.5);
        doc.fontSize(9).font("Helvetica")
          .text("Liman Yanasma-Kalkma", { align: "center" });
        doc.text("Kilavuzluk ve Romorkör Hizmetleri Talep Formu", { align: "center" });
        doc.moveDown(1);
        doc.text(`${todayFull}`, 380, doc.y);
        doc.text("BAS(KW) - KIC(KW)", 390, doc.y + 12);
        doc.moveDown(2);
        const kY = doc.y;
        const kFields: [string, string, string, string][] = [
          ["GEMI ADI", gemi, "BAS ve KIC PERVANESI(KW)", "( ) - ( )"],
          ["BAYRAGI", bayrak, "YUKUN CINSI", (v as any).cargoType || "..."],
          ["IMO NUMARASI", imo, "TAHMINI YANASMA TARIHI", eta],
          ["GROSS TON", `${grt}/`, "TAHMINI KALKIS TARIHI", etd],
          ["ACENTESI", ACENTE_ADI.split(" ")[0] + " DENIZCILIK", "TEHLIKELI YUK-IMDG KOD", ""],
          ["GEMI TIPI", (v as any).vesselType || "KIMYASAL TANKER", "(1-2-5.1-5.2-6.2-7)", ""],
        ];
        kFields.forEach(([l1, v1, l2, v2], i) => {
          const ry = kY + i * 22;
          doc.font("Helvetica-Bold").fontSize(9).text(l1, 50, ry);
          doc.font("Helvetica").text(`: ${v1}`, 145, ry);
          doc.font("Helvetica-Bold").text(l2, 300, ry);
          doc.font("Helvetica").text(`: ${v2}`, 450, ry);
        });
        doc.font("Helvetica-Bold").fontSize(9).text("GELDIGI LIMAN", 50, kY + 132);
        doc.font("Helvetica").text(`: ${liman}`, 145, kY + 132, { continued: true });
        doc.font("Helvetica-Bold").text("    GIDECEGI LIMAN", { continued: true });
        doc.font("Helvetica").text(`: ${(v as any).nextPort || "..."}`, { continued: false });
        doc.moveDown(1.5);
        doc.font("Helvetica-Bold").fontSize(9).text("TALEP EDILEN HIZMET:");
        doc.moveDown(0.8);
        const hizmetY = doc.y;
        ["KILAVUZLUK", "ROMORKÖR", "PALAMAR", "PELIKAN", "SIFTING"].forEach((h, i) => {
          doc.font("Helvetica-Bold").fontSize(9).text(h, 50 + i * 95, hizmetY);
          const val = (h === "KILAVUZLUK" || h === "ROMORKÖR" || h === "PALAMAR") ? "EVET" : "HAYIR";
          doc.font("Helvetica").text(val, 50 + i * 95, hizmetY + 14);
        });
        // Body paragraph — anchored at absolute y=490 to prevent pushing signature area off-page
        doc.fontSize(7.5).font("Helvetica")
          .text("Yukarida yazili hizmetler hususunda gerekli depozitonu alinmasini istedigimiz hizmetlerin verilmesini, Liman Hizmetleri Tarifesi hukumleri ile Liman ve Iskelelerinin dair Tuzuk, Yonetmelik, Talimat ve Sair mevzuatini tatbikin, Ingiltere Birllesik Kralligi Standart Cekme Sartlari (UNDER U.K. TOWAGE CONTRACT CONDITIONS) nin tatbikini, gunun 24 saat devam edebilecek calisma saatlerine uymay, limanin yukleme-bosaltma kapasitesine gore vasita bulundurmayi, aksi takdirde Isletmenizin kendi kapasitesine uygun yukleme-bosaltmayi temin hususunda alacagi tedbirleri kabul ve bunlara ait bilcumle ucret ve masraflari odemeyi, idarece zaruret goruldugu hallerde gemi ve vasitanin yukleme-bosaltma yerlerinin degistirilmesine Liman is imkan ve kapasitesi bakimindan alinacak her turlu tedbire uymay, Bogaz gecis acentelerinin bildirilmesi halinde geminin Bogaz gecisinden dogan ve KIYI EMNIYETI GENEL MUDURLUGU (KEGIM) nin tahakkuk ettirdigi her turlu borc odemeyi taahhut ederiz.", 50, 490, { width: 495 });
        // DEPOZITO + KASE-IMZA anchored absolutely at y=670/690 (Rule 4: bottom anchoring)
        doc.fontSize(9).font("Helvetica").text("DEPOZITO : ________________ TL", 50, 670);
        hline(688);
        doc.font("Helvetica-Bold").fontSize(8).text("KASE - IMZA", 380, 692);
        doc.text("ACENTASI ve DONATANI", 366, 704);

      // =====================================================================
      } else if (templateId === "arrival_decl") {
        valikHeader();
        doc.moveDown(5.5);
        doc.fontSize(11).font("Helvetica-Bold").text("GELIS BILDIRIM TUTANAGI", 50);
        doc.fontSize(9).font("Helvetica").text("(ARRIVAL DECLARATION)", 50, doc.y + 2);
        doc.moveDown(1.5);
        const adFields: [string, string, string][] = [
          ["GEMININ ADI VE CINSI", "NAME OF VESSEL AND TYPE",              gemi],
          ["GEMININ BAYRAGI",       "VESSEL'S FLAG",                       bayrak],
          ["GEMININ ACENTESI",      "VESSEL'S AGENT",                      ACENTE_ADI.split(" ")[0] + " DENIZCILIK"],
          ["GEMI KAPTANININ ADI",   "MASTER'S NAME",                       "..."],
          ["GEMI TAYFA ADEDI",      "NUMBER OF CREW",                      "..."],
          ["GEMI KUMPANYASININ ADI","OWNER OF THE VESSEL",                  "..."],
          ["GEMININ NET VE GROS TONAJI","NRT AND GRT TONNAGE",             `${nrt}/ ${grt}/`],
          ["GEMININ IZMIR YOLCUSU VE TEBASI","NUMBER AND NATIONALITY OF PASSANGER FOR IZMIR","YOK"],
          ["GEMININ TRANSIT YUK VE CINSI","TRANSIT CARGO ONBOARD(KIND&QUANTITY)",          (v as any).cargoType || "..."],
          ["GEMININ TRANSIT YOLCU ADEDI","NUMBER OF TRANSIT PASSENGER",                    "YOK"],
          ["GEMIDE KACAK YOLCU OLUP OLMADIGI","ARE THERE STOWAWAY ON BOARD",               "YOK"],
          ["GEMININ IZMIR YUK CINSI VE TONU","CARGO FOR IZMIR (KIND&QUALITY)",            (v as any).cargoType ? `${(v as any).cargoType} ${(v as any).cargoQuantity || ""}` : "..."],
          ["IZMIR'DEN ALACAGI YUK CINSI VE TONU","CARGO LOADED FM IZMIR (KIND&QUANTITY)", "YOK"],
          ["GEMININ GELDIGI VE GIDECEGI LIMAN","VESSEL ARRIVED FROM../VESSEL SAILED TO/", `${(v as any).lastPort || liman}    ${(v as any).nextPort || "..."}`],
          ["GEMIDE SILAH OLUP OLMADIGI","ARE THERE ANY WHEAPONS ON BOARD..",               "YOK"],
          ["TURK BAYRAGININ NIZAMI OLUP OLMADIGI","ARE THERE ANY TURKISH FLAGS ON BOARD",  "NIZAMI"],
          ["LIMANIN NERESINDE OLDUGU","",                                                  (v as any).berthName || "ALSANCAK"],
          ["IMO NO","",                                                                     imo],
        ];
        const adY = doc.y;
        adFields.forEach(([tr2, en2, val], i) => {
          const ry = adY + i * 18;
          if (ry > 720) return;
          doc.font("Helvetica-Bold").fontSize(7.5).text(tr2, 50, ry);
          doc.font("Helvetica").fontSize(6.5).fillColor("#555555").text(en2, 50, ry + 7);
          doc.fillColor("#000000").fontSize(8.5).text(`: ${val}`, 280, ry, { width: 260 });
        });
        doc.moveDown(1);
        const certY = Math.min(doc.y + 10, 730);
        doc.fontSize(8).font("Helvetica")
          .text(`LIMANIMIZA ${liman}`, 50, certY);
        doc.text(`'DAN BUGÜN      'DE GELEN  ${bayrak}  BAYRAKLI VE  ${gemi}  ADLI GEMININ GELIS KONTROLUNDE YAPILAN SORUSTURMA VE ARASTIRMADAN PASAPORTSUZ VE KACAK YOLCU BULUNMADIGI ANLASIMIS OLMAKLA TANZIM EDILEN IS BU GELIS BILDIRIMI IMZA ALTINA ALINDI      ${today}`, 50, certY + 12, { width: 245 });
        doc.text("EMNIYET\nDENIZ LIMANI SUBE MUDURLUGU\n(CHIEF IMMIGRATION OFFICER)", 50, certY + 60);
        doc.text("ACENTA\n(AGENT)", 230, certY + 60);
        doc.text("KAPTAN\n(MASTER)", 380, certY + 60);

      // =====================================================================
      } else if (templateId === "departure_decl") {
        valikHeader();
        doc.moveDown(5.5);
        doc.fontSize(11).font("Helvetica-Bold").text("GIDIS BILDIRIM TUTANAGI", 50);
        doc.fontSize(9).font("Helvetica").text("(DEPARTURE DECLARATION)", 50, doc.y + 2);
        doc.moveDown(1.5);
        const ddFields: [string, string, string][] = [
          ["GEMININ ADI VE CINSI",       "NAME OF VESSEL AND TYPE",                     gemi],
          ["GEMININ BAYRAGI",             "(VESSEL'S FLAG)",                             bayrak],
          ["GEMININ IZMIR'DEN ALDIGI YOLCU","(NUMBER OF EMBARKED PASSENGER)",            "YOK"],
          ["GEMININ TRANSIT YOLCU ADEDI VE TEBASI","(NUMBER AND NATIONALITY OF TRANSIT PASSENGER)","YOK"],
          ["GEMI TAYFA ADEDI",            "(NUMBER OF CREW)",                            "..."],
          ["IZMIR'DEN ALDIGI YUK CINSI VE TONU","CARGO LOADED FM IZMIR (KIND&QUANTITY)", "YOK"],
          ["GEMININ TRANSIT YUK CINSI VE TONAJI","(TRANSIT CARGO ONBOARD KIND&QUANTITY)", (v as any).cargoType ? `${(v as any).cargoType}  ${(v as any).cargoQuantity || ""} MTON` : "..."],
          ["GEMIDE KACAK YOLCU OLUP OLMADIGI","ARE THERE STOWAWAY ON BOARD",             "YOK"],
          ["GEMININ NET TONAJI",           "(NRT TONNAGE)",                               `${nrt}/`],
          ["GEMININ GIDECEGI LIMAN VE TARIHI","(VESSEL SAIL TO... AND DATE.....)",        `0        ${etd}`],
          ["GEMININ GELDIGI LIMAN VE TARIH","(VESSEL ARRIVED FROM.... AND DATE......)",   `${liman}        ${eta}`],
          ["IMO NO",                       "",                                             imo],
        ];
        const ddY = doc.y;
        ddFields.forEach(([tr2, en2, val], i) => {
          const ry = ddY + i * 20;
          if (ry > 720) return;
          doc.font("Helvetica-Bold").fontSize(8).text(tr2, 50, ry);
          doc.font("Helvetica").fontSize(7).fillColor("#555555").text(en2, 50, ry + 9);
          doc.fillColor("#000000").fontSize(9).text(`: ${val}`, 280, ry, { width: 260 });
        });
        const certY2 = ddY + ddFields.length * 20 + 15;
        doc.fontSize(7.5).font("Helvetica")
          .text(`LIMANIZDAN              'A BUGÜN SAAT      'DE GIDEN  ${bayrak}  BAYRAKLI  ${gemi}  ADLI GEMININ GIDIS KONTROLUNDE YAPILAN SORUSTURMA VE ARASTIRMADAN PASAPORTSUZ VE KACAK YOLCU BULUNMADIGI ANLASIMIS OLMAKLA TANZIM EDILEN IS BU GIDIS BILDIRIMI IMZA ALTINA ALINDI      ${today}`, 50, certY2, { width: 250 });
        doc.text("EMNIYET\nDENIZ LIMANI SUBE MUDURLUGU\n(CHIEF IMMIGRATION OFFICER)", 50, certY2 + 55);
        doc.text("ACENTA\n(AGENT)", 230, certY2 + 55);
        doc.text("KAPTAN\n(MASTER)", 380, certY2 + 55);

      // =====================================================================
      } else if (templateId === "shore_pass_notif") {
        doc.fontSize(12).font("Helvetica-Bold").text("TEBLIG VE TEBELLUG BELGESI", 0, 50, { align: "center", width: 595 });
        doc.fontSize(10).font("Helvetica").text("OF NOTIFIED & CONVEYED DOCUMENT", 0, 68, { align: "center", width: 595 });
        doc.moveDown(1.5);
        doc.fontSize(9).text(`${today}  gunü saat  ............  siralarinda  Alsancak liman  ............  rihtim mevkisinde (limanina) gelen`, 50, doc.y, { width: 495 });
        doc.text(`${imo}  IMO no'lu  ${bayrak}  bayrakli,  ${gemi}  isimli geminin gemicilere liman sehri izin belgesi duzenlenmesi icin geminin kaptani veya yetkili acentesi tarafindan gerekli polis islemleri talep edilmistir.`, 50, doc.y + 14, { width: 495 });
        doc.moveDown(1);
        doc.fontSize(7.5).font("Helvetica").fillColor("#333333")
          .text(`${today}  at ............  Hrs at the place of ALSANCAK PORT ............  Pier / anchorage for the vessel  ${bayrak}  flagged  ${gemi}  & IMO Nr  ${imo}  by the agent and master.`, 50, doc.y, { width: 495 });
        doc.fillColor("#000000");
        doc.moveDown(1.5);
        const spLines = [
          "1. Gelen gemi adaminin geldigi gemi ile geri doneceği ve izin verilen tarihler icerisinde Liman Sehrinin sinirlari disina cikamayacagi;\n   Crew members will sail with the vessel and Crew members will not exit outisde of the Port City border in limited date/s;",
          "2. Liman sehri gezme izin belgesini aldigi birime teslim edeceği ve karti kaybetmesi durumunda en kisa surede bildirimde bulunacagi;\n   Crew members will give back the shore pass to the issued authority and to be informed authority soonest whether lost the pass;",
          "3. Liman sehri gezi izin belgesinin, pasaport veya gemi adami cuzgani fotokopisi ile birlikte bulundurulmasi gerektiği;\n   Crew members are required to hold shore pass with his photocopy of passport or seamanbook during city visiting;",
          "4. Liman Sehri Gezi Izin belgesinde verilen gemicinin belirtilen saatte gemiye donmemesi, Adli olaya karsimasi il disi sinirlarina ciktignin tespit edilmesi halinde gemici, acente veya gemi kaptani tarafindan durumun en kisa sure icerisinde Hudut Kapisi Pasaport bilgi verilecegi;",
          "5. Giris - Cikiglarda sadece (Yolcu Salonu) Liman A Kapisi kullanilacagi;\n   Required to use only GATE A (Passenger Terminal) for entrance and exit the port;",
          "6. Gemi Limanda bulundugu sure icerisinde Murettebat ve Yolcularin Gemi Adami Cüzdani ve Pasaportlari kendilerine verilmeyerek, gerektiginde Pasaport Polisine teslim edilmek uzere gemi kaptani tarafindan muhafaza altina alinacagi;",
        ];
        spLines.forEach(line => {
          doc.fontSize(7).font("Helvetica").text(line, 50, doc.y, { width: 495 });
          doc.moveDown(0.5);
        });
        doc.moveDown(1);
        doc.fontSize(8).text("Yukarida belirtilen sartlarin yerine getirilmedigi taktirde 5682/20 sayili Pasaport Kanunu ve 6458/12-2b sayili Yabancilar ve Uluslararasi Koruma Kanununa Muhalefetten sorumular hakkinda adli ve idari islem yapilacaginin tarafimiza teblig edildigini konu hakkinda bilgi sahibi oldugumu kabul ve tebellug ederim.", 50, doc.y, { width: 495 });
        // Signature block anchored absolutely at y=680 (Rule 4: bottom anchoring)
        doc.fontSize(8).font("Helvetica").text("TEBLIG TARIHI", 50, 680);
        doc.text("TEBLIG EDEN", 320, 680);
        doc.font("Helvetica-Bold").text("GEMI ACENTESI", 50, 710);
        doc.font("Helvetica").text("Agent", 50, 722);
        doc.font("Helvetica-Bold").text("GEMI KAPTANI", 320, 710);
        doc.font("Helvetica").text("Master", 320, 722);
        doc.text(gemi, 320, 736);
        doc.text("...", 320, 748);

      // =====================================================================
      } else if (templateId === "power_of_attorney") {
        doc.fontSize(12).font("Helvetica-Bold").text("TERCUMEDIR", 0, 50, { align: "center", width: 595 });
        doc.fontSize(10).text("(TURKCEDEN INGILIZCE'YE)", 0, 66, { align: "center", width: 595 });
        doc.moveDown(1.5);
        doc.fontSize(11).font("Helvetica-Bold").text("HUSUSI VEKALETNAME", 0, doc.y, { align: "center", width: 595, underline: true });
        doc.moveDown(1.5);
        doc.fontSize(9).font("Helvetica");
        doc.text(`Kaptani bulundugum  ${bayrak}  bayrakli  ${(v as any).portOfRegistry || "..."}  limanina  ${(v as any).ownerName || "..."}  isimli geminin Aliaga, Dikili ve Izmir limanina ugrama nedeni ile; Liman ve Gumruk Idareleri ile, Sahil Sihhiye, Emniyet Mudurlükleri, T.C.D.D. ve Liman idaresi ile Turkiye Denizcilik Isletmesi nezdinde ve yukun alicisina tesliminde mutaf olup tarafimizdan yapilmasi muktazi formaliteler icin ve hicbir sekilde tasiyici ve donatan ilzam etmemek ve munhasiran beni temsile, yukarida mezkur formalitelere iliskin her turlu evraki adima imzalamaya, gerekli masraflari yapmaya, gemi manifestosunu gumruge ibraz etmeye, yuk sahiplerince ibraz edilecek konsimentolar karsiligi ordinolar vermeye, yukleme halinde adima konsimento imzalamaya, yukarida yazili salahiyetlerin tamami veya bir kismi icin baskalarina da tevkile mezun ve salahiyetli olmak uzere tasiyici / donatan ile araslarinda hicbir acetenlik anlasması bulunmayan,`, { width: 495 });
        doc.moveDown(0.8);
        doc.font("Helvetica-Bold").text(`${ACENTE_ADRES}`, { width: 495 });
        doc.font("Helvetica").text(`${ACENTE_ADI}' ni vekil tayin ettim.`, { width: 495 });
        doc.moveDown(1.5);
        doc.font("Helvetica-Bold").text(gemi, 50, doc.y, { continued: true });
        doc.font("Helvetica").text("  gemisi kaptani", { continued: true });
        doc.font("Helvetica-Bold").text("KAPTAN  ...", 380, doc.y);
        doc.moveDown(3);
        doc.fontSize(11).font("Helvetica-Bold").text("PRIVATE POWER OF ATTORNEY", 0, doc.y, { align: "center", width: 595, underline: true });
        doc.moveDown(1);
        doc.fontSize(9).font("Helvetica");
        doc.text(`I have appointed ${ACENTE_ADI.split(" ")[0]} DENIZCILIK TUR. SAN. VE TIC. LTD. STI. flagged ${bayrak} which does not any agency agreement and relationship with the forwarder Ship owner of the vessel ${gemi} Beloning to ${(v as any).ownerName || "..."} Owners, registered at ${(v as any).portOfRegistry || "..."} on which I'm serving as captain, by reason of it's call to Aliaga, Dikili and Izmir Port in the transactions to be made at the port and customs office Coast Health and Police Directorates Turkish Repuplic State Railways and Port Management and Turkish Maritime Administration Co. Inc. (Turkiye denizcilik isl.) and formalities related with the delivery or the load to the consignee me, and to sign all sorts of documants related with the above mentioned formalities, to pay the coasts incurred to present the ship manifest to the customs, to issue delivery orders in return of the bills of lading to be present by the cargo owners to sign the bill of lading on my behalf while loading to be authorized also to authorize others with full or partial power to do transactions written above`, { width: 495 });
        // Signature block anchored absolutely at y=710 (Rule 4: bottom anchoring)
        doc.font("Helvetica-Bold").fontSize(9).text(`Master of the ${gemi}  vessel  CAPTAIN  ...`, 50, 710, { width: 495 });
        doc.font("Helvetica").text(`In the office of ${ACENTE_ADI.split(" ")[0]} DENIZCILIK NAKLIYAT, GEMICILIK SAN.VE TIC.LTD.STI.`, 50, 724, { width: 495 });
        doc.text(`${ACENTE_ADRES}`, 50, 738, { width: 495 });

      // =====================================================================
      } else if (templateId === "tcdd_m10") {
        doc.fontSize(11).font("Helvetica-Bold").text("TCDD IZMIR LIMAN ISLETME MUDURLUGU", 0, 40, { align: "center", width: 595 });
        doc.fontSize(10).text("GEMI YUKLEME VE BOSALTMA TALEPNAMESI (M.10)", 0, 56, { align: "center", width: 595 });
        doc.moveDown(1.2);
        doc.fontSize(8).font("Helvetica-Bold").text("GEMININ", 50, doc.y);
        doc.moveDown(0.5);
        hline();
        // Table header
        const tY = doc.y + 5;
        const cols = [50, 160, 300, 400, 520];
        const headers = ["Adi", "Bayragi", "Gros Tonilatosu", "Rusüm Ton.", "Boyu ve Eni"];
        const vals1 = [gemi, bayrak, `${grt}/`, `${nrt}/`, `${(v as any).loa || "..."}M /${(v as any).beam || "..."}/`];
        headers.forEach((h, i) => { doc.font("Helvetica-Bold").fontSize(7).text(h, cols[i], tY, { width: cols[i+1] ? cols[i+1]-cols[i]-5 : 60 }); });
        hline(tY + 12);
        vals1.forEach((val, i) => { doc.font("Helvetica").fontSize(8).text(val, cols[i], tY + 15, { width: cols[i+1] ? cols[i+1]-cols[i]-5 : 60 }); });
        hline(tY + 28);
        const row2Headers = ["Cektigi Su", "Radyo frekansı", "IMO No", "Geldigi Liman", "Gidecegi Liman"];
        const row2Vals = [`${(v as any).draft || "..."}M`, (v as any).callSign || "...", imo, (v as any).lastPort || liman, (v as any).nextPort || "..."];
        row2Headers.forEach((h, i) => { doc.font("Helvetica-Bold").fontSize(7).text(h, cols[i], tY + 32, { width: cols[i+1] ? cols[i+1]-cols[i]-5 : 60 }); });
        hline(tY + 44);
        row2Vals.forEach((val, i) => { doc.font("Helvetica").fontSize(8).text(val, cols[i], tY + 47, { width: cols[i+1] ? cols[i+1]-cols[i]-5 : 60 }); });
        hline(tY + 60);
        doc.fontSize(8).font("Helvetica-Bold").text("Acente ve Kumpanya", 50, tY + 64);
        doc.font("Helvetica").text(ACENTE_ADI.split(" ")[0] + " DENIZCILIK", 180, tY + 64, { continued: true });
        doc.font("Helvetica-Bold").text("    " + ((v as any).ownerName || "..."), { continued: false });
        hline(tY + 76);
        doc.font("Helvetica-Bold").fontSize(8).text("Gemi Vinclerinin Kapasitesi", 50, tY + 79);
        doc.font("Helvetica").text("YOK", 180, tY + 79, { continued: true });
        doc.font("Helvetica-Bold").text("    Yanasma sekli", 300, tY + 79, { continued: true });
        doc.font("Helvetica").text(": ISKELE / SANCAK", { continued: false });
        hline(tY + 91);
        doc.fontSize(8).font("Helvetica").text(`Acentemize bagli, adi ve ozellikleri yukarida yazili gemi    ${eta}    HRS    ${(v as any).cargoQuantity || "..."} MTON    ${(v as any).cargoType || "..."}  Tarihinde limanımıza gelmistir/gelecektir. Bosaltilacak/yuklenecek- Limanınıza, yukletilmesi /-bosaltilmasi bu yuke ait tasdikli orijinal manifesto ile (3) Türkce kopyasi ve kargo plani iliskite verilmistir. Ambar kapaklari limanımızca/ tarafimizca acilacak ve kapatilacaktir. Geminin agir ve vinc donanimi tarafimizca yapilacaktir.`, 50, tY + 95, { width: 495 });
        doc.moveDown(1.5);
        doc.font("Helvetica-Bold").fontSize(8).text(`Gemiden: ${(v as any).cargoQuantity || "..."} MTON    ${(v as any).cargoType || "..."}  tahliyesi / yuklemesi-yapilacaktir.`);
        doc.moveDown(1.5);
        // Cargo table header
        doc.fontSize(7).font("Helvetica-Bold");
        const cargoColX = [50, 130, 180, 220, 260, 310, 360, 400, 440, 480];
        doc.text("BOSALTMA", 50, doc.y, { width: 210 });
        doc.text("YUKLEME", 310, doc.y, { width: 210 });
        const cY = doc.y + 14;
        ["Dolu","Bos","RO-RO","Dolu","Bos","RO-RO"].forEach((h, i) => { doc.text(h, 50 + i * 70, cY, { width: 65 }); });
        hline(cY + 12);
        ["20'lik","40'lik","20'lik","40'lik","","20'lik","40'lik","20'lik","40'lik",""].forEach((h, i) => {
          if (i < 10) doc.text(h, 50 + i * 50, cY + 15, { width: 45 });
        });
        hline(cY + 27);
        ["===","===","===","===","===","===","===","===","===","==="].forEach((h, i) => {
          doc.text(h, 50 + i * 50, cY + 30, { width: 45 });
        });
        doc.moveDown(2.5);
        doc.font("Helvetica-Bold").text("A.B.  YOK", 50, doc.y, { continued: true });
        doc.text("A.Y.  YOK          0", 310, doc.y);
        doc.moveDown(1);
        doc.fontSize(7.5).font("Helvetica").text("Yukarida adi gecen geminin-bosaltmasi/-yukletilmesi hususunda;", 50);
        doc.text("a) TCDD isletmesi Liman ve iskeleler tarifesi hukumleri ile liman iskelelerine iliskin sair mevzuatin tatbikini,", 50, doc.y + 3);
        doc.text("b) Gunun 24 saat devam edebilecek calisma saatlerine uymay,", 50, doc.y + 3);
        doc.text("c) Limaninin yukleme/bosaltma kapasitesine gore yukleme ve bosaltma vasitasi bulundurmayi ve aksi takdirde Mudurlugunuzu kendi kapasitesine uygun yuklemeyi ve bosaltmayi temin hususunda alacagi tedbirleri kabul ve bunlara ait bilcumle ucret ve masraflari ödemeyi,", 50, doc.y + 3, { width: 495 });
        doc.text("d) Idarece zaruri goruldugu hallerde gemi ve vasitanin yukleme ve bosaltma kapasitesini arttrima bakimindan alacaginiz her turlu tedbirleri pesinen kabul ve taahhut ederiz.", 50, doc.y + 3, { width: 495 });
        doc.moveDown(0.8);
        doc.text("Vasita talebi, cer hizmeti, tatli su verilmesi, kilavuzluk ve romorkör isleri.. v.s. gibi Liman Idareleri'nin her turlu is sahipleri tarafindan bu madde yazilir.", 50, doc.y, { width: 495 });
        doc.moveDown(1);
        doc.font("Helvetica-Bold").fontSize(9).text("Acente Yetkilisi", 380, doc.y);
        doc.text(ACENTE_YETKILI, 380, doc.y + 12);
        doc.moveDown(1);
        hline();
        doc.fontSize(7.5).font("Helvetica").text(`Defter sira no: (      )`, 50, doc.y + 5);
        doc.text(`( 274.42 ) JTL lik damga vergisi tarafimizdan makbuz karsiligi odenecektir.`, 50, doc.y + 3);

      // =====================================================================
      } else if (templateId === "tcdd_watch_table") {
        doc.fontSize(10).font("Helvetica-Bold").text("TURKIYE T.C.D.D. ISLETMELERI", 50, 50);
        doc.text("Izmir Isletmesi", 50, 66);
        // Main table — anchored at absolute y=95 (Rule 1: absolute sizing)
        const tX = 50, tW = 495, tTop = 95;
        doc.rect(tX, tTop, tW, 310).stroke();
        // Three main columns: BOSALTMA (0-165), YUKLEME (165-330), NOT (330-495)
        doc.fontSize(8).font("Helvetica-Bold")
          .text("BOSALTMA YAPAN VAPURUN", tX + 2, tTop + 5, { width: 161, align: "center" });
        doc.moveTo(tX + 165, tTop).lineTo(tX + 165, tTop + 310).stroke();
        doc.text("YUKLEME YAPAN VAPURUN", tX + 167, tTop + 5, { width: 161, align: "center" });
        doc.moveTo(tX + 330, tTop).lineTo(tX + 330, tTop + 310).stroke();
        doc.text("NOT", tX + 332, tTop + 5, { width: 163, align: "center" });
        // Sub-header row at tTop+22
        const subY = tTop + 22;
        doc.moveTo(tX, subY).lineTo(tX + tW, subY).stroke();
        // Left (BOSALTMA) 4 sub-cols — each 41pt wide within 165pt
        // Sub-col separators at tX+41, tX+82, tX+123
        const subLabels = ["Isim ve\nBandirasi", "Mevki/\nBolge", "Istenilen\nAmele\nPostasi", "Istenecek\nAmele\nPostasi"];
        subLabels.forEach((h, i) => {
          doc.fontSize(6.5).font("Helvetica-Bold").text(h, tX + i * 41 + 2, subY + 2, { width: 38, lineBreak: true });
          if (i < 3) doc.moveTo(tX + (i + 1) * 41, subY).lineTo(tX + (i + 1) * 41, tTop + 310).stroke();
        });
        // Right (YUKLEME) 4 sub-cols — same layout starting at tX+165
        subLabels.forEach((h, i) => {
          doc.fontSize(6.5).font("Helvetica-Bold").text(h, tX + 165 + i * 41 + 2, subY + 2, { width: 38, lineBreak: true });
          if (i < 3) doc.moveTo(tX + 165 + (i + 1) * 41, subY).lineTo(tX + 165 + (i + 1) * 41, tTop + 310).stroke();
        });
        // Data row — absolute y=subY+50 (Rule 1)
        const dataY = subY + 50;
        doc.fontSize(8).font("Helvetica");
        // BOSALTMA col0 (Isim/Bandira): gemi name + flag
        doc.text(gemi, tX + 2, dataY, { width: 39 });
        doc.text(bayrak, tX + 2, dataY + 22, { width: 39 });
        // BOSALTMA col1 (Mevki/Bolge): berth location
        doc.text((v as any).berthName || "ALS", tX + 43, dataY, { width: 38 });
        // Footer note — anchored at absolute y (Rule 4)
        doc.fontSize(8).font("Helvetica")
          .text(`${today} tarihinde bosaltmasi icin istenilen amele postalarinin gonderilmesini rica ederiz.`, tX + 2, tTop + 240, { width: 280 });
        doc.font("Helvetica-Bold").text(ACENTE_YETKILI, tX + 2, tTop + 275);

      // =====================================================================
      } else if (templateId === "port_arrival") {
        doc.fontSize(10).font("Helvetica-Bold").text("IZMIR BOLGE LIMAN BASKANLIGI'NA", 50, 50);
        doc.fontSize(9).font("Helvetica").text(todayFull, 430, 50);
        doc.moveDown(1);
        doc.fontSize(11).font("Helvetica-Bold").text("GEMI GELIS BILDIRIMI", 0, doc.y, { align: "center", width: 595 });
        doc.moveDown(0.8);
        hline();
        const gaFields: [string, string][] = [
          ["GEMI ADI", gemi],
          ["IMO NO", imo],
          ["BAYRAK", bayrak],
          ["GEMI CINSI", (v as any).vesselType || "..."],
          ["NRT/GRT/DWT", `${nrt}/     ${grt}/     ${(v as any).dwt || "..."}`],
          ["GELIS LIMANI TARIHI", `${liman}                ${eta}`],
          ["GIDIS LIMANI TARIHI", `${(v as any).nextPort || "..."}                ${etd}`],
          ["YUKUN ADI (ISLEM/YUK CINSI/MIKTAR)", `TRANSIT: ${(v as any).cargoType || "..."} | BOSALTMA: ${(v as any).cargoType || "..."}  ${(v as any).cargoQuantity || "..."} MTON`],
          ["TAM BOY", `${(v as any).loa || "..."},${(v as any).loa ? "" : "42"} M`],
          ["MMSI NO/CAGRI ISARETLERI", `${(v as any).mmsi || "..."}     ${(v as any).callSign || "..."}`],
          ["YANASACAGI LIMAN TESISI", (v as any).berthName || "ALSANCAK"],
          ["GEMININ GELIS DRAFTI", `${(v as any).draft || "..."} M`],
          ["BOW-THRUSTER", "BAS: YOK    KIC: YOK"],
          ["KLAS KURULUSU", (v as any).classificationSociety || "LLOYD'S REGISTER"],
          ["SON ONSÖRVEY TARIHI VE LIMANI", (v as any).lastSurvey || "..."],
          ["SON AKDENIZ MEMORANDUMU LIMAN DEVLETI KONTROL YERI ve TARIHI", "YOK"],
          ["GEMININ HERHANGI BIR TECHIZAT/GEMIADAMI ICIN BAYRAK DEVLETI VEYA KLAS MUAFIYETI VAR MI?", "YOK"],
        ];
        let gaY = doc.y + 5;
        gaFields.forEach(([label, val]) => {
          if (gaY > 650) return;
          doc.font("Helvetica-Bold").fontSize(8).text(label, 50, gaY, { width: 220 });
          doc.font("Helvetica").fontSize(8).text(val, 275, gaY, { width: 270 });
          hline(gaY + 14, 50, 545);
          gaY += 16;
        });
        doc.fontSize(7).font("Helvetica")
          .text("Yukarida ozellikleri belirtilen geminin, donataninin, sirketinin GKRY ile ilgisinin olmadigi, GKRY limanlarindan TURKIYE limanlarindan Yuk-Yolcu getirip gotürmedigimizi, mevcut yuklerimiz icerisinde limanlarimiza inecek yukler arasindan GKRY kokenli yuk bulunmadigini, ayrica limanımıza ugrayacak gemimizin cikis noktasinin KIRIM BOLGESI limanlar olmadigi, limandan KIRIM BOLGESI limanlarinaa cikamayacagini, KIRIM ibarelerini tasıyan gumruk, liman ve ticaret belgelerine UKRAYNA ibaresi icerseler dahi ulkemiz makamlarinda hicbir islem yapmayacagimizi, herhangi bir sekilde yukaridaki hususlara aykiri durumun tespiti halinde tum liman masraflari ve hukuki sorumluluklarin acentemize ait olacagini beyan ve taahhut eder gemimizin gelis/gidis islemlerinin yapilmasini Armator ve gemi Kaptani adina arz ederiz.", 50, gaY + 5, { width: 495 });
        gaY += 70;
        doc.font("Helvetica-Bold").fontSize(8).text("ACENTE BILGILERI", 50, gaY);
        const aInfo: [string, string][] = [
          ["ACENTE ADI", ACENTE_ADI],
          ["SICIL NO", "89899"],
          ["ADRES", "ALSANCAK/IZMIR"],
          ["TELEFON(GSM)", "5323742840"],
          ["FAKS/MAIL", "operation@selimshipping.com"],
          ["VERGI DAIRESI / VERGI NO", "KORDON / 7600137148"],
        ];
        gaY += 14;
        aInfo.forEach(([l, val]) => {
          doc.font("Helvetica-Bold").fontSize(8).text(l, 50, gaY);
          doc.font("Helvetica").text(val, 200, gaY);
          gaY += 13;
        });
        doc.moveDown(1);
        doc.fontSize(7.5).font("Helvetica")
          .text("Acente Yetkili Personelinin Kimlik Belgesi Sicil No:38987", 350, gaY + 5);
        doc.text("Gecerlilik Tarihi:26.04.2029", 350, gaY + 18);
        doc.text(`Adi/Soyadi:${ACENTE_YETKILI}`, 350, gaY + 31);

      // =====================================================================
      } else if (templateId === "shore_pass") {
        hline(50, 50, 545);
        doc.fontSize(11).font("Helvetica-Bold").text("LIMAN SEHRI GEZER BELGESI IZIN TALEP DILEKÇESI", 0, 58, { align: "center", width: 595 });
        doc.fontSize(9).font("Helvetica").text("REQUEST SHORE PASS (LANDING CARD)", 0, 74, { align: "center", width: 595 });
        doc.fontSize(10).font("Helvetica-Bold").text("DENIZ LIMAN SUBE MUDURLUGU'NE", 0, 90, { align: "center", width: 595 });
        doc.fontSize(9).font("Helvetica").text("MARINE BORDER IMMIGRATION OFFICE", 0, 105, { align: "center", width: 595 });
        hline(120, 50, 545);
        doc.fontSize(9).font("Helvetica").text("IZMIR", 430, 128);
        doc.text(today, 430, 142);
        const spFields: [string, string, string][] = [
          ["GEMININ ADI", "(VESSEL NAME)", gemi],
          ["IMO NO", "", imo],
          ["GEMININ BAYRAGI", "(FLAG)", bayrak],
          ["YANASACAGI LIMAN VEYA DEMIR YERI", "(PORT)", (v as any).berthName || "ALSANCAK"],
          ["GELDIGI LIMAN", "(ARRIVED FROM)", (v as any).lastPort || liman],
          ["GELDIGI TARIH VE SAAT", "(ARRIVAL DATE /TIME)", eta],
          ["LIMANIZDA KALACAGI SURE", "(STAY AT PORT)", ""],
          ["TOPLAM PERSONEL SAYISI", "(CREW MEMBERS TOTAL)", "..."],
        ];
        let spY = 155;
        spFields.forEach(([tr2, en2, val]) => {
          doc.font("Helvetica-Bold").fontSize(8).text(tr2, 50, spY);
          doc.font("Helvetica").fontSize(7).fillColor("#555").text(en2, 50, spY + 9);
          doc.fillColor("#000").fontSize(8).text(`: ${val}`, 300, spY, { width: 230 });
          hline(spY + 18, 50, 545);
          spY += 20;
        });
        // Crew list box
        // crewBoxY locked to absolute y=320 (Rule 1 + Rule 4 — deterministic, not flow-based)
        const crewBoxY = 320;
        doc.rect(50, crewBoxY, 245, 350).stroke();
        doc.rect(295, crewBoxY, 250, 350).stroke();
        doc.fontSize(8).font("Helvetica-Bold")
          .text("KART TALEBINDE BULUNAN PERSONEL ISIMLERI", 52, crewBoxY + 10, { width: 241 });
        doc.fontSize(7).font("Helvetica")
          .text("(NAME OF THE CREW MEMBERS TO WHOM", 52, crewBoxY + 35, { width: 241 });
        for (let i = 1; i <= 26; i++) {
          const lineY = crewBoxY + 10 + i * 13;
          if (lineY > crewBoxY + 342) break;
          doc.fontSize(8).text(`${i}`, 298, lineY);
          doc.moveTo(310, lineY + 8).lineTo(540, lineY + 8).strokeColor("#cccccc").lineWidth(0.3).stroke();
          doc.strokeColor("#000000").lineWidth(1);
        }
        // Bottom section anchored absolutely (Rule 4: bottom anchoring — y=680 keeps sigs above y=828 footer)
        const botY = 680;
        doc.fontSize(7.5).font("Helvetica")
          .text("YUKARIDAKI BILGILERIN DOGRULIGUNU TAAHHUT EDER, ISIMLERI BILDIRILEN GEMI PERSONELI NE LIMAN SEHRI IZIN BELGESI VERILMESI HUSUSUNDA (I COMFIRM THAT ABOVE DETAILED INFORMATIONS ARE CORRECT AND KINDLY REGUEST TO DELIVER US SHORE PASS FOR VISITING CITY)", 50, botY, { width: 495 });
        doc.text(today, 430, botY + 35);
        doc.rect(50, botY + 50, 200, 45).stroke();
        doc.rect(295, botY + 50, 250, 45).stroke();
        doc.fontSize(7.5).font("Helvetica-Bold").text("ACENTE YETKILI IMZASI (AGENCY SIGNATURE)", 52, botY + 52, { width: 196 });
        doc.text("GEMI KAPTANI (MASTER)", 297, botY + 52, { width: 246 });
        doc.rect(50, botY + 95, 200, 25).stroke();
        doc.rect(295, botY + 95, 250, 25).stroke();
        doc.fontSize(7.5).text("ADI SOYADI (NAME, SURNAME)", 52, botY + 97, { width: 196 });
        doc.text("ADI SOYADI (NAME, SURNAME)", 297, botY + 97, { width: 246 });
        doc.rect(50, botY + 120, 200, 20).stroke();
        doc.rect(295, botY + 120, 250, 20).stroke();
        doc.text("ACENTE KASEI (AGENCY STAMP)", 52, botY + 122, { width: 196 });
        doc.text("IMZA KASE (SHIP STAMP, SIGNATURE)", 297, botY + 122, { width: 246 });
      }

      // Apply footer to all pages (safe y=820 — below selimFooter at y=823, above page bottom 841.89)
      const range = doc.bufferedPageRange();
      for (let p = 0; p < range.count; p++) {
        doc.switchToPage(range.start + p);
        doc.fontSize(6).fillColor("#888888")
          .text(`Auto-generated by VesselPDA · ${today} · ${tmpl.tr}`, 50, 828, { align: "center", width: 495, lineBreak: false });
      }

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const safeName = `${templateId}_${(gemi).replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    const pdfBase64 = pdfBuffer.toString("base64");

    try {
      let fileUrl = "";
      try {
        const uploadsDir = path.join(process.cwd(), "uploads", "documents");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(path.join(uploadsDir, safeName), pdfBuffer);
        fileUrl = `/uploads/documents/${safeName}`;
      } catch (fsErr) {
        console.warn("[generate-port-document] filesystem save failed (ephemeral env?), continuing with base64 only:", fsErr);
      }
      await storage.createVoyageDocument({
        voyageId,
        name: `${tmpl.tr} — ${gemi}`,
        docType: "port_clearance",
        fileBase64: pdfBase64,
        fileUrl: fileUrl || null,
        fileName: safeName,
        fileSize: pdfBuffer.length,
        notes: `Auto-generated port form (${tmpl.en})`,
        uploadedByUserId: userId,
        version: 1,
        templateId: null,
      } as any);
    } catch (saveErr) {
      console.error("[generate-port-document] save error:", saveErr);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Encoding", "identity");
    res.end(pdfBuffer);
  } catch (err) {
    console.error("[generate-port-document] error:", err);
    res.status(500).json({ message: "Failed to generate port document" });
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
    const { logDate, shift, fromTime, toTime, remarks, logType, entries, amountHandled, receiverId, truckCount } = req.body;
    const resolvedLogType = logType || "operation";
    const batchId = crypto.randomUUID();
    const fromDt = fromTime ? new Date(fromTime) : (logDate ? new Date(logDate) : new Date());
    const toDt = toTime ? new Date(toTime) : undefined;

    // Operation with multi-receiver entries array
    if (resolvedLogType === "operation" && Array.isArray(entries) && entries.length > 0) {
      const validEntries = entries.filter((e: any) => e.amountHandled && Number(e.amountHandled) > 0);
      if (validEntries.length === 0) return res.status(400).json({ message: "At least one entry with amount required" });
      const rows = await db.insert(voyageCargoLogs).values(
        validEntries.map((e: any) => ({
          voyageId,
          logDate: fromDt,
          shift: shift || null,
          fromTime: fromDt,
          toTime: toDt,
          receiverId: e.receiverId ? Number(e.receiverId) : undefined,
          amountHandled: Number(e.amountHandled),
          truckCount: e.truckCount ? Number(e.truckCount) : undefined,
          batchId,
          logType: resolvedLogType,
          remarks: remarks || null,
          createdBy: userId,
        }))
      ).returning();
      return res.status(201).json(rows);
    }

    // Delay or legacy single-entry
    const singleAmount = amountHandled != null ? Number(amountHandled) : 0;
    const [log] = await db.insert(voyageCargoLogs).values({
      voyageId,
      logDate: fromDt,
      shift: shift || null,
      fromTime: fromDt,
      toTime: toDt,
      receiverId: receiverId ? Number(receiverId) : undefined,
      amountHandled: singleAmount,
      truckCount: truckCount ? Number(truckCount) : undefined,
      batchId,
      logType: resolvedLogType,
      remarks: remarks || null,
      createdBy: userId,
    }).returning();
    res.status(201).json([log]);
  } catch (err) {
    console.error("cargo-logs POST error:", err);
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

// Delete all logs in a batch (by batchId)
router.delete("/:id/cargo-logs/batch/:batchId", isAuthenticated, async (req: any, res) => {
  try {
    await db.delete(voyageCargoLogs).where(eq(voyageCargoLogs.batchId, req.params.batchId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to delete cargo log batch" });
  }
});

router.post("/:id/send-cargo-report", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { toEmails } = req.body;
    const emails: string[] = Array.isArray(toEmails) ? toEmails.filter((e: string) => String(e).includes("@")) : [];
    if (emails.length === 0) return res.status(400).json({ message: "At least one valid email required" });
    const { sendCargoReportEmail } = await import("../email");
    const ok = await sendCargoReportEmail({ toEmails: emails, voyageId });
    if (!ok) return res.status(500).json({ message: "Failed to send report email" });
    res.json({ ok: true });
  } catch (err) {
    console.error("send-cargo-report error:", err);
    res.status(500).json({ message: "Failed to send cargo report" });
  }
});

// ─── VOYAGE CONTACTS CRUD ─────────────────────────────────────────────────────

router.get("/:id/contacts", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const list = await db.select().from(voyageContacts)
      .where(eq(voyageContacts.voyageId, voyageId))
      .orderBy(asc(voyageContacts.createdAt));
    res.json(list);
  } catch {
    res.status(500).json({ message: "Failed to fetch contacts" });
  }
});

router.post("/:id/contacts", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { email, name, role, includeInDailyReports } = req.body;
    if (!email || !String(email).includes("@")) return res.status(400).json({ message: "Valid email required" });
    const [contact] = await db.insert(voyageContacts).values({
      voyageId,
      email: String(email).trim().toLowerCase(),
      name: name ? String(name).trim() : null,
      role: role || "other",
      includeInDailyReports: includeInDailyReports !== false,
    }).returning();
    res.json(contact);
  } catch {
    res.status(500).json({ message: "Failed to add contact" });
  }
});

router.post("/:id/contacts/bulk", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.id);
    const { emails: rawText } = req.body;
    if (!rawText) return res.status(400).json({ message: "emails text required" });

    const parsed = String(rawText)
      .split(/[,;\n\r]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.includes("@") && s.includes("."));
    const unique = [...new Set(parsed)];

    const existing = await db.select({ email: voyageContacts.email })
      .from(voyageContacts).where(eq(voyageContacts.voyageId, voyageId));
    const existingSet = new Set(existing.map(e => e.email));

    const toInsert = unique.filter(e => !existingSet.has(e));
    if (toInsert.length === 0) return res.json({ inserted: 0, skipped: unique.length });

    const inserted = await db.insert(voyageContacts).values(
      toInsert.map(email => ({ voyageId, email, role: "other", includeInDailyReports: true }))
    ).returning();
    res.json({ inserted: inserted.length, skipped: unique.length - inserted.length, contacts: inserted });
  } catch (err) {
    console.error("bulk contacts error:", err);
    res.status(500).json({ message: "Failed to bulk import contacts" });
  }
});

router.patch("/:id/contacts/:contactId", isAuthenticated, async (req: any, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const { role, includeInDailyReports, name, email } = req.body;
    const updates: Record<string, unknown> = {};
    if (role !== undefined) updates.role = role;
    if (includeInDailyReports !== undefined) updates.includeInDailyReports = includeInDailyReports;
    if (name !== undefined) updates.name = name ? String(name).trim() : null;
    if (email !== undefined && String(email).includes("@")) updates.email = String(email).trim().toLowerCase();
    const [updated] = await db.update(voyageContacts).set(updates).where(eq(voyageContacts.id, contactId)).returning();
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update contact" });
  }
});

router.delete("/:id/contacts/:contactId", isAuthenticated, async (req: any, res) => {
  try {
    await db.delete(voyageContacts).where(eq(voyageContacts.id, parseInt(req.params.contactId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to delete contact" });
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
