import { Router } from "express";
import { db } from "../db";
import { eq, desc, and } from "drizzle-orm";
import { noticeOfReadiness } from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { storage } from "../storage";
import { logVoyageActivity } from "../voyage-activity";
import { logAction } from "../audit";

const router = Router();

function fmtDT(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// GET /api/nor — list NOR records
router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : undefined;

    let nors;
    if (user?.userRole === "admin") {
      if (voyageId) {
        nors = await db.select().from(noticeOfReadiness)
          .where(eq(noticeOfReadiness.voyageId, voyageId))
          .orderBy(desc(noticeOfReadiness.createdAt));
      } else {
        nors = await db.select().from(noticeOfReadiness)
          .orderBy(desc(noticeOfReadiness.createdAt));
      }
    } else {
      if (voyageId) {
        nors = await db.select().from(noticeOfReadiness)
          .where(and(
            eq(noticeOfReadiness.userId, userId),
            eq(noticeOfReadiness.voyageId, voyageId),
          ))
          .orderBy(desc(noticeOfReadiness.createdAt));
      } else {
        nors = await db.select().from(noticeOfReadiness)
          .where(eq(noticeOfReadiness.userId, userId))
          .orderBy(desc(noticeOfReadiness.createdAt));
      }
    }
    res.json(nors);
  } catch (error) { next(error); }
});

// POST /api/nor — create NOR (draft)
router.post("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const body = req.body;

    let vesselName = body.vesselName || null;
    let portName = body.portName || null;

    if (body.voyageId) {
      const voyage = await storage.getVoyageById(parseInt(body.voyageId));
      if (voyage) {
        if (!vesselName) vesselName = voyage.vesselName || null;
        if (!portName && voyage.portId) {
          const port = await storage.getPort(voyage.portId);
          if (port) portName = port.name;
        }
      }
    }

    const values: any = {
      userId,
      voyageId: body.voyageId ? parseInt(body.voyageId) : null,
      vesselId: body.vesselId ? parseInt(body.vesselId) : null,
      portId: body.portId ? parseInt(body.portId) : null,
      vesselName,
      portName,
      masterName: body.masterName || null,
      agentName: body.agentName || null,
      chartererName: body.chartererName || null,
      cargoType: body.cargoType || null,
      cargoQuantity: body.cargoQuantity || null,
      operation: body.operation || null,
      anchorageArrival: body.anchorageArrival ? new Date(body.anchorageArrival) : null,
      berthArrival: body.berthArrival ? new Date(body.berthArrival) : null,
      norTenderedTo: body.norTenderedTo || null,
      readyTo: Array.isArray(body.readyTo) ? body.readyTo : [],
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      berthName: body.berthName || null,
      remarks: body.remarks || null,
      status: "draft",
    };

    const [nor] = await db.insert(noticeOfReadiness).values(values).returning();

    logAction(userId, "create", "nor", nor.id);

    if (nor.voyageId) {
      logVoyageActivity({
        voyageId: nor.voyageId,
        userId,
        activityType: "nor_tendered",
        title: `NOR created for ${nor.vesselName || "vessel"} at ${nor.portName || "port"}`,
      });
    }

    res.status(201).json(nor);
  } catch (error) { next(error); }
});

// GET /api/nor/:id — NOR detail
router.get("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const norId = parseInt(req.params.id);
    const [nor] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!nor) return res.status(404).json({ message: "NOR not found" });
    res.json(nor);
  } catch (error) { next(error); }
});

// PATCH /api/nor/:id — update NOR
router.patch("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const norId = parseInt(req.params.id);
    const [existing] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!existing) return res.status(404).json({ message: "NOR not found" });
    if (existing.status !== "draft") {
      return res.status(400).json({ message: "Only draft NOR records can be edited" });
    }

    const body = req.body;
    const updates: any = { updatedAt: new Date() };

    const fields = [
      "vesselName", "portName", "masterName", "agentName", "chartererName",
      "cargoType", "cargoQuantity", "operation", "norTenderedTo", "berthName", "remarks",
    ];
    for (const f of fields) {
      if (f in body) updates[f] = body[f] || null;
    }

    const dateFields = ["anchorageArrival", "berthArrival"];
    for (const f of dateFields) {
      if (f in body) updates[f] = body[f] ? new Date(body[f]) : null;
    }

    if ("readyTo" in body) updates.readyTo = Array.isArray(body.readyTo) ? body.readyTo : [];
    if ("conditions" in body) updates.conditions = Array.isArray(body.conditions) ? body.conditions : [];

    const [updated] = await db.update(noticeOfReadiness)
      .set(updates)
      .where(eq(noticeOfReadiness.id, norId))
      .returning();

    res.json(updated);
  } catch (error) { next(error); }
});

