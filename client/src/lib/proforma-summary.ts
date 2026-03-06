import { jsPDF } from "jspdf";

type GroupedItem = {
  category: string;
  items: { description: string; amountUsd: number; amountEur: number; notes?: string }[];
  subtotalUsd: number;
  subtotalEur: number;
  pct: number;
};

type QuickEstimateResult = {
  vesselName: string;
  portName: string;
  totalUsd: number;
  totalEur: number;
  exchangeRates?: { usdTry?: number; eurTry?: number; eurUsd?: number };
  calculatedAt?: string;
  tariffSource?: string;
  portTariffName?: string;
  groupedBreakdown?: GroupedItem[];
  lineItems?: { description: string; amountUsd: number; amountEur: number; notes?: string; category?: string }[];
};

const CATEGORY_COLORS: Record<string, string> = {
  "Port Navigation":    "#0ea5e9",
  "Port Dues":          "#3b82f6",
  "Regulatory":         "#8b5cf6",
  "Chamber & Official": "#6366f1",
  "Disbursement":       "#64748b",
  "Agency":             "#14b8a6",
  "Supervision":        "#10b981",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso?: string) {
  if (!iso) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function generateProformaSummaryHtml(data: QuickEstimateResult): string {
  const grouped: GroupedItem[] = data.groupedBreakdown ?? [];

  const rows = grouped.map(g => {
    const catColor = CATEGORY_COLORS[g.category] ?? "#64748b";
    const itemRows = g.items
      .map(
        item =>
          `<tr>
            <td style="padding:3px 8px 3px 16px;font-size:11px;color:#475569;">${item.description}</td>
            <td style="padding:3px 8px;font-size:11px;color:#1e293b;text-align:right;font-family:monospace;">$${fmt(item.amountUsd)}</td>
            <td style="padding:3px 8px;font-size:11px;color:#64748b;text-align:right;font-family:monospace;">€${fmt(item.amountEur)}</td>
          </tr>`
      )
      .join("");
    return `
      <tr style="background:#f8fafc;">
        <td colspan="3" style="padding:5px 8px;border-left:3px solid ${catColor};">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${catColor};">${g.category}</span>
          <span style="float:right;font-size:11px;font-weight:700;font-family:monospace;color:${catColor};">$${fmt(g.subtotalUsd)}</span>
        </td>
      </tr>
      ${itemRows}`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Proforma Summary — ${data.vesselName}</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
  <div style="max-width:680px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f2044 0%,#1a3a6e 100%);padding:20px 24px;">
      <div style="color:#93c5fd;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">VesselPDA</div>
      <div style="color:#fff;font-size:18px;font-weight:700;margin-bottom:2px;">Proforma Disbursement Account — Summary</div>
      <div style="color:#93c5fd;font-size:12px;">${data.vesselName} &nbsp;•&nbsp; ${data.portName} &nbsp;•&nbsp; ${fmtDate(data.calculatedAt)}</div>
    </div>

    <!-- Meta badges -->
    <div style="display:flex;gap:12px;padding:12px 24px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-size:11px;color:#64748b;">
      ${data.tariffSource ? `<span style="background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:2px 8px;font-weight:600;">${data.tariffSource === "database" ? "DB Tariff" : "Estimate"}</span>` : ""}
      ${data.portTariffName ? `<span>Tariff: <b>${data.portTariffName}</b></span>` : ""}
      ${data.exchangeRates?.usdTry ? `<span>1 USD = ${data.exchangeRates.usdTry} TRY</span>` : ""}
    </div>

    <!-- Table -->
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;">Description</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;">USD</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;">EUR</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="border-top:2px solid #1d4ed8;background:#eff6ff;">
          <td style="padding:8px;font-size:12px;font-weight:700;color:#1e3a8a;">TOTAL PORT EXPENSES</td>
          <td style="padding:8px;text-align:right;font-size:13px;font-weight:700;font-family:monospace;color:#1d4ed8;">$${fmt(data.totalUsd)}</td>
          <td style="padding:8px;text-align:right;font-size:12px;font-weight:600;font-family:monospace;color:#3b82f6;">€${fmt(data.totalEur)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Footer -->
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;">
      Generated by VesselPDA &nbsp;•&nbsp; ${fmtDate(data.calculatedAt)} &nbsp;•&nbsp; This is a preliminary estimate only.
    </div>
  </div>
</body>
</html>`;
}

export function generateProformaSummaryPdf(data: QuickEstimateResult): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  let y = 0;

  const NAVY = [15, 32, 68] as const;
  const BLUE = [29, 78, 216] as const;
  const LIGHT_BLUE = [239, 246, 255] as const;
  const GRAY = [100, 116, 139] as const;
  const DARK = [30, 41, 59] as const;

  const catRgb = (cat: string): [number, number, number] => {
    const map: Record<string, [number, number, number]> = {
      "Port Navigation":    [14, 165, 233],
      "Port Dues":          [59, 130, 246],
      "Regulatory":         [139, 92, 246],
      "Chamber & Official": [99, 102, 241],
      "Disbursement":       [100, 116, 139],
      "Agency":             [20, 184, 166],
      "Supervision":        [16, 185, 129],
    };
    return map[cat] ?? [100, 116, 139];
  };

  // Header background
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 28, "F");

  doc.setTextColor(147, 197, 253);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("VesselPDA", 14, 9);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Proforma Disbursement Account — Summary", 14, 17);

  doc.setFontSize(9);
  doc.setTextColor(147, 197, 253);
  doc.text(`${data.vesselName}  •  ${data.portName}  •  ${fmtDate(data.calculatedAt)}`, 14, 24);

  y = 34;

  // Meta row
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const meta: string[] = [];
  if (data.tariffSource) meta.push(data.tariffSource === "database" ? "Source: DB Tariff" : "Source: Estimate");
  if (data.portTariffName) meta.push(`Tariff: ${data.portTariffName}`);
  if (data.exchangeRates?.usdTry) meta.push(`1 USD = ${data.exchangeRates.usdTry} TRY`);
  if (meta.length) { doc.text(meta.join("   |   "), 14, y); y += 5; }

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pw - 28, 6, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("DESCRIPTION", 16, y + 4.2);
  doc.text("USD", pw - 44, y + 4.2, { align: "right" });
  doc.text("EUR", pw - 14, y + 4.2, { align: "right" });
  y += 7;

  const grouped: GroupedItem[] = data.groupedBreakdown ?? [];

  for (const group of grouped) {
    const rgb = catRgb(group.category);

    // Category header row
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, pw - 28, 6, "F");
    doc.setDrawColor(...rgb);
    doc.setLineWidth(0.8);
    doc.line(14, y, 14, y + 6);
    doc.setLineWidth(0.2);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb);
    doc.text(group.category.toUpperCase(), 17, y + 4.2);
    doc.text(`$${fmt(group.subtotalUsd)}`, pw - 44, y + 4.2, { align: "right" });
    y += 7;

    // Item rows
    for (const item of group.items) {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      const desc = item.description.length > 60 ? item.description.slice(0, 57) + "…" : item.description;
      doc.text(desc, 20, y + 4);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "normal");
      doc.text(`$${fmt(item.amountUsd)}`, pw - 44, y + 4, { align: "right" });
      doc.setTextColor(...GRAY);
      doc.text(`€${fmt(item.amountEur)}`, pw - 14, y + 4, { align: "right" });

      // Subtle divider
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 5.5, pw - 14, y + 5.5);
      y += 6;
    }
    y += 1;
  }

  // Total row
  if (y > 265) { doc.addPage(); y = 14; }
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(14, y, pw - 28, 8, "F");
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(14, y, pw - 14, y);
  doc.setLineWidth(0.2);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("TOTAL PORT EXPENSES", 16, y + 5.5);
  doc.setTextColor(...BLUE);
  doc.text(`$${fmt(data.totalUsd)}`, pw - 44, y + 5.5, { align: "right" });
  doc.setTextColor(59, 130, 246);
  doc.text(`€${fmt(data.totalEur)}`, pw - 14, y + 5.5, { align: "right" });
  y += 12;

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Generated by VesselPDA  •  ${fmtDate(data.calculatedAt)}  •  This is a preliminary estimate only.`,
    pw / 2,
    y,
    { align: "center" }
  );

  doc.save(`proforma-summary-${data.vesselName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
