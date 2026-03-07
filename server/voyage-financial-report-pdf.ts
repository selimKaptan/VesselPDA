import PDFDocument from "pdfkit";
import { addPdfHeader, addPdfFooter } from "./proforma-pdf";

const COL_LEFT = 50;
const COL_RIGHT = 310;
const PAGE_RIGHT = 545;

function hline(doc: any, y?: number) {
  const lineY = y ?? doc.y;
  doc.moveTo(COL_LEFT, lineY).lineTo(PAGE_RIGHT, lineY).strokeColor("#b0b8c4").lineWidth(0.5).stroke();
  doc.strokeColor("black").lineWidth(1);
}

export async function generateVoyageFinancialReportPdf(data: any, companyProfile?: any): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];

  const streamDone = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  await addPdfHeader(doc, companyProfile, "VOYAGE FINANCIAL REPORT");

  // Summary Cards Section
  const summaryY = doc.y;
  const cardWidth = (PAGE_RIGHT - COL_LEFT - 20) / 3;
  
  // Card 1: PDA Total
  doc.rect(COL_LEFT, summaryY, cardWidth, 40).fill("#f8fafc");
  doc.fillColor("#64748b").fontSize(7).text("PDA TOTAL", COL_LEFT + 5, summaryY + 8);
  doc.fillColor("#1e293b").fontSize(10).font("Helvetica-Bold").text(`$${data.pda.total.toLocaleString()}`, COL_LEFT + 5, summaryY + 20);

  // Card 2: FDA Total
  doc.rect(COL_LEFT + cardWidth + 10, summaryY, cardWidth, 40).fill("#f8fafc");
  doc.fillColor("#64748b").fontSize(7).text("FDA TOTAL", COL_LEFT + cardWidth + 15, summaryY + 8);
  doc.fillColor("#1e293b").fontSize(10).font("Helvetica-Bold").text(`$${data.fda.total.toLocaleString()}`, COL_LEFT + cardWidth + 15, summaryY + 20);

  // Card 3: Net Balance
  doc.rect(COL_LEFT + (cardWidth + 10) * 2, summaryY, cardWidth, 40).fill("#f8fafc");
  doc.fillColor("#64748b").fontSize(7).text("NET BALANCE", COL_LEFT + (cardWidth + 10) * 2 + 5, summaryY + 8);
  doc.fillColor(data.summary.netBalance >= 0 ? "#16a34a" : "#dc2626").fontSize(10).font("Helvetica-Bold").text(`$${data.summary.netBalance.toLocaleString()}`, COL_LEFT + (cardWidth + 10) * 2 + 5, summaryY + 20);

  doc.y = summaryY + 50;
  doc.fillColor("black").font("Helvetica").fontSize(9);

  // Section 1: Voyage Details
  doc.font("Helvetica-Bold").fontSize(10).text("VOYAGE DETAILS", COL_LEFT);
  doc.moveDown(0.5);
  hline(doc);
  doc.moveDown(0.5);
  
  const detailsY = doc.y;
  doc.fontSize(8).font("Helvetica");
  doc.text(`Vessel: ${data.voyage.vesselName}`, COL_LEFT);
  doc.text(`Port: ${data.voyage.portName}`, COL_LEFT, doc.y + 2);
  doc.text(`Duration: ${data.voyage.duration}`, COL_LEFT, doc.y + 2);
  
  doc.text(`ETA: ${data.voyage.eta ? new Date(data.voyage.eta).toLocaleDateString("en-GB") : "N/A"}`, COL_RIGHT, detailsY);
  doc.text(`ETD: ${data.voyage.etd ? new Date(data.voyage.etd).toLocaleDateString("en-GB") : "N/A"}`, COL_RIGHT, doc.y + 2);
  
  doc.moveDown(1.5);

  // Section 2: PDA vs FDA Comparison
  doc.font("Helvetica-Bold").fontSize(10).text("PDA VS FDA COMPARISON", COL_LEFT);
  doc.moveDown(0.5);
  hline(doc);
  doc.moveDown(0.5);

  const tableHeaderY = doc.y;
  doc.rect(COL_LEFT, tableHeaderY, PAGE_RIGHT - COL_LEFT, 15).fill("#f1f5f9");
  doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold");
  doc.text("DESCRIPTION", COL_LEFT + 5, tableHeaderY + 4);
  doc.text("PDA (USD)", COL_LEFT + 250, tableHeaderY + 4, { width: 70, align: "right" });
  doc.text("FDA (USD)", COL_LEFT + 330, tableHeaderY + 4, { width: 70, align: "right" });
  doc.text("VARIANCE", COL_LEFT + 410, tableHeaderY + 4, { width: 70, align: "right" });

  doc.y = tableHeaderY + 20;
  doc.fillColor("black").font("Helvetica").fontSize(8);

  // Example line items - in a real app you'd map these
  const comparisonItems = [
    { desc: "Port Dues", pda: data.pda.total * 0.4, fda: data.fda.total * 0.38 },
    { desc: "Pilotage & Towage", pda: data.pda.total * 0.3, fda: data.fda.total * 0.32 },
    { desc: "Agency Fee", pda: data.pda.total * 0.1, fda: data.fda.total * 0.1 },
    { desc: "Other Expenses", pda: data.pda.total * 0.2, fda: data.fda.total * 0.2 },
  ];

  for (const item of comparisonItems) {
    const rowY = doc.y;
    const diff = item.fda - item.pda;
    doc.text(item.desc, COL_LEFT + 5, rowY);
    doc.text(item.pda.toFixed(2), COL_LEFT + 250, rowY, { width: 70, align: "right" });
    doc.text(item.fda.toFixed(2), COL_LEFT + 330, rowY, { width: 70, align: "right" });
    doc.fillColor(diff > 0 ? "#dc2626" : "#16a34a").text(diff.toFixed(2), COL_LEFT + 410, rowY, { width: 70, align: "right" });
    doc.fillColor("black");
    doc.y = rowY + 15;
  }

  doc.moveDown(1.5);

  // Section 3: Port Expense Distribution
  doc.font("Helvetica-Bold").fontSize(10).text("PORT EXPENSE DISTRIBUTION", COL_LEFT);
  doc.moveDown(0.5);
  hline(doc);
  doc.moveDown(0.5);

  const categories = Object.entries(data.portExpenses.byCategory);
  for (const [cat, amt] of categories) {
    const rowY = doc.y;
    doc.text(cat.replace(/_/g, ' ').toUpperCase(), COL_LEFT + 5, rowY);
    doc.text(`$${(amt as number).toLocaleString()}`, COL_LEFT + 250, rowY, { width: 70, align: "right" });
    doc.y = rowY + 12;
  }

  doc.moveDown(1.5);

  // Section 4: Invoice Summary
  doc.font("Helvetica-Bold").fontSize(10).text("INVOICE SUMMARY", COL_LEFT);
  doc.moveDown(0.5);
  hline(doc);
  doc.moveDown(0.5);

  const invRows = [
    ["Total Billed", `$${data.invoices.totalBilled.toLocaleString()}`],
    ["Total Paid", `$${data.invoices.totalPaid.toLocaleString()}`],
    ["Outstanding", `$${data.invoices.outstanding.toLocaleString()}`],
  ];

  for (const [label, val] of invRows) {
    const rowY = doc.y;
    doc.text(label, COL_LEFT + 5, rowY);
    doc.font("Helvetica-Bold").text(val, COL_LEFT + 250, rowY, { width: 70, align: "right" }).font("Helvetica");
    doc.y = rowY + 12;
  }

  addPdfFooter(doc, companyProfile);
  doc.end();
  return streamDone;
}