// DELETE /api/nor/:id — delete NOR (draft only)
router.delete("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const norId = parseInt(req.params.id);
    const [existing] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!existing) return res.status(404).json({ message: "NOR not found" });
    if (existing.status !== "draft") {
      return res.status(400).json({ message: "Only draft NOR records can be deleted" });
    }
    await db.delete(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

// POST /api/nor/:id/tender — tender the NOR
router.post("/:id/tender", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const norId = parseInt(req.params.id);
    const [existing] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!existing) return res.status(404).json({ message: "NOR not found" });

    const updates: any = {
      norTenderedAt: new Date(),
      status: "tendered",
      updatedAt: new Date(),
    };
    if (req.body?.norTenderedTo) updates.norTenderedTo = req.body.norTenderedTo;

    const [updated] = await db.update(noticeOfReadiness)
      .set(updates)
      .where(eq(noticeOfReadiness.id, norId))
      .returning();

    await storage.createNotification({
      userId,
      type: "nor_tendered",
      title: "NOR Tendered",
      message: `NOR tendered for ${updated.vesselName || "vessel"} at ${updated.portName || "port"}`,
    });

    if (updated.voyageId) {
      logVoyageActivity({
        voyageId: updated.voyageId,
        userId,
        activityType: "nor_tendered",
        title: `NOR tendered at ${updated.portName || "port"}`,
      });
    }

    res.json(updated);
  } catch (error) { next(error); }
});

// POST /api/nor/:id/accept — accept the NOR
router.post("/:id/accept", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const norId = parseInt(req.params.id);
    const [existing] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!existing) return res.status(404).json({ message: "NOR not found" });

    const body = req.body || {};
    const norAcceptedAt = new Date();
    const laytimeStartsAt = body.laytimeStartsAt ? new Date(body.laytimeStartsAt) : norAcceptedAt;

    const [updated] = await db.update(noticeOfReadiness)
      .set({
        norAcceptedAt,
        norAcceptedBy: body.acceptedBy || "Receiver",
        laytimeStartsAt,
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(eq(noticeOfReadiness.id, norId))
      .returning();

    await storage.createNotification({
      userId,
      type: "nor_accepted",
      title: "NOR Accepted",
      message: `NOR accepted — laytime starts at ${fmtDT(laytimeStartsAt)}`,
    });

    if (updated.voyageId) {
      logVoyageActivity({
        voyageId: updated.voyageId,
        userId,
        activityType: "nor_accepted",
        title: `NOR accepted, laytime starts at ${fmtDT(laytimeStartsAt)}`,
      });
    }

    res.json(updated);
  } catch (error) { next(error); }
});

// POST /api/nor/:id/reject — reject the NOR
router.post("/:id/reject", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const norId = parseInt(req.params.id);
    const body = req.body || {};
    if (!body.reason) return res.status(400).json({ message: "Rejection reason is required" });

    const [existing] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!existing) return res.status(404).json({ message: "NOR not found" });

    const [updated] = await db.update(noticeOfReadiness)
      .set({
        status: "rejected",
        rejectionReason: body.reason,
        updatedAt: new Date(),
      })
      .where(eq(noticeOfReadiness.id, norId))
      .returning();

    await storage.createNotification({
      userId,
      type: "nor_rejected",
      title: "NOR Rejected",
      message: `NOR rejected: ${body.reason}`,
    });

    res.json(updated);
  } catch (error) { next(error); }
});

// POST /api/nor/:id/sign — add digital signature
router.post("/:id/sign", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const norId = parseInt(req.params.id);
    const { role, signature } = req.body;
    if (!role || !["master", "agent", "charterer"].includes(role)) {
      return res.status(400).json({ message: "role must be master, agent, or charterer" });
    }
    if (!signature) return res.status(400).json({ message: "signature is required" });

    const [existing] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!existing) return res.status(404).json({ message: "NOR not found" });

    const fieldMap: Record<string, string> = {
      master: "signatureMaster",
      agent: "signatureAgent",
      charterer: "signatureCharterer",
    };

    const [updated] = await db.update(noticeOfReadiness)
      .set({ [fieldMap[role]]: signature, updatedAt: new Date() })
      .where(eq(noticeOfReadiness.id, norId))
      .returning();

    res.json(updated);
  } catch (error) { next(error); }
});

