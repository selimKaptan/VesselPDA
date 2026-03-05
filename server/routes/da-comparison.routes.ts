import { Router } from "express";
import { db } from "../db";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { proformas, fdaAccounts } from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { cached } from "../cache";

const router = Router();

interface FdaLineItem {
  id?: string;
  description: string;
  category?: string;
  estimatedUsd: number;
  actualUsd: number;
  varianceUsd: number;
  variancePercent: number;
  remarks?: string;
}

interface ComparisonItem {
  description: string;
  category: string;
  estimatedUsd: number;
  actualUsd: number;
  varianceUsd: number;
  variancePercent: number;
  status: "over" | "under" | "exact";
}

function buildComparison(fdaLineItems: FdaLineItem[]) {
  const comparison: ComparisonItem[] = fdaLineItems.map((item) => {
    const variancePercent = item.variancePercent ?? (item.estimatedUsd > 0
      ? ((item.varianceUsd ?? (item.actualUsd - item.estimatedUsd)) / item.estimatedUsd) * 100
      : 0);
    const varianceUsd = item.varianceUsd ?? (item.actualUsd - item.estimatedUsd);
    return {
      description: item.description,
      category: item.category || "General",
      estimatedUsd: Number(item.estimatedUsd) || 0,
      actualUsd: Number(item.actualUsd) || 0,
      varianceUsd: Number(varianceUsd),
      variancePercent: parseFloat(Number(variancePercent).toFixed(2)),
      status: (Math.abs(variancePercent) < 1 ? "exact"
        : varianceUsd > 0 ? "over"
        : "under") as "over" | "under" | "exact",
    };
  });

  const totalEstimatedUsd = comparison.reduce((s, i) => s + i.estimatedUsd, 0);
  const totalActualUsd = comparison.reduce((s, i) => s + i.actualUsd, 0);
  const totalVarianceUsd = totalActualUsd - totalEstimatedUsd;
  const totalVariancePercent = totalEstimatedUsd > 0
    ? (totalVarianceUsd / totalEstimatedUsd) * 100
    : 0;

  return {
    comparison,
    summary: {
      totalEstimatedUsd: parseFloat(totalEstimatedUsd.toFixed(2)),
      totalActualUsd: parseFloat(totalActualUsd.toFixed(2)),
      totalVarianceUsd: parseFloat(totalVarianceUsd.toFixed(2)),
      totalVariancePercent: parseFloat(totalVariancePercent.toFixed(2)),
      itemsOver: comparison.filter((i) => i.status === "over").length,
      itemsUnder: comparison.filter((i) => i.status === "under").length,
      itemsExact: comparison.filter((i) => i.status === "exact").length,
      accuracyScore: parseFloat((100 - Math.abs(totalVariancePercent)).toFixed(2)),
    },
  };
}

router.get("/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const limit = Math.min(parseInt(String(req.query.limit || "20")), 50);
    const cacheKey = `da-comparison-history-${userId}`;

    const result = await cached(cacheKey, "medium", async () => {
      const fdas = await db
        .select()
        .from(fdaAccounts)
        .where(and(eq(fdaAccounts.userId, userId), isNotNull(fdaAccounts.proformaId)))
        .orderBy(desc(fdaAccounts.createdAt))
        .limit(limit);

      const history = await Promise.all(
        fdas.map(async (fda) => {
          let proformaRef: string | null = null;
          const vesselName = fda.vesselName;
          const portName = fda.portName;
          if (fda.proformaId) {
            const [pda] = await db
              .select()
              .from(proformas)
              .where(eq(proformas.id, fda.proformaId));
            if (pda) {
              proformaRef = pda.referenceNumber;
            }
          }
          const variancePercent = Number(fda.variancePercent) || 0;
          const accuracyScore = parseFloat((100 - Math.abs(variancePercent)).toFixed(2));
          return {
            proformaId: fda.proformaId,
            fdaId: fda.id,
            proformaRef,
            fdaRef: fda.referenceNumber,
            vesselName,
            portName,
            totalEstimatedUsd: Number(fda.totalEstimatedUsd) || 0,
            totalActualUsd: Number(fda.totalActualUsd) || 0,
            varianceUsd: Number(fda.varianceUsd) || 0,
            variancePercent,
            accuracyScore,
            status: fda.status,
            createdAt: fda.createdAt,
          };
        })
      );

      const totalComparisons = history.length;
      const averageAccuracy = totalComparisons > 0
        ? parseFloat(
            (history.reduce((s, h) => s + h.accuracyScore, 0) / totalComparisons).toFixed(2)
          )
        : null;

      return { history, averageAccuracy, totalComparisons };
    });

    res.json(result);
  } catch (error) {
    console.error("[da-comparison] history error:", error);
    res.status(500).json({ message: "Failed to fetch comparison history" });
  }
});

