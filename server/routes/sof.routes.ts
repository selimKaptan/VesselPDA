import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { db } from "../db";
import { sql as drizzleSql, eq, desc } from "drizzle-orm";
import { statementOfFacts, sofLineItems, insertSofSchema } from "@shared/schema";
import { logAction } from "../audit";
import { logVoyageActivity } from "../voyage-activity";
import { addPdfHeader, addPdfFooter } from "../proforma-pdf";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const portCallId = req.query.portCallId ? parseInt(req.query.portCallId as string) : undefined;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : undefined;
    let sofs;
    if (user?.userRole === "admin") {
      if (portCallId) {
        sofs = await db.select().from(statementOfFacts).where(eq(statementOfFacts.portCallId, portCallId)).orderBy(desc(statementOfFacts.createdAt));
      } else if (voyageId) {
        sofs = await db.select().from(statementOfFacts).where(eq(statementOfFacts.voyageId, voyageId)).orderBy(desc(statementOfFacts.createdAt));
      } else {
        sofs = await db.select().from(statementOfFacts).orderBy(desc(statementOfFacts.createdAt));
      }
    } else {
      if (portCallId) {
        sofs = await db.select().from(statementOfFacts).where(and(eq(statementOfFacts.userId, userId), eq(statementOfFacts.portCallId, portCallId))).orderBy(desc(statementOfFacts.createdAt));
      } else if (voyageId) {
        sofs = await db.select().from(statementOfFacts).where(and(eq(statementOfFacts.userId, userId), eq(statementOfFacts.voyageId, voyageId))).orderBy(desc(statementOfFacts.createdAt));
      } else {
        sofs = await db.select().from(statementOfFacts).where(eq(statementOfFacts.userId, userId)).orderBy(desc(statementOfFacts.createdAt));
      }
    }
    res.json(sofs);
  } catch (error) { next(error); }
});


router.post("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const parsed = insertSofSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    const [sof] = await db.insert(statementOfFacts).values(parsed.data).returning();
    
    if (req.body.voyageId) {
      logVoyageActivity({ 
        voyageId: parseInt(req.body.voyageId), 
        userId, 
        activityType: 'sof_created', 
        title: 'Statement of Facts created' 
      });
    }

    const defaultEvents = [
      { eventType: "vessel_arrived",     eventName: "Vessel Arrived at Port",            sortOrder: 1 },
      { eventType: "nor_tendered",        eventName: "NOR Tendered",                      sortOrder: 2 },
      { eventType: "nor_accepted",        eventName: "NOR Accepted",                      sortOrder: 3 },
      { eventType: "berthing_started",    eventName: "Berthing Commenced",                sortOrder: 4 },
      { eventType: "all_fast",            eventName: "All Fast",                          sortOrder: 5 },
      { eventType: "hoses_connected",     eventName: "Hoses Connected",                   sortOrder: 6 },
      { eventType: "loading_commenced",   eventName: "Loading/Discharging Commenced",     sortOrder: 7 },
      { eventType: "loading_completed",   eventName: "Loading/Discharging Completed",     sortOrder: 8 },
      { eventType: "hoses_disconnected",  eventName: "Hoses Disconnected",                sortOrder: 9 },
      { eventType: "documents_onboard",   eventName: "Documents on Board",               sortOrder: 10 },
      { eventType: "unberthing_started",  eventName: "Unberthing Commenced",             sortOrder: 11 },
      { eventType: "pilot_onboard",       eventName: "Pilot on Board",                   sortOrder: 12 },
      { eventType: "vessel_sailed",       eventName: "Vessel Sailed",                    sortOrder: 13 },
    ];
    for (const evt of defaultEvents) {
      await db.insert(sofLineItems).values({
        sofId: sof.id,
        eventType: evt.eventType,
        eventName: evt.eventName,
        eventDate: new Date(),
        sortOrder: evt.sortOrder,
      });
    }
    res.json(sof);
  } catch (error) { next(error); }
});


router.get("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const sofId = parseInt(req.params.id);
    const [sof] = await db.select().from(statementOfFacts).where(eq(statementOfFacts.id, sofId));
    if (!sof) return res.status(404).json({ error: "SOF not found" });
    const events = await db.select().from(sofLineItems).where(eq(sofLineItems.sofId, sofId)).orderBy(sofLineItems.sortOrder);
    res.json({ ...sof, events });
  } catch (error) { next(error); }
});


router.patch("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const sofId = parseInt(req.params.id);
    const { id: _id, createdAt: _ca, ...rest } = req.body;
    const [updated] = await db.update(statementOfFacts).set({ ...rest, updatedAt: new Date() }).where(eq(statementOfFacts.id, sofId)).returning();
    res.json(updated);
  } catch (error) { next(error); }
});


router.delete("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const sofId = parseInt(req.params.id);
    await db.delete(sofLineItems).where(eq(sofLineItems.sofId, sofId));
    await db.delete(statementOfFacts).where(eq(statementOfFacts.id, sofId));
    res.json({ success: true });
  } catch (error) { next(error); }
});


