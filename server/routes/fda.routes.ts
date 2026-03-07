import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { db } from "../db";
import { sql as drizzleSql, eq, desc } from "drizzle-orm";
import { fdaAccounts, type FdaLineItem } from "@shared/schema";
import { logAction } from "../audit";
import { logVoyageActivity } from "../voyage-activity";
import { addPdfHeader, addPdfFooter } from "../proforma-pdf";
import { sendFdaReadyEmail } from "../email";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const proformaId = req.query.proformaId ? parseInt(req.query.proformaId as string) : null;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : null;

    let fdas;
    if (voyageId) {
      fdas = await db.select().from(fdaAccounts).where(eq(fdaAccounts.voyageId, voyageId)).orderBy(desc(fdaAccounts.createdAt));
    } else if (proformaId) {
      fdas = await db.select().from(fdaAccounts).where(eq(fdaAccounts.proformaId, proformaId)).orderBy(desc(fdaAccounts.createdAt));
    } else if (user?.userRole === "admin") {
      fdas = await db.select().from(fdaAccounts).orderBy(desc(fdaAccounts.createdAt));
    } else {
      fdas = await db.select().from(fdaAccounts).where(eq(fdaAccounts.userId, userId)).orderBy(desc(fdaAccounts.createdAt));
    }
    res.json(fdas);
  } catch (error) { next(error); }
});


router.post("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const { proformaId } = req.body;
    let lineItems: FdaLineItem[] = [];
    let totalEstimatedUsd = 0;
    let totalEstimatedEur = 0;
    let vesselName = req.body.vesselName || "";
    let portName = req.body.portName || "";
    let vesselId = req.body.vesselId || null;
    let portId = req.body.portId || null;
    let voyageId = req.body.voyageId || null;
    let exchangeRate = req.body.exchangeRate || null;
    let bankDetails = req.body.bankDetails || null;

    if (proformaId) {
      const proforma = await storage.getProformaById(parseInt(proformaId));
      if (proforma) {
        const proformaItems: any[] = (proforma as any).lineItems || [];
        lineItems = proformaItems.map((item: any, index: number) => ({
          id: `fda_${index + 1}`,
          description: item.description || item.name || "",
          category: item.category || "General",
          estimatedUsd: item.amountUsd || 0,
          estimatedEur: item.amountEur || 0,
          actualUsd: 0,
          actualEur: 0,
          varianceUsd: -(item.amountUsd || 0),
          variancePercent: -100,
          remarks: "",
        }));
        totalEstimatedUsd = Number((proforma as any).totalUsd) || 0;
        totalEstimatedEur = Number((proforma as any).totalEur) || 0;
        vesselId = vesselId || (proforma as any).vesselId;
        portId = portId || (proforma as any).portId;
        exchangeRate = exchangeRate || (proforma as any).exchangeRate;
        bankDetails = bankDetails || (proforma as any).bankDetails;
        if ((proforma as any).vessel) vesselName = (proforma as any).vessel.name || vesselName;
        if ((proforma as any).port) portName = (proforma as any).port.name || portName;
      }
    }

    const countRows = await db.select({ cnt: drizzleSql`count(*)` }).from(fdaAccounts);
    const refNumber = `FDA-${new Date().getFullYear()}-${String(Number(countRows[0].cnt) + 1).padStart(4, "0")}`;

    const [fda] = await db.insert(fdaAccounts).values({
      userId,
      proformaId: proformaId ? parseInt(proformaId) : null,
      voyageId,
      vesselId,
      portId,
      referenceNumber: refNumber,
      vesselName,
      portName,
      lineItems,
      totalEstimatedUsd,
      totalActualUsd: 0,
      totalEstimatedEur,
      totalActualEur: 0,
      varianceUsd: -totalEstimatedUsd,
      variancePercent: totalEstimatedUsd ? -100 : 0,
      exchangeRate,
      bankDetails,
      status: "draft",
    }).returning();

    if (voyageId) {
      logVoyageActivity({ 
        voyageId, 
        userId, 
        activityType: 'fda_created', 
        title: `FDA created: ${fda.referenceNumber || 'FDA-' + fda.id}` 
      });
    }

    // Fire-and-forget: notify shipowner that FDA has been created
    (async () => {
      try {
        let shipownerId: string | null = null;
        if (voyageId) {
          const pool = (db as any).$client ?? (db as any).pool;
          if (pool) {
            const { rows } = await pool.query(
              `SELECT user_id FROM voyages WHERE id = $1 LIMIT 1`, [voyageId]
            );
            if (rows?.[0]?.user_id) shipownerId = rows[0].user_id;
          }
        }
        if (shipownerId) {
          const shipowner = await storage.getUser(shipownerId);
          if (shipowner?.email) {
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            await sendFdaReadyEmail({
              toEmail: shipowner.email,
              recipientName: shipowner.firstName || "Valued Customer",
              vesselName: fda.vesselName || "—",
              portName: fda.portName || "—",
              referenceNumber: fda.referenceNumber || `FDA-${fda.id}`,
              estimatedUsd: fda.totalEstimatedUsd || 0,
              actualUsd: fda.totalActualUsd || 0,
              variancePercent: fda.variancePercent || 0,
              fdaUrl: `${baseUrl}/fda/${fda.id}`,
            });
          }
        }
      } catch (e) { console.warn("[fda] FDA created email skipped:", e); }
    })();

    res.json(fda);
  } catch (error) { next(error); }
});