router.get("/:proformaId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const proformaId = parseInt(req.params.proformaId);
    if (isNaN(proformaId)) return res.status(400).json({ message: "Invalid proforma ID" });

    const cacheKey = `da-comparison-${proformaId}`;
    const result = await cached(cacheKey, "medium", async () => {
      const [proforma] = await db
        .select()
        .from(proformas)
        .where(eq(proformas.id, proformaId));

      if (!proforma) return null;

      const [fda] = await db
        .select()
        .from(fdaAccounts)
        .where(eq(fdaAccounts.proformaId, proformaId));

      const proformaShape = {
        id: proforma.id,
        referenceNumber: proforma.referenceNumber,
        vesselName: fda?.vesselName || null,
        portName: fda?.portName || null,
        totalUsd: proforma.totalUsd,
        totalEur: proforma.totalEur,
        createdAt: proforma.createdAt,
        status: proforma.status,
      };

      if (!fda) {
        return { proforma: proformaShape, fda: null, comparison: null, summary: null };
      }

      const lineItems = (fda.lineItems as FdaLineItem[]) || [];
      const { comparison, summary } = buildComparison(lineItems);

      return {
        proforma: proformaShape,
        fda: {
          id: fda.id,
          referenceNumber: fda.referenceNumber,
          totalActualUsd: Number(fda.totalActualUsd) || 0,
          totalActualEur: Number(fda.totalActualEur) || 0,
          totalEstimatedUsd: Number(fda.totalEstimatedUsd) || 0,
          varianceUsd: Number(fda.varianceUsd) || 0,
          variancePercent: Number(fda.variancePercent) || 0,
          status: fda.status,
          approvedAt: fda.approvedAt,
        },
        comparison,
        summary,
      };
    });

    if (!result) return res.status(404).json({ message: "Proforma not found" });
    res.json(result);
  } catch (error) {
    console.error("[da-comparison] detail error:", error);
    res.status(500).json({ message: "Failed to fetch comparison" });
  }
});