router.post("/:id/finalize", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const sofId = parseInt(req.params.id);
    const userId = req.user.claims.sub;
    const [updated] = await db.update(statementOfFacts).set({ status: "finalized", finalizedAt: new Date(), updatedAt: new Date() }).where(eq(statementOfFacts.id, sofId)).returning();
    
    if (updated.voyageId) {
      logVoyageActivity({ 
        voyageId: updated.voyageId, 
        userId, 
        activityType: 'sof_finalized', 
        title: 'Statement of Facts finalized' 
      });
    }
    
    res.json(updated);
  } catch (error) { next(error); }
});


router.post("/:id/events", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const sofId = parseInt(req.params.id);
    const { eventType, eventName, eventDate, remarks, laytimeFactor, sortOrder } = req.body;
    const factor = (laytimeFactor !== undefined && laytimeFactor !== null) ? Number(laytimeFactor) : 100;
    const [event] = await db.insert(sofLineItems).values({
      sofId,
      eventType: eventType || "custom",
      eventName: eventName || "Custom Event",
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      remarks: remarks || null,
      laytimeFactor: factor,
      isDeductible: factor < 100,
      deductibleHours: 0,
      sortOrder: sortOrder || 99,
    }).returning();
    res.json(event);
  } catch (error) { next(error); }
});


router.patch("/events/:eventId", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { id: _id, sofId: _sof, createdAt: _ca, ...rest } = req.body;
    if (rest.eventDate) rest.eventDate = new Date(rest.eventDate);
    const [updated] = await db.update(sofLineItems).set(rest).where(eq(sofLineItems.id, eventId)).returning();
    res.json(updated);
  } catch (error) { next(error); }
});


router.delete("/events/:eventId", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const eventId = parseInt(req.params.eventId);
    await db.delete(sofLineItems).where(eq(sofLineItems.id, eventId));
    res.json({ success: true });
  } catch (error) { next(error); }
});


router.get("/:id/pdf", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const sofId = parseInt(req.params.id);
    const [sof] = await db.select().from(statementOfFacts).where(eq(statementOfFacts.id, sofId));
    if (!sof) return res.status(404).json({ error: "SOF not found" });
    const events = await db.select().from(sofLineItems).where(eq(sofLineItems.sofId, sofId)).orderBy(sofLineItems.sortOrder);

    const PDFDocumentModule = await import("pdfkit");
    const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const companyProfile = (sof as any).userId
      ? await storage.getCompanyProfileByUser((sof as any).userId)
      : null;

    await new Promise<void>(async (resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
      try {
        await addPdfHeader(doc, companyProfile || null, "STATEMENT OF FACTS");
        if (sof.status) {
          doc.fontSize(8).font("Helvetica").fillColor("#555")
            .text(`Status: ${(sof.status || "draft").toUpperCase()}`, { align: "center" });
          doc.fillColor("#000");
        }
        doc.moveDown(0.8);

      const infoRows = [
        ["Vessel", sof.vesselName], ["Port", sof.portName], ["Berth", sof.berthName],
        ["Cargo Type", sof.cargoType], ["Cargo Quantity", sof.cargoQuantity],
        ["Operation", sof.operation], ["Master", sof.masterName], ["Agent", sof.agentName],
      ];
      for (const [label, value] of infoRows) {
        if (value) { doc.fontSize(9).font("Helvetica-Bold").text(label + ": ", { continued: true }).font("Helvetica").text(value || ""); }
      }
      doc.moveDown(1);

      doc.font("Helvetica-Bold").fontSize(9);
      const tY = doc.y;
      doc.text("No.", 50, tY, { width: 25 });
      doc.text("EVENT", 80, tY, { width: 200 });
      doc.text("DATE / TIME", 285, tY, { width: 130 });
      doc.text("REMARKS", 420, tY, { width: 125 });
      doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).stroke();
      doc.moveDown(0.6);

      doc.font("Helvetica").fontSize(8);
      events.forEach((evt, i) => {
        if (doc.y > 720) doc.addPage();
        const y = doc.y;
        doc.text(String(i + 1), 50, y, { width: 25 });
        doc.text(evt.eventName, 80, y, { width: 200 });
        doc.text(evt.eventDate ? new Date(evt.eventDate).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-", 285, y, { width: 130 });
        doc.text(evt.remarks || "", 420, y, { width: 125 });
        if (evt.isDeductible) {
          doc.fillColor("#b45309").text(`  ⚠ Deductible: ${evt.deductibleHours || 0}h`, 50, doc.y, { width: 300 }).fillColor("#000");
        }
        doc.moveDown(0.5);
      });

      if (sof.remarks) {
        doc.moveDown(1).font("Helvetica-Bold").fontSize(9).text("Remarks:").font("Helvetica").text(sof.remarks);
      }

      doc.moveDown(3);
      doc.fontSize(8).text("Master / Captain Signature: ________________________________", 50).moveDown(0.5);
      doc.text("Ship Agent Signature: ________________________________", 50);
      addPdfFooter(doc, companyProfile || null);
      doc.end();
      } catch (err) { reject(err); }
    });

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="SOF-${sof.vesselName || sofId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
});


export default router;