router.get("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const fdaId = parseInt(req.params.id);
    const [fda] = await db.select().from(fdaAccounts).where(eq(fdaAccounts.id, fdaId));
    if (!fda) return res.status(404).json({ error: "FDA not found" });
    res.json(fda);
  } catch (error) { next(error); }
});


router.patch("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const fdaId = parseInt(req.params.id);
    const updates: any = { ...req.body };
    if (updates.lineItems) {
      let totalActualUsd = 0, totalActualEur = 0, totalEstimatedUsd = 0, totalEstimatedEur = 0;
      updates.lineItems = updates.lineItems.map((item: any) => {
        const varianceUsd = (item.actualUsd || 0) - (item.estimatedUsd || 0);
        const variancePercent = item.estimatedUsd ? (varianceUsd / item.estimatedUsd) * 100 : 0;
        totalActualUsd += item.actualUsd || 0;
        totalActualEur += item.actualEur || 0;
        totalEstimatedUsd += item.estimatedUsd || 0;
        totalEstimatedEur += item.estimatedEur || 0;
        return { ...item, varianceUsd, variancePercent: Math.round(variancePercent * 100) / 100 };
      });
      updates.totalActualUsd = totalActualUsd;
      updates.totalActualEur = totalActualEur;
      updates.totalEstimatedUsd = totalEstimatedUsd;
      updates.totalEstimatedEur = totalEstimatedEur;
      updates.varianceUsd = totalActualUsd - totalEstimatedUsd;
      updates.variancePercent = totalEstimatedUsd ? Math.round(((totalActualUsd - totalEstimatedUsd) / totalEstimatedUsd) * 10000) / 100 : 0;
    }
    updates.updatedAt = new Date();
    const [updated] = await db.update(fdaAccounts).set(updates).where(eq(fdaAccounts.id, fdaId)).returning();
    res.json(updated);
  } catch (error) { next(error); }
});


router.delete("/:id", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const fdaId = parseInt(req.params.id);
    await db.delete(fdaAccounts).where(eq(fdaAccounts.id, fdaId));
    res.json({ success: true });
  } catch (error) { next(error); }
});


router.post("/:id/approve", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const fdaId = parseInt(req.params.id);
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const approverName = user?.firstName ? `${user.firstName} ${(user as any).lastName || ""}`.trim() : userId;
    const [updated] = await db.update(fdaAccounts).set({
      status: "approved",
      approvedBy: approverName,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(fdaAccounts.id, fdaId)).returning();

    if (updated.voyageId) {
      logVoyageActivity({ 
        voyageId: updated.voyageId, 
        userId, 
        activityType: 'fda_approved', 
        title: 'FDA approved' 
      });
    }

    // Fire-and-forget: notify the FDA owner (agent) that the FDA has been approved
    (async () => {
      try {
        const fdaOwner = await storage.getUser(updated.userId);
        if (fdaOwner?.email && fdaOwner.id !== userId) {
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          await sendFdaReadyEmail({
            toEmail: fdaOwner.email,
            recipientName: fdaOwner.firstName || "Agent",
            vesselName: updated.vesselName || "—",
            portName: updated.portName || "—",
            referenceNumber: updated.referenceNumber || `FDA-${updated.id}`,
            estimatedUsd: updated.totalEstimatedUsd || 0,
            actualUsd: updated.totalActualUsd || 0,
            variancePercent: updated.variancePercent || 0,
            fdaUrl: `${baseUrl}/fda/${updated.id}`,
            subject: `FDA Approved: ${updated.referenceNumber} — Create Invoice`,
          });
        }
      } catch (e) { console.warn("[fda] FDA approved email skipped:", e); }
    })();

    res.json(updated);
  } catch (error) { next(error); }
});


