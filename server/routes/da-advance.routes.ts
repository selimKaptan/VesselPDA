import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { sendDaAdvanceRequestEmail } from "../email";
import { db } from "../db";
import { daAdvances, voyages } from "@shared/schema";
import { eq } from "drizzle-orm";
import { addPdfHeader, addPdfFooter } from "../proforma-pdf";

const router = Router();

router.get("/:id/pdf", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const advanceId = parseInt(req.params.id);
    const [advance] = await db.select().from(daAdvances).where(eq(daAdvances.id, advanceId)).limit(1);
    if (!advance) return res.status(404).json({ error: "DA Advance not found" });

    const voyage = advance.voyageId ? (await db.select().from(voyages).where(eq(voyages.id, advance.voyageId)).limit(1))[0] : null;

    const userId = req.user?.claims?.sub || req.user?.id;
    const companyProfile = userId ? await storage.getCompanyProfileByUser(userId) : null;

    const PDFDocumentModule = await import("pdfkit");
    const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>(async (resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
      try {
        await addPdfHeader(doc, companyProfile || null, "DA ADVANCE REQUEST");

        doc.fontSize(9).font("Helvetica").fillColor("#333");
        doc.text(`Reference: #ADV-${advance.id}`, 50, doc.y, { width: 240 });
        doc.text(`Date: ${advance.createdAt ? new Date(advance.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}`, 50, doc.y + 2, { width: 240 });
        if (advance.dueDate) {
          doc.text(`Due Date: ${new Date(advance.dueDate).toLocaleDateString("en-GB")}`, 50, doc.y + 2, { width: 240 });
        }
        doc.text(`Status: ${(advance.status || "pending").replace("_", " ").toUpperCase()}`, 50, doc.y + 2, { width: 240 });
        doc.fillColor("#000").moveDown(1);

        if (advance.principalName || advance.recipientEmail) {
          doc.font("Helvetica-Bold").fontSize(9).text("REQUESTED FROM:", 50, doc.y);
          doc.font("Helvetica").fontSize(9);
          if (advance.principalName) doc.text(advance.principalName, 50, doc.y + 2);
          if (advance.recipientEmail) doc.text(advance.recipientEmail, 50, doc.y + 2);
          doc.moveDown(1);
        }

        // Vessel / Voyage Info
        if (voyage) {
          doc.font("Helvetica-Bold").fontSize(9).text("VESSEL / VOYAGE DETAILS:", 50, doc.y);
          doc.font("Helvetica").fontSize(9);
          doc.text(`Vessel: ${voyage.vesselName || "—"}`, 50, doc.y + 2);
          if (voyage.imoNumber) doc.text(`IMO: ${voyage.imoNumber}`, 50, doc.y + 2);
          doc.moveDown(1);
        }

        doc.font("Helvetica-Bold").fontSize(8);
        const y = doc.y;
        doc.rect(50, y, 495, 16).fill("#e8edf4");
        doc.fillColor("#1e3a5f");
        doc.text("DESCRIPTION", 54, y + 4, { width: 320 });
        doc.text("AMOUNT", 374, y + 4, { width: 165, align: "right" });
        doc.y = y + 20;
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fillColor("#333").font("Helvetica").fontSize(9);
        const iy = doc.y;
        doc.text(advance.title || `DA Advance #${advance.id}`, 54, iy, { width: 320 });
        doc.font("Helvetica-Bold").fillColor("#1e3a5f");
        doc.text(`${advance.currency || "USD"} ${Number(advance.requestedAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 374, iy, { width: 165, align: "right" });
        doc.moveDown(1);

        doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1.5).stroke().lineWidth(1);
        doc.moveDown(0.5);

        // Progress / Totals
        const requested = Number(advance.requestedAmount || 0);
        const received = Number(advance.receivedAmount || 0);
        const outstanding = requested - received;
        const progress = requested > 0 ? Math.round((received / requested) * 100) : 0;

        doc.font("Helvetica-Bold").fontSize(9);
        doc.fillColor("#333").text("Total Requested:", 300, doc.y, { width: 120, align: "right" });
        doc.text(`${advance.currency} ${requested.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 425, doc.y - 9, { width: 120, align: "right" });
        
        doc.moveDown(0.2);
        doc.text("Total Received:", 300, doc.y, { width: 120, align: "right" });
        doc.fillColor("#10b981").text(`${advance.currency} ${received.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 425, doc.y - 9, { width: 120, align: "right" });

        doc.moveDown(0.2);
        doc.fillColor("#333").text("Outstanding Balance:", 300, doc.y, { width: 120, align: "right" });
        doc.fillColor("#f59e0b").text(`${advance.currency} ${outstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 425, doc.y - 9, { width: 120, align: "right" });
        
        doc.moveDown(0.5);
        doc.fillColor("#333").fontSize(8).text(`Funding Progress: ${progress}% received`, 300, doc.y, { width: 245, align: "right" });
        doc.moveDown(1.5);

        if (advance.notes) {
          doc.font("Helvetica-Bold").fontSize(8).text("NOTES:", 50, doc.y);
          doc.font("Helvetica").fontSize(8).text(advance.notes, 50, doc.y + 2, { width: 495 });
          doc.moveDown(1);
        }

        if (advance.bankDetails) {
          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor("#b0b8c4").stroke().lineWidth(1).strokeColor("black");
          doc.moveDown(0.5);
          const bankY = doc.y;
          doc.rect(50, bankY, 495, 14).fill("#e8edf4");
          doc.fillColor("#1e3a5f").fontSize(8.5).font("Helvetica-Bold").text("BANK DETAILS FOR REMITTANCE", 54, bankY + 3);
          doc.y = bankY + 18;
          doc.fillColor("#333").fontSize(8).font("Helvetica");
          doc.text(advance.bankDetails, 54, doc.y, { width: 480 });
        }

        addPdfFooter(doc, companyProfile || null);
        doc.end();
      } catch (err) { reject(err); }
    });

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="DA-Advance-${advanceId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
});

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : undefined;
    const advances = voyageId
      ? await storage.getDaAdvancesByVoyage(voyageId)
      : await storage.getDaAdvancesByUser(userId);
    res.json(advances);
  } catch {
    res.status(500).json({ message: "Failed to fetch DA advances" });
  }
});