router.get("/:proformaId/pdf", isAuthenticated, async (req: any, res) => {
  try {
    const proformaId = parseInt(req.params.proformaId);
    if (isNaN(proformaId)) return res.status(400).json({ message: "Invalid proforma ID" });

    const [proforma] = await db
      .select()
      .from(proformas)
      .where(eq(proformas.id, proformaId));
    if (!proforma) return res.status(404).json({ message: "Proforma not found" });

    const [fda] = await db
      .select()
      .from(fdaAccounts)
      .where(eq(fdaAccounts.proformaId, proformaId));
    if (!fda) return res.status(404).json({ message: "No FDA linked to this proforma" });

    const lineItems = (fda.lineItems as FdaLineItem[]) || [];
    const { comparison, summary } = buildComparison(lineItems);

    const PDFDocumentModule = await import("pdfkit");
    const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="DA-Comparison-${proforma.referenceNumber || proformaId}.pdf"`
      );
      res.send(pdf);
    });

    const pageWidth = doc.page.width - 100;
    const col = (frac: number) => 50 + pageWidth * frac;

    doc.fontSize(16).font("Helvetica-Bold").text("DISBURSEMENT ACCOUNT COMPARISON REPORT", { align: "center" });
    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).stroke();
    doc.moveDown(0.6);

    doc.fontSize(10).font("Helvetica");
    const info = [
      ["PDA Reference", proforma.referenceNumber || `PDA-${proformaId}`],
      ["FDA Reference", fda.referenceNumber || `FDA-${fda.id}`],
      ["Vessel", fda.vesselName || "—"],
      ["Port", fda.portName || "—"],
      ["Report Date", new Date().toLocaleDateString("en-GB")],
    ];
    info.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value);
    });

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).text("SUMMARY");
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).font("Helvetica");
    [
      ["Estimated Total", `$${summary.totalEstimatedUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`],
      ["Actual Total", `$${summary.totalActualUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`],
      ["Total Variance", `${summary.totalVarianceUsd >= 0 ? "+" : ""}$${summary.totalVarianceUsd.toLocaleString("en", { minimumFractionDigits: 2 })} (${summary.totalVariancePercent >= 0 ? "+" : ""}${summary.totalVariancePercent.toFixed(2)}%)`],
      ["Accuracy Score", `${summary.accuracyScore}%`],
      ["Items Over Budget", String(summary.itemsOver)],
      ["Items Under Budget", String(summary.itemsUnder)],
      ["Exact Matches", String(summary.itemsExact)],
    ].forEach(([label, value]) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value);
    });

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).text("DETAILED COMPARISON");
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    const headers = ["Description", "Estimated USD", "Actual USD", "Variance USD", "Var %"];
    const colWidths = [0.40, 0.15, 0.15, 0.17, 0.13];
    doc.fontSize(9).font("Helvetica-Bold");
    headers.forEach((h, i) => {
      const x = col(colWidths.slice(0, i).reduce((a, b) => a + b, 0));
      doc.text(h, x, doc.y, { width: pageWidth * colWidths[i], align: i === 0 ? "left" : "right" });
    });
    let headerY = doc.y;
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.3).stroke();
    doc.moveDown(0.2);

    doc.font("Helvetica").fontSize(9);
    comparison.forEach((item) => {
      if (doc.y > doc.page.height - 100) doc.addPage();
      const y = doc.y;
      const sign = item.varianceUsd >= 0 ? "+" : "";
      const row = [
        item.description,
        `$${item.estimatedUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`,
        `$${item.actualUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`,
        `${sign}$${item.varianceUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`,
        `${sign}${item.variancePercent.toFixed(2)}%`,
      ];
      row.forEach((cell, i) => {
        const x = col(colWidths.slice(0, i).reduce((a, b) => a + b, 0));
        doc.text(cell, x, y, { width: pageWidth * colWidths[i], align: i === 0 ? "left" : "right" });
      });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.1).stroke("#cccccc");
      doc.moveDown(0.1);
    });

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    const totalRow = [
      "TOTAL",
      `$${summary.totalEstimatedUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`,
      `$${summary.totalActualUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`,
      `${summary.totalVarianceUsd >= 0 ? "+" : ""}$${summary.totalVarianceUsd.toLocaleString("en", { minimumFractionDigits: 2 })}`,
      `${summary.totalVariancePercent >= 0 ? "+" : ""}${summary.totalVariancePercent.toFixed(2)}%`,
    ];
    doc.font("Helvetica-Bold").fontSize(9);
    const totalY = doc.y;
    totalRow.forEach((cell, i) => {
      const x = col(colWidths.slice(0, i).reduce((a, b) => a + b, 0));
      doc.text(cell, x, totalY, { width: pageWidth * colWidths[i], align: i === 0 ? "left" : "right" });
    });

    doc.moveDown(2);
    doc.font("Helvetica").fontSize(8).fillColor("#888888")
      .text("Generated by VesselPDA — vesselpda.com", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("[da-comparison] PDF error:", error);
    res.status(500).json({ message: "Failed to generate comparison PDF" });
  }
});

export default router;