// GET /api/nor/:id/pdf — generate PDF
router.get("/:id/pdf", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const norId = parseInt(req.params.id);
    const [nor] = await db.select().from(noticeOfReadiness).where(eq(noticeOfReadiness.id, norId));
    if (!nor) return res.status(404).json({ message: "NOR not found" });

    const PDFDocumentModule = await import("pdfkit");
    const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    await new Promise<void>((resolve) => {
      doc.on("end", resolve);

      const pageW = 595 - 100;

      // Header
      doc.font("Helvetica-Bold").fontSize(18)
        .text("NOTICE OF READINESS", 50, 50, { align: "center", width: pageW });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).stroke();
      doc.moveDown(0.5);

      // Date & To
      doc.font("Helvetica").fontSize(10);
      doc.text(`Date: ${fmtDT(nor.norTenderedAt) || "Pending"}`, { align: "right" });
      doc.moveDown(0.3);
      doc.text(`To: ${nor.norTenderedTo || "—"}`);
      doc.moveDown(0.8);

      // Body paragraph
      const op = nor.operation === "both" ? "load and discharge"
        : nor.operation === "discharging" ? "discharge" : "load";
      const arrivalDate = fmtDT(nor.berthArrival ?? nor.anchorageArrival) || "N/A";

      doc.font("Helvetica-Oblique").fontSize(10).text(
        `We hereby give you notice that the vessel ${nor.vesselName || "[Vessel]"} arrived at ${nor.portName || "[Port]"} on ${arrivalDate} and is in all respects ready to ${op} a cargo of ${nor.cargoType || "[Cargo Type]"} (${nor.cargoQuantity || "quantity TBC"}).`,
        { lineGap: 4 }
      );
      doc.moveDown(0.6);
      doc.font("Helvetica").text(
        `This Notice of Readiness is tendered at: ${fmtDT(nor.norTenderedAt) || "Pending"}`
      );
      doc.moveDown(0.8);

      // Conditions
      const conditions = (nor.conditions as string[]) || [];
      if (conditions.length > 0) {
        doc.font("Helvetica-Bold").text("Conditions:");
        doc.font("Helvetica");
        for (const c of conditions) {
          doc.text(`  ✓ ${c}`);
        }
        doc.moveDown(0.6);
      }

      // Ready To
      const readyTo = (nor.readyTo as string[]) || [];
      if (readyTo.length > 0) {
        doc.font("Helvetica-Bold").text("Ready to:");
        doc.font("Helvetica").text(`  ${readyTo.join(", ")}`);
        doc.moveDown(0.6);
      }

      // Times table
      doc.font("Helvetica-Bold").text("Key Times:");
      doc.font("Helvetica");
      const times = [
        ["Anchorage Arrival", fmtDT(nor.anchorageArrival)],
        ["Berth Arrival", fmtDT(nor.berthArrival)],
        ["NOR Tendered", fmtDT(nor.norTenderedAt)],
        ["NOR Accepted", fmtDT(nor.norAcceptedAt)],
        ["Laytime Starts", fmtDT(nor.laytimeStartsAt)],
      ];
      for (const [label, val] of times) {
        const y = doc.y;
        doc.text(label, 55, y, { width: 160 });
        doc.text(val, 220, y, { width: 200 });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.4);

      if (nor.berthName) {
        doc.font("Helvetica-Bold").text("Berth: ", { continued: true }).font("Helvetica").text(nor.berthName);
        doc.moveDown(0.3);
      }
      if (nor.remarks) {
        doc.font("Helvetica-Bold").text("Remarks: ", { continued: true }).font("Helvetica").text(nor.remarks);
        doc.moveDown(0.3);
      }

      // Signature blocks
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke();
      doc.moveDown(1);

      const sigY = doc.y;
      const cols = [50, 215, 380];
      const roles = ["Master / Captain", "Ship Agent", "Charterer / Receiver"];
      const sigs = [nor.signatureMaster, nor.signatureAgent, nor.signatureCharterer];

      for (let i = 0; i < 3; i++) {
        doc.font("Helvetica").fontSize(9)
          .text("________________________", cols[i], sigY, { width: 155 });
        doc.font("Helvetica-Bold").fontSize(8)
          .text(sigs[i] || "Signature", cols[i], sigY + 18, { width: 155 });
        doc.font("Helvetica").fontSize(8)
          .text(roles[i], cols[i], sigY + 30, { width: 155 });
        doc.text(`Date: ${sigs[i] ? fmtDT(nor.updatedAt) : ""}`, cols[i], sigY + 42, { width: 155 });
      }

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="NOR-${nor.vesselName || norId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
});

export default router;