router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const body = { ...req.body };
    if (!body.dueDate) body.dueDate = null;
    if (!body.voyageId) body.voyageId = null;
    if (!body.proformaId) body.proformaId = null;
    const advance = await storage.createDaAdvance({ ...body, userId });

    if (advance.recipientEmail) {
      const user = await storage.getUser(userId);
      sendDaAdvanceRequestEmail({
        toEmail: advance.recipientEmail,
        toName: advance.principalName || advance.recipientEmail,
        agentName: user ? `${user.firstName || ""} ${(user as any).lastName || ""}`.trim() : "Agent",
        vesselName: req.body.vesselName || "Vessel",
        amount: advance.requestedAmount,
        currency: advance.currency,
        dueDate: advance.dueDate ? new Date(advance.dueDate).toLocaleDateString("en-GB") : undefined,
        bankDetails: advance.bankDetails || undefined,
        notes: advance.notes || undefined,
        title: advance.title,
      }).catch((e: any) => console.error("[email] DA advance email failed:", e));
    }

    res.status(201).json(advance);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create DA advance", error: err?.message });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const advance = await storage.updateDaAdvance(parseInt(req.params.id), req.body);
    res.json(advance);
  } catch {
    res.status(500).json({ message: "Failed to update DA advance" });
  }
});

router.post("/:id/record-payment", isAuthenticated, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const { amount } = req.body;
    const existing = await storage.getDaAdvance(id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const newReceived = (existing.receivedAmount || 0) + parseFloat(amount);
    let status = "partially_received";
    if (newReceived >= existing.requestedAmount) status = "fully_received";

    const updated = await storage.updateDaAdvance(id, {
      receivedAmount: newReceived,
      status,
    });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to record payment" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    await storage.deleteDaAdvance(parseInt(req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete DA advance" });
  }
});

export default router;
