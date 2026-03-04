import PDFDocument from "pdfkit";
import type { ProformaLineItem, BankDetails } from "@shared/schema";

interface ProformaPdfOptions {
  proforma: any;
  companyProfile?: any;
  port?: any;
  vessel?: any;
}

const COL_LEFT = 50;
const COL_RIGHT = 310;
const PAGE_RIGHT = 545;
const PAGE_WIDTH = 595.28;

function hline(doc: InstanceType<typeof PDFDocument>, y?: number) {
  const lineY = y ?? doc.y;
  doc.moveTo(COL_LEFT, lineY).lineTo(PAGE_RIGHT, lineY).strokeColor("#b0b8c4").lineWidth(0.5).stroke();
  doc.strokeColor("black").lineWidth(1);
}

export function generateProformaPdf(options: ProformaPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { proforma, companyProfile, port, vessel } = options;
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ─── HEADER BAR ────────────────────────────────────────────────────────────
    doc.rect(COL_LEFT, 40, PAGE_RIGHT - COL_LEFT, 28).fill("#1e3a5f");
    doc
      .fillColor("white")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("PROFORMA DISBURSEMENT ACCOUNT", COL_LEFT + 6, 48, {
        width: PAGE_RIGHT - COL_LEFT - 12,
        align: "center",
      });
    doc.fillColor("black");
    doc.y = 76;
    doc.moveDown(0.6);

    // ─── COMPANY INFO (right) & REFERENCE/DATE (left) ─────────────────────────
    const headerY = doc.y;

    if (companyProfile) {
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor("#1e3a5f")
        .text(companyProfile.companyName || "VesselPDA Agent", COL_RIGHT, headerY, {
          width: PAGE_RIGHT - COL_RIGHT,
          align: "right",
        });
      doc
        .font("Helvetica")
        .fillColor("#555")
        .fontSize(7.5)
        .text(companyProfile.address || "", COL_RIGHT, doc.y, { width: PAGE_RIGHT - COL_RIGHT, align: "right" });
      if (companyProfile.phone)
        doc.text(`Tel: ${companyProfile.phone}`, COL_RIGHT, doc.y, { width: PAGE_RIGHT - COL_RIGHT, align: "right" });
      if (companyProfile.email)
        doc.text(`Email: ${companyProfile.email}`, COL_RIGHT, doc.y, { width: PAGE_RIGHT - COL_RIGHT, align: "right" });
    }

    const refDateY = headerY;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("black")
      .text(`Reference: ${proforma.referenceNumber || "N/A"}`, COL_LEFT, refDateY, { width: 220 });
    doc
      .fontSize(8.5)
      .font("Helvetica")
      .fillColor("#333")
      .text(
        `Date: ${proforma.createdAt ? new Date(proforma.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}`,
        COL_LEFT,
        doc.y + 2,
        { width: 220 }
      );
    if (proforma.status)
      doc.text(`Status: ${String(proforma.status).toUpperCase()}`, COL_LEFT, doc.y + 2, { width: 220 });

    doc.y = Math.max(doc.y, (companyProfile ? 130 : headerY + 30));
    doc.moveDown(0.8);
    hline(doc);
    doc.moveDown(0.7);

    // ─── VESSEL & PORT SIDE-BY-SIDE ───────────────────────────────────────────
    const infoY = doc.y;

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#1e3a5f").text("VESSEL DETAILS", COL_LEFT, infoY);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#1e3a5f").text("PORT DETAILS", COL_RIGHT, infoY);

    const v = vessel || {};
    const p = port || {};
    const vRows = [
      ["Name", v.name || proforma.vesselName || "N/A"],
      ["Flag", v.flag || "N/A"],
      ["GRT", v.grt ? String(v.grt) : "N/A"],
      ["NRT", v.nrt ? String(v.nrt) : "N/A"],
      ["DWT", v.dwt ? String(v.dwt) : "N/A"],
      ["LOA", v.loa ? `${v.loa} m` : "N/A"],
      ["IMO", v.imoNumber || "N/A"],
    ];
    const pRows = [
      ["Port", p.name || "N/A"],
      ["Country", p.country || "Turkey"],
      ["Code", p.unlocode || p.code || "N/A"],
      ["Purpose", proforma.purposeOfCall || "N/A"],
    ];

    let leftY = infoY + 14;
    doc.fillColor("black").fontSize(8).font("Helvetica");
    for (const [label, val] of vRows) {
      doc.fillColor("#666").text(`${label}:`, COL_LEFT, leftY, { width: 40, continued: true });
      doc.fillColor("black").text(` ${val}`, { width: 200 });
      leftY += 13;
    }

    let rightY = infoY + 14;
    for (const [label, val] of pRows) {
      doc.fillColor("#666").text(`${label}:`, COL_RIGHT, rightY, { width: 45, continued: true });
      doc.fillColor("black").text(` ${val}`, { width: 185 });
      rightY += 13;
    }

    doc.y = Math.max(leftY, rightY) + 6;
    doc.moveDown(0.4);
    hline(doc);
    doc.moveDown(0.6);

    // ─── LINE ITEMS TABLE ──────────────────────────────────────────────────────
    const tableHeaderY = doc.y;
    doc
      .rect(COL_LEFT, tableHeaderY, PAGE_RIGHT - COL_LEFT, 16)
      .fill("#e8edf4");
    doc
      .fillColor("#1e3a5f")
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .text("DESCRIPTION", COL_LEFT + 4, tableHeaderY + 4, { width: 280 });
    doc.text("USD", COL_LEFT + 290, tableHeaderY + 4, { width: 70, align: "right" });
    doc.text("EUR", COL_LEFT + 370, tableHeaderY + 4, { width: 75, align: "right" });

    doc.y = tableHeaderY + 20;
    doc.fillColor("black").fontSize(8.5).font("Helvetica");

    const lineItems: ProformaLineItem[] = Array.isArray(proforma.lineItems) ? proforma.lineItems : [];
    let rowAlt = false;

    for (const item of lineItems) {
      if (doc.y > 720) {
        doc.addPage();
        doc.y = 50;
      }
      const rowY = doc.y;
      const descHeight = doc.heightOfString(item.description || "", { width: 275 });
      const rowHeight = Math.max(descHeight + 6, 16);

      if (rowAlt) {
        doc.rect(COL_LEFT, rowY, PAGE_RIGHT - COL_LEFT, rowHeight).fill("#f7f9fc");
      }
      rowAlt = !rowAlt;

      doc.fillColor("#222").font("Helvetica");
      doc.text(item.description || "", COL_LEFT + 4, rowY + 3, { width: 275 });

      const usdStr = typeof item.amountUsd === "number" ? item.amountUsd.toFixed(2) : "-";
      const eurStr = typeof item.amountEur === "number" ? item.amountEur.toFixed(2) : "-";
      doc.text(usdStr, COL_LEFT + 290, rowY + 3, { width: 70, align: "right" });
      doc.text(eurStr, COL_LEFT + 370, rowY + 3, { width: 75, align: "right" });

      doc.y = rowY + rowHeight;
    }

    // ─── TOTALS ────────────────────────────────────────────────────────────────
    doc.moveDown(0.4);
    hline(doc);
    doc.moveDown(0.4);

    const totalY = doc.y;
    doc.rect(COL_LEFT, totalY, PAGE_RIGHT - COL_LEFT, 20).fill("#1e3a5f");
    doc
      .fillColor("white")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("TOTAL ESTIMATED COST", COL_LEFT + 4, totalY + 5, { width: 240 });

    const totalUsd = proforma.totalUsd != null ? `$ ${Number(proforma.totalUsd).toFixed(2)}` : "-";
    const totalEur = proforma.totalEur != null ? `€ ${Number(proforma.totalEur).toFixed(2)}` : "-";
    doc.text(totalUsd, COL_LEFT + 290, totalY + 5, { width: 70, align: "right" });
    doc.text(totalEur, COL_LEFT + 370, totalY + 5, { width: 75, align: "right" });

    doc.fillColor("black");
    doc.y = totalY + 24;
    doc.moveDown(0.5);

    // Exchange rate
    doc
      .fontSize(7.5)
      .font("Helvetica")
      .fillColor("#555")
      .text(
        `Exchange Rate: 1 USD = ${proforma.exchangeRate ?? "N/A"} TRY`,
        COL_LEFT,
        doc.y
      );
    doc.fillColor("black");

    // ─── BANK DETAILS ──────────────────────────────────────────────────────────
    if (proforma.bankDetails) {
      doc.moveDown(1);
      hline(doc);
      doc.moveDown(0.5);
      const bankY = doc.y;
      doc.rect(COL_LEFT, bankY, PAGE_RIGHT - COL_LEFT, 14).fill("#e8edf4");
      doc
        .fillColor("#1e3a5f")
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .text("BANK DETAILS", COL_LEFT + 4, bankY + 3);
      doc.y = bankY + 18;
      doc.fillColor("black");

      let bank: BankDetails;
      try {
        bank = typeof proforma.bankDetails === "string" ? JSON.parse(proforma.bankDetails) : proforma.bankDetails;
      } catch {
        bank = {} as BankDetails;
      }

      doc.fontSize(8).font("Helvetica").fillColor("#333");
      const bankRows: [string, string][] = [
        ["Bank", bank.bankName || ""],
        ["Beneficiary", bank.beneficiary || ""],
        ["USD IBAN", bank.usdIban || ""],
        ["EUR IBAN", bank.eurIban || ""],
        ["SWIFT / BIC", bank.swiftCode || ""],
        ["Branch", bank.branch || ""],
      ];
      for (const [label, val] of bankRows) {
        if (!val) continue;
        doc.text(`${label}: `, COL_LEFT + 4, doc.y, { continued: true }).font("Helvetica-Bold").text(val);
        doc.font("Helvetica");
        doc.moveDown(0.25);
      }
    }

    // ─── NOTES ─────────────────────────────────────────────────────────────────
    if (proforma.notes) {
      doc.moveDown(0.8);
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#1e3a5f")
        .text("NOTES", COL_LEFT);
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#333")
        .text(proforma.notes, COL_LEFT, doc.y + 2, { width: PAGE_RIGHT - COL_LEFT });
    }

    // ─── FOOTER ────────────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(6.5)
        .font("Helvetica")
        .fillColor("#aaa")
        .text(
          "This is a proforma disbursement account. Actual costs may vary depending on port conditions and regulations.",
          COL_LEFT,
          800,
          { width: PAGE_RIGHT - COL_LEFT, align: "center" }
        )
        .text(
          `Generated by VesselPDA — ${new Date().toISOString().split("T")[0]}  |  Page ${i - range.start + 1} of ${range.count}`,
          { align: "center" }
        );
    }

    doc.end();
  });
}