router.get("/:id/pdf", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const fdaId = parseInt(req.params.id);
    const [fda] = await db.select().from(fdaAccounts).where(eq(fdaAccounts.id, fdaId));
    if (!fda) return res.status(404).json({ error: "FDA not found" });

    const PDFDocumentModule = await import("pdfkit");
    const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const fdaUserId = (fda as any).userId || req.user.claims.sub;
    const companyProfile = fdaUserId ? await storage.getCompanyProfileByUser(fdaUserId) : null;

    await new Promise<void>(async (resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
      try {
        await addPdfHeader(doc, companyProfile || null, "FINAL DISBURSEMENT ACCOUNT");

        doc.fontSize(9).font("Helvetica").fillColor("#333");
        doc.text(`Reference: ${fda.referenceNumber}`, 50, doc.y, { width: 240 });
        doc.text(`Date: ${fda.createdAt ? new Date(fda.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}`, 50, doc.y + 2, { width: 240 });
        doc.text(`Vessel: ${(fda as any).vesselName || "N/A"}`, 50, doc.y + 2, { width: 240 });
        doc.text(`Port: ${(fda as any).portName || "N/A"}`, 50, doc.y + 2, { width: 240 });
        doc.text(`Status: ${((fda as any).status || "draft").toUpperCase()}`, 50, doc.y + 2, { width: 240 });
        doc.fillColor("#000").moveDown(1);

        doc.font("Helvetica-Bold").fontSize(8);
        const y = doc.y;
        doc.text("DESCRIPTION", 50, y, { width: 170 });
        doc.text("EST. USD", 225, y, { width: 65, align: "right" });
        doc.text("ACT. USD", 295, y, { width: 65, align: "right" });
        doc.text("VARIANCE", 365, y, { width: 65, align: "right" });
        doc.text("VAR %", 435, y, { width: 55, align: "right" });
        doc.text("REMARKS", 495, y, { width: 50 });
        doc.moveTo(50, doc.y + 3).lineTo(545, doc.y + 3).stroke();
        doc.moveDown(0.5);

        doc.font("Helvetica").fontSize(7);
        const items = (fda.lineItems as FdaLineItem[]) || [];
        for (const item of items) {
          if (doc.y > 700) doc.addPage();
          const iy = doc.y;
          doc.text(item.description, 50, iy, { width: 170 });
          doc.text((item.estimatedUsd || 0).toFixed(2), 225, iy, { width: 65, align: "right" });
          doc.text((item.actualUsd || 0).toFixed(2), 295, iy, { width: 65, align: "right" });
          const varColor = (item.varianceUsd || 0) > 0 ? "#dc2626" : "#16a34a";
          doc.fillColor(varColor).text((item.varianceUsd || 0).toFixed(2), 365, iy, { width: 65, align: "right" });
          doc.fillColor("#000").text(`${(item.variancePercent || 0).toFixed(1)}%`, 435, iy, { width: 55, align: "right" });
          doc.text(item.remarks || "", 495, iy, { width: 50 });
          doc.moveDown(0.3);
        }

        doc.moveDown(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);
        doc.font("Helvetica-Bold").fontSize(9);
        const ty = doc.y;
        doc.text("TOTAL", 50, ty);
        doc.text(`$ ${(fda.totalEstimatedUsd || 0).toFixed(2)}`, 225, ty, { width: 65, align: "right" });
        doc.text(`$ ${(fda.totalActualUsd || 0).toFixed(2)}`, 295, ty, { width: 65, align: "right" });
        const totalVar = fda.varianceUsd || 0;
        doc.fillColor(totalVar > 0 ? "#dc2626" : "#16a34a").text(`$ ${totalVar.toFixed(2)}`, 365, ty, { width: 65, align: "right" });
        doc.text(`${(fda.variancePercent || 0).toFixed(1)}%`, 435, ty, { width: 55, align: "right" });
        doc.fillColor("#000");

        doc.moveDown(1.5);
        if ((fda as any).approvedBy) {
          doc.fontSize(8).text(`Approved by: ${(fda as any).approvedBy}${(fda as any).approvedAt ? " on " + new Date((fda as any).approvedAt).toLocaleDateString("en-GB") : ""}`);
        }

        const cp = companyProfile as any;
        if (cp && (cp.bankName || cp.bankIban || cp.bankSwift)) {
          doc.moveDown(1);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor("#b0b8c4").stroke().lineWidth(1).strokeColor("black");
          doc.moveDown(0.5);
          const bankY = doc.y;
          doc.rect(50, bankY, 495, 14).fill("#e8edf4");
          doc.fillColor("#1e3a5f").fontSize(8.5).font("Helvetica-Bold").text("BANK DETAILS", 54, bankY + 3);
          doc.y = bankY + 18;
          doc.fillColor("#333").fontSize(8).font("Helvetica");
          const bankFields: [string, string][] = [
            ["Bank", cp.bankName || ""],
            ["Beneficiary", cp.bankAccountName || cp.companyName || ""],
            ["IBAN", cp.bankIban || ""],
            ["SWIFT / BIC", cp.bankSwift || ""],
            ["Branch", cp.bankBranchName || ""],
          ];
          for (const [label, val] of bankFields) {
            if (!val) continue;
            doc.text(`${label}: `, 54, doc.y, { continued: true }).font("Helvetica-Bold").text(val);
            doc.font("Helvetica").moveDown(0.25);
          }
        }

        addPdfFooter(doc, companyProfile || null);
        doc.end();
      } catch (err) { reject(err); }
    });

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="FDA-${fda.referenceNumber || fdaId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
});


export default router;
