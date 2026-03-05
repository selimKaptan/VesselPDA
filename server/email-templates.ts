function baseTemplate(content: string, footerText?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VesselPDA</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0B1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 24px 0 8px; }
    .logo-icon { font-size: 28px; display: block; margin-bottom: 4px; }
    .logo { font-size: 22px; font-weight: 700; color: #38BDF8; letter-spacing: 0.05em; }
    .card { background-color: #1a2744; border-radius: 12px; padding: 32px; margin: 12px 0; border: 1px solid #2d3a56; }
    h1 { color: #f1f5f9; font-size: 20px; margin: 0 0 8px 0; }
    h2 { color: #f1f5f9; font-size: 17px; margin: 0 0 8px 0; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 8px 0; }
    a { color: #38BDF8; }
    .btn { display: inline-block; padding: 12px 28px; background-color: #38BDF8; color: #0B1120 !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 8px 4px; }
    .btn-green { background-color: #22C55E; color: #fff !important; }
    .btn-red { background-color: #EF4444; color: #fff !important; }
    .btn-secondary { background-color: transparent; border: 1px solid #38BDF8; color: #38BDF8 !important; }
    .info-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #2d3a56; }
    .info-label { color: #64748b; font-size: 13px; }
    .info-value { color: #f1f5f9; font-size: 13px; font-weight: 500; }
    .table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .table th { text-align: left; padding: 8px; color: #64748b; font-size: 12px; border-bottom: 1px solid #2d3a56; }
    .table td { padding: 8px; color: #f1f5f9; font-size: 13px; border-bottom: 1px solid #1e2d4a; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-green { background-color: rgba(34,197,94,0.15); color: #22C55E; }
    .badge-amber { background-color: rgba(245,158,11,0.15); color: #F59E0B; }
    .badge-sky { background-color: rgba(56,189,248,0.15); color: #38BDF8; }
    .amount { font-size: 26px; font-weight: 700; color: #38BDF8; }
    .divider { height: 1px; background-color: #2d3a56; margin: 18px 0; border: none; }
    .footer { text-align: center; padding: 20px 0 28px; color: #475569; font-size: 12px; line-height: 1.8; }
    .footer a { color: #38BDF8; text-decoration: none; }
    .cta-center { text-align: center; padding: 16px 0 8px; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 7px 0; border-bottom: 1px solid #2d3a56; font-size: 13px; }
    .info-table td:first-child { color: #64748b; width: 42%; }
    .info-table td:last-child { color: #f1f5f9; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="logo-icon">⚓</span>
      <div class="logo">VesselPDA</div>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p style="margin:4px 0;color:#475569;font-size:12px">${footerText || "This email was sent by VesselPDA"}</p>
      <p style="margin:4px 0;color:#475569;font-size:12px"><a href="https://vesselpda.com" style="color:#38BDF8;text-decoration:none">vesselpda.com</a> — Maritime Operations Platform</p>
      <p style="margin:4px 0;color:#475569;font-size:12px">Made with ⚓ in Izmir, Turkey</p>
    </div>
  </div>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #2d3a56;color:#64748b;font-size:13px;width:42%">${label}</td>
    <td style="padding:7px 0;border-bottom:1px solid #2d3a56;color:#f1f5f9;font-size:13px;font-weight:500">${value}</td>
  </tr>`;
}

function btn(label: string, url: string, color: "sky" | "green" | "red" | "outline" = "sky"): string {
  const styles: Record<string, string> = {
    sky: "background-color:#38BDF8;color:#0B1120",
    green: "background-color:#22C55E;color:#ffffff",
    red: "background-color:#EF4444;color:#ffffff",
    outline: "background-color:transparent;border:1px solid #38BDF8;color:#38BDF8",
  };
  return `<a href="${url}" style="display:inline-block;padding:12px 26px;${styles[color]};text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;margin:6px 4px">${label}</a>`;
}

export function pdaSentTemplate(params: {
  recipientName: string;
  vesselName: string;
  portName: string;
  referenceNumber: string;
  totalUsd: number;
  totalEur: number;
  senderName: string;
  senderCompany: string;
  approveUrl: string;
  revisionUrl: string;
  message?: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">Proforma Disbursement Account</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.recipientName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">${params.message || "Please find below the Proforma Disbursement Account for your review."}</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Reference", params.referenceNumber)}
      ${infoRow("Vessel", params.vesselName)}
      ${infoRow("Port", params.portName)}
    </table>
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:26px;font-weight:700;color:#38BDF8">$${params.totalUsd.toLocaleString("en")}</div>
      <p style="margin:4px 0;color:#94a3b8;font-size:13px">€${params.totalEur.toLocaleString("en")}</p>
    </div>
    <div style="text-align:center;padding:8px 0 16px">
      ${btn("✓ Approve PDA", params.approveUrl, "green")}
      ${btn("Request Revision", params.revisionUrl, "red")}
    </div>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <p style="font-size:12px;color:#475569;margin:6px 0">A PDF copy is attached to this email.</p>
    <p style="font-size:12px;color:#475569;margin:6px 0">Sent by ${params.senderName} — ${params.senderCompany}</p>
  `;
  return {
    subject: `PDA for Review: ${params.vesselName} at ${params.portName} [${params.referenceNumber}]`,
    html: baseTemplate(content),
  };
}

export function pdaFullTemplate(params: {
  toEmail: string;
  subject: string;
  message?: string;
  referenceNumber: string;
  vesselName: string;
  portName: string;
  purposeOfCall: string;
  totalUsd: number;
  totalEur: number;
  exchangeRate: number;
  lineItems: Array<{ description: string; amountUsd: number; notes?: string }>;
  bankDetails?: {
    bankName?: string;
    swiftCode?: string;
    usdIban?: string;
    eurIban?: string;
    beneficiary?: string;
    branch?: string;
  };
  createdAt: string;
  toCompany?: string;
}): { subject: string; html: string } {
  const lineItemRows = params.lineItems.map(item => `
    <tr style="border-bottom:1px solid #1e2d4a">
      <td style="padding:8px;font-size:13px;color:#f1f5f9">${item.description}${item.notes ? ` <span style="color:#64748b;font-size:11px">(${item.notes})</span>` : ""}</td>
      <td style="padding:8px;font-size:13px;color:#f1f5f9;text-align:right;font-family:monospace">$${item.amountUsd.toLocaleString("en", { minimumFractionDigits: 2 })}</td>
      <td style="padding:8px;font-size:13px;color:#f1f5f9;text-align:right;font-family:monospace">€${(item.amountUsd / params.exchangeRate).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
    </tr>`).join("");

  const bankSection = params.bankDetails ? `
    <div style="margin-top:20px;background:#0f1a30;border-radius:8px;padding:16px 20px;border:1px solid #2d3a56">
      <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Bank Details</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${params.bankDetails.bankName ? infoRow("Bank", params.bankDetails.bankName) : ""}
        ${params.bankDetails.swiftCode ? infoRow("SWIFT", params.bankDetails.swiftCode) : ""}
        ${params.bankDetails.usdIban ? infoRow("USD IBAN", params.bankDetails.usdIban) : ""}
        ${params.bankDetails.eurIban ? infoRow("EUR IBAN", params.bankDetails.eurIban) : ""}
        ${params.bankDetails.beneficiary ? infoRow("Beneficiary", params.bankDetails.beneficiary) : ""}
      </table>
    </div>` : "";

  const msgSection = params.message ? `
    <div style="margin-bottom:20px;background:#0f1a30;border-left:3px solid #38BDF8;border-radius:0 8px 8px 0;padding:14px 18px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#38BDF8;text-transform:uppercase">Message from Agent</p>
      <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.6;white-space:pre-wrap">${params.message}</p>
    </div>` : "";

  const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <h1 style="color:#f1f5f9;font-size:18px;margin:0 0 4px 0">Proforma Disbursement Account</h1>
        <p style="margin:0;color:#64748b;font-size:13px">${params.referenceNumber}</p>
      </div>
      <p style="margin:0;color:#64748b;font-size:12px">${new Date(params.createdAt).toLocaleDateString("en-GB")}</p>
    </div>
    ${msgSection}
    <div style="background:#0f1a30;border-radius:8px;padding:14px 18px;margin-bottom:18px;border:1px solid #2d3a56">
      <table style="width:100%;border-collapse:collapse">
        ${infoRow("Vessel", params.vesselName)}
        ${infoRow("Port", params.portName)}
        ${infoRow("Purpose", params.purposeOfCall)}
        ${params.toCompany ? infoRow("Addressed To", params.toCompany) : ""}
        ${infoRow("Exchange Rate", `1 USD = ${params.exchangeRate.toFixed(4)} EUR`)}
      </table>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #2d3a56;border-radius:8px;overflow:hidden;margin-bottom:18px">
      <thead>
        <tr style="background:#1e3a5f">
          <th style="padding:9px 10px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;text-transform:uppercase">Description</th>
          <th style="padding:9px 10px;font-size:11px;color:#94a3b8;text-align:right;font-weight:600;text-transform:uppercase">USD</th>
          <th style="padding:9px 10px;font-size:11px;color:#94a3b8;text-align:right;font-weight:600;text-transform:uppercase">EUR</th>
        </tr>
      </thead>
      <tbody>${lineItemRows}</tbody>
      <tfoot>
        <tr style="background:#0f1a30">
          <td style="padding:10px;font-size:14px;font-weight:700;color:#f1f5f9">Total Port Expenses</td>
          <td style="padding:10px;font-size:14px;font-weight:700;color:#38BDF8;text-align:right;font-family:monospace">$${params.totalUsd.toLocaleString("en", { minimumFractionDigits: 2 })}</td>
          <td style="padding:10px;font-size:14px;font-weight:700;color:#38BDF8;text-align:right;font-family:monospace">€${params.totalEur.toLocaleString("en", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>
    ${bankSection}
    <div style="margin-top:16px;padding:10px 14px;background:#0f1a30;border-radius:6px;border:1px solid #2d3a56">
      <p style="margin:0;color:#475569;font-size:11px;font-style:italic">This proforma disbursement account is an estimate only. Actual charges are subject to change based on vessel call conditions and applicable tariffs.</p>
    </div>
  `;
  return {
    subject: params.subject,
    html: baseTemplate(content),
  };
}

export function pdaApprovalRequestTemplate(params: {
  toEmail: string;
  subject: string;
  message: string;
  referenceNumber: string;
  vesselName: string;
  portName: string;
  totalUsd: number;
  approvalToken: string;
  lineItems: Array<{ description: string; amountUsd?: number; quantity?: number; unit?: string }>;
}): { subject: string; html: string } {
  const BASE = "https://vesselpda.com";
  const approveUrl = `${BASE}/api/proformas/approve-link?token=${params.approvalToken}&action=approve`;
  const revisionUrl = `${BASE}/api/proformas/approve-link?token=${params.approvalToken}&action=revision`;

  const lineItemRows = params.lineItems.slice(0, 8).map(item =>
    `<tr style="border-bottom:1px solid #1e2d4a">
      <td style="padding:7px 10px;font-size:13px;color:#cbd5e1">${item.description}</td>
      <td style="padding:7px 10px;font-size:13px;color:#f1f5f9;text-align:right;font-family:monospace">$${(item.amountUsd || 0).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
    </tr>`
  ).join("");

  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 16px 0">Proforma Disbursement Account for Review</h1>
    ${params.message ? `<div style="background:#0f1a30;border-left:3px solid #38BDF8;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:18px">
      <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7">${params.message}</p>
    </div>` : ""}
    <div style="background:#0f1a30;border-radius:8px;padding:14px 18px;margin-bottom:18px;border:1px solid #2d3a56">
      <table style="width:100%;border-collapse:collapse">
        ${infoRow("Reference", params.referenceNumber)}
        ${infoRow("Vessel", params.vesselName)}
        ${infoRow("Port", params.portName)}
        ${infoRow("Estimated Total", `<strong style="color:#38BDF8;font-size:15px">$${params.totalUsd.toLocaleString("en", { minimumFractionDigits: 2 })}</strong>`)}
      </table>
    </div>
    ${lineItemRows ? `<table style="width:100%;border-collapse:collapse;border:1px solid #2d3a56;border-radius:8px;overflow:hidden;margin-bottom:18px">
      <thead><tr style="background:#1e3a5f">
        <th style="padding:8px 10px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;text-transform:uppercase">Description</th>
        <th style="padding:8px 10px;font-size:11px;color:#94a3b8;text-align:right;font-weight:600;text-transform:uppercase">Amount (USD)</th>
      </tr></thead>
      <tbody>${lineItemRows}</tbody>
      <tfoot><tr style="background:#0f1a30">
        <td style="padding:9px 10px;font-size:14px;font-weight:700;color:#f1f5f9">Total</td>
        <td style="padding:9px 10px;font-size:14px;font-weight:700;color:#38BDF8;text-align:right;font-family:monospace">$${params.totalUsd.toLocaleString("en", { minimumFractionDigits: 2 })}</td>
      </tr></tfoot>
    </table>` : ""}
    <p style="color:#94a3b8;font-size:14px;margin:0 0 14px 0">Please review the above proforma and take one of the following actions:</p>
    <div style="text-align:center;padding:8px 0 16px">
      ${btn("✓ Approve PDA", approveUrl, "green")}
      ${btn("↩ Request Revision", revisionUrl, "red")}
    </div>
    <p style="color:#475569;font-size:11px;margin:4px 0">Approve: ${approveUrl}</p>
    <p style="color:#475569;font-size:11px;margin:4px 0">Revision: ${revisionUrl}</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <p style="color:#475569;font-size:12px;margin:0">You received this because a ship agent sent you a PDA for review via VesselPDA.</p>
  `;
  return {
    subject: params.subject,
    html: baseTemplate(content),
  };
}

export function newTenderTemplate(params: {
  agentName: string;
  vesselName: string;
  portName: string;
  cargoType: string;
  cargoQuantity: string;
  expiryHours: number;
  tenderUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">📢 New Port Call Tender</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.agentName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">A new tender matching your served ports has been posted. Submit your bid quickly.</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Vessel", params.vesselName)}
      ${infoRow("Port", params.portName)}
      ${infoRow("Cargo", `${params.cargoType} — ${params.cargoQuantity}`)}
      ${infoRow("Expires In", `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background-color:rgba(245,158,11,0.15);color:#F59E0B">${params.expiryHours} hours</span>`)}
    </table>
    <div style="text-align:center;padding:18px 0 10px">
      ${btn("View Tender & Submit Bid →", params.tenderUrl, "sky")}
    </div>
  `;
  return {
    subject: `New Tender: ${params.vesselName} at ${params.portName}`,
    html: baseTemplate(content),
  };
}

export function bidReceivedTemplate(params: {
  shipownerName: string;
  agentName: string;
  agentCompany: string;
  vesselName: string;
  portName: string;
  bidAmount: number;
  currency: string;
  tenderUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">New Bid Received</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.shipownerName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">A new bid has been submitted on your tender.</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Agent", `${params.agentName}${params.agentCompany ? ` — ${params.agentCompany}` : ""}`)}
      ${infoRow("Vessel", params.vesselName)}
      ${infoRow("Port", params.portName)}
      ${infoRow("Bid Amount", `<span style="font-size:18px;font-weight:700;color:#38BDF8">${params.currency} ${params.bidAmount.toLocaleString("en")}</span>`)}
    </table>
    <div style="text-align:center;padding:18px 0 10px">
      ${btn("Review Bids →", params.tenderUrl, "sky")}
    </div>
  `;
  return {
    subject: `New Bid: ${params.agentCompany || params.agentName} for ${params.vesselName}`,
    html: baseTemplate(content),
  };
}

export function bidSelectedTemplate(params: {
  agentName: string;
  agentCompany: string;
  vesselName: string;
  portName: string;
  tenderUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">🎉 Congratulations — Your Bid Was Selected!</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.agentName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">
      Your proforma bid for the port call tender at <strong style="color:#f1f5f9">${params.portName}</strong>${params.vesselName ? ` (${params.vesselName})` : ""} has been selected by the shipowner.
    </p>
    <div style="background:#0f2a1a;border-left:3px solid #22C55E;border-radius:0 8px 8px 0;padding:14px 18px;margin:18px 0">
      <p style="margin:0;color:#4ade80;font-size:14px;font-weight:600">You will be contacted by the shipowner for next steps.</p>
    </div>
    <div style="text-align:center;padding:10px 0 8px">
      ${btn("View Tender →", params.tenderUrl, "sky")}
    </div>
  `;
  return {
    subject: `🎉 Your bid was selected — ${params.portName}`,
    html: baseTemplate(content),
  };
}

export function nominationTemplate(params: {
  agentName: string;
  agentCompanyName: string;
  portName: string;
  vesselName?: string;
  flag?: string;
  grt?: string | number;
  nrt?: string | number;
  cargoType?: string;
  cargoQuantity?: string;
  previousPort?: string;
  note?: string;
  shipownerName?: string;
  nominationUrl?: string;
}): { subject: string; html: string } {
  const vesselRows = [
    params.vesselName ? infoRow("Vessel Name", params.vesselName) : "",
    params.flag ? infoRow("Flag", params.flag) : "",
    params.grt ? infoRow("GRT", Number(params.grt).toLocaleString("en")) : "",
    params.nrt ? infoRow("NRT", Number(params.nrt).toLocaleString("en")) : "",
    params.cargoType ? infoRow("Cargo Type", params.cargoType) : "",
    params.cargoQuantity ? infoRow("Cargo Quantity", params.cargoQuantity) : "",
    params.previousPort ? infoRow("Previous Port", params.previousPort) : "",
  ].filter(Boolean).join("");

  const noteSection = params.note ? `
    <div style="margin-top:16px;background:#0f1a30;border-left:3px solid #38BDF8;border-radius:0 8px 8px 0;padding:12px 16px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase">Shipowner Note</p>
      <p style="margin:0;color:#cbd5e1;font-size:14px">${params.note}</p>
    </div>` : "";

  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">🤝 You've Been Nominated!</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.agentName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">
      You have been nominated as port agent${params.shipownerName ? ` by <strong style="color:#f1f5f9">${params.shipownerName}</strong>` : ""}.
    </p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <div style="background:#0f1a30;border-radius:8px;padding:12px 18px;margin-bottom:14px;border:1px solid #2d3a56">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase">Port</p>
      <p style="margin:0;font-size:17px;font-weight:700;color:#38BDF8">${params.portName}</p>
    </div>
    ${vesselRows ? `<table style="width:100%;border-collapse:collapse">${vesselRows}</table>` : ""}
    ${noteSection}
    <div style="text-align:center;padding:18px 0 10px">
      ${params.nominationUrl ? btn("Accept Nomination", params.nominationUrl, "green") : ""}
      ${params.nominationUrl ? btn("View Details", params.nominationUrl, "outline") : ""}
    </div>
  `;
  return {
    subject: `Agent Nomination: ${params.vesselName ? `${params.vesselName} at ` : ""}${params.portName}`,
    html: baseTemplate(content),
  };
}

export function nominationResponseTemplate(params: {
  nominatorName: string;
  agentCompanyName: string;
  status: "accepted" | "declined";
  portName: string;
  vesselName?: string;
  eta?: string;
  notes?: string;
}): { subject: string; html: string } {
  const accepted = params.status === "accepted";
  const statusColor = accepted ? "#22C55E" : "#EF4444";
  const statusBg = accepted ? "#0f2a1a" : "#2a0f0f";
  const statusLabel = accepted ? "Accepted ✓" : "Declined ✗";
  const statusMessage = accepted
    ? `<strong style="color:#f1f5f9">${params.agentCompanyName}</strong> has accepted your nomination and is ready to handle operations at <strong style="color:#f1f5f9">${params.portName}</strong>.`
    : `<strong style="color:#f1f5f9">${params.agentCompanyName}</strong> was unable to accept your nomination. Please contact a different agent from the directory.`;

  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">Nomination ${statusLabel}</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.nominatorName},</p>
    <div style="background:${statusBg};border-left:3px solid ${statusColor};border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0">
      <p style="margin:0;color:#f1f5f9;font-size:14px;line-height:1.6">${statusMessage}</p>
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Agent", params.agentCompanyName)}
      ${infoRow("Port", params.portName)}
      ${params.vesselName ? infoRow("Vessel", params.vesselName) : ""}
      ${params.eta ? infoRow("ETA", params.eta) : ""}
      ${params.notes ? infoRow("Notes", params.notes) : ""}
    </table>
  `;
  return {
    subject: `Nomination ${statusLabel}: ${params.agentCompanyName} — ${params.portName}`,
    html: baseTemplate(content),
  };
}

export function norTenderedTemplate(params: {
  recipientName: string;
  vesselName: string;
  portName: string;
  norTenderedAt: string;
  masterName: string;
  norUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">📋 Notice of Readiness Tendered</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.recipientName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Notice of Readiness has been tendered for the following vessel.</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Vessel", params.vesselName)}
      ${infoRow("Port", params.portName)}
      ${infoRow("NOR Tendered At", params.norTenderedAt)}
      ${infoRow("Master", params.masterName)}
    </table>
    <div style="text-align:center;padding:18px 0 10px">
      ${btn("Accept NOR", params.norUrl, "green")}
      ${btn("Reject NOR", params.norUrl, "red")}
    </div>
  `;
  return {
    subject: `NOR Tendered: ${params.vesselName} at ${params.portName}`,
    html: baseTemplate(content),
  };
}

export function invoiceCreatedTemplate(params: {
  recipientName: string;
  vesselName: string;
  portName: string;
  invoiceTitle: string;
  amount: number;
  currency: string;
  dueDate: string;
  invoiceUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">💳 New Invoice</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.recipientName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">A new invoice has been issued for port disbursement services.</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Invoice", params.invoiceTitle)}
      ${infoRow("Vessel", params.vesselName)}
      ${infoRow("Port", params.portName)}
      ${infoRow("Due Date", `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background-color:rgba(245,158,11,0.15);color:#F59E0B">${params.dueDate}</span>`)}
    </table>
    <div style="text-align:center;padding:20px 0 8px">
      <div style="font-size:26px;font-weight:700;color:#38BDF8">${params.currency} ${params.amount.toLocaleString("en")}</div>
    </div>
    <div style="text-align:center;padding:8px 0 10px">
      ${btn("View Invoice →", params.invoiceUrl, "sky")}
    </div>
  `;
  return {
    subject: `Invoice: ${params.invoiceTitle} — ${params.currency} ${params.amount.toLocaleString("en")}`,
    html: baseTemplate(content),
  };
}

export function fdaReadyTemplate(params: {
  recipientName: string;
  vesselName: string;
  portName: string;
  referenceNumber: string;
  estimatedUsd: number;
  actualUsd: number;
  variancePercent: number;
  fdaUrl: string;
}): { subject: string; html: string } {
  const varianceColor = params.variancePercent > 0 ? "#EF4444" : "#22C55E";
  const varianceSign = params.variancePercent > 0 ? "+" : "";
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">🧾 Final Disbursement Account Ready</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.recipientName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">The Final Disbursement Account has been prepared for your review.</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Reference", params.referenceNumber)}
      ${infoRow("Vessel", params.vesselName)}
      ${infoRow("Port", params.portName)}
      ${infoRow("Estimated", `$${params.estimatedUsd.toLocaleString("en")}`)}
      ${infoRow("Actual", `<strong style="color:#f1f5f9">$${params.actualUsd.toLocaleString("en")}</strong>`)}
      ${infoRow("Variance", `<span style="color:${varianceColor};font-weight:600">${varianceSign}${params.variancePercent}%</span>`)}
    </table>
    <div style="text-align:center;padding:18px 0 10px">
      ${btn("Review FDA →", params.fdaUrl, "sky")}
    </div>
  `;
  return {
    subject: `FDA Ready: ${params.vesselName} at ${params.portName} [${params.referenceNumber}]`,
    html: baseTemplate(content),
  };
}

export function welcomeTemplate(params: {
  userName: string;
  role: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:22px;margin:0 0 8px 0">Welcome to VesselPDA! 🎉</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.userName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Your account has been created successfully. Welcome aboard!</p>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Role", `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background-color:rgba(56,189,248,0.15);color:#38BDF8">${params.role}</span>`)}
    </table>
    <p style="color:#94a3b8;font-size:14px;margin:16px 0 8px 0">Here's what you can do:</p>
    <p style="color:#94a3b8;font-size:14px;margin:6px 0">📋 Calculate port disbursements instantly</p>
    <p style="color:#94a3b8;font-size:14px;margin:6px 0">📢 Post or bid on port call tenders</p>
    <p style="color:#94a3b8;font-size:14px;margin:6px 0">🗺️ Manage vessel voyages end-to-end</p>
    <p style="color:#94a3b8;font-size:14px;margin:6px 0">📡 Track vessel positions in real-time</p>
    <div style="text-align:center;padding:18px 0 10px">
      ${btn("Go to Dashboard →", params.loginUrl, "sky")}
    </div>
  `;
  return {
    subject: `Welcome to VesselPDA, ${params.userName}!`,
    html: baseTemplate(content),
  };
}

export function verificationTemplate(params: {
  firstName: string;
  verifyUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">Welcome, ${params.firstName}!</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">
      Thank you for joining VesselPDA. Please verify your email address to activate your account.
    </p>
    <div style="text-align:center;padding:20px 0 12px">
      ${btn("✓ Verify Email Address", params.verifyUrl, "green")}
    </div>
    <p style="color:#475569;font-size:12px;margin:12px 0 6px 0">This link expires in 24 hours. If you didn't create an account, please ignore this email.</p>
    <div style="margin-top:12px;padding:10px 14px;background:#0f1a30;border-radius:6px;border:1px solid #2d3a56">
      <p style="margin:0;color:#475569;font-size:11px;word-break:break-all">Or copy this link: ${params.verifyUrl}</p>
    </div>
  `;
  return {
    subject: "Verify your VesselPDA email address",
    html: baseTemplate(content, "You received this because you created a VesselPDA account."),
  };
}

export function passwordResetTemplate(params: {
  firstName: string;
  resetUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">Password Reset</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Hello, ${params.firstName}</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">
      We received a request to reset your VesselPDA password. Click the button below to set a new password.
    </p>
    <div style="text-align:center;padding:20px 0 12px">
      ${btn("Reset Password", params.resetUrl, "sky")}
    </div>
    <p style="color:#475569;font-size:12px;margin:12px 0 6px 0">This link expires in 1 hour. If you didn't request a password reset, please ignore this email — your account is safe.</p>
    <div style="margin-top:12px;padding:10px 14px;background:#0f1a30;border-radius:6px;border:1px solid #2d3a56">
      <p style="margin:0;color:#475569;font-size:11px;word-break:break-all">Or copy this link: ${params.resetUrl}</p>
    </div>
  `;
  return {
    subject: "VesselPDA — Password Reset",
    html: baseTemplate(content, "You received this because a password reset was requested for your account."),
  };
}

export function forumReplyTemplate(params: {
  toName: string;
  topicTitle: string;
  topicId: number;
  replyAuthor: string;
  replyPreview: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">New Reply on Your Topic</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Hello ${params.toName || ""},</p>
    <p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 4px 0">Topic</p>
    <p style="color:#f1f5f9;font-size:15px;font-weight:500;margin:0 0 16px 0">${params.topicTitle}</p>
    <div style="background:#0f1a30;border-left:3px solid #38BDF8;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:18px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase">${params.replyAuthor} wrote</p>
      <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.6">${params.replyPreview}</p>
    </div>
    <div style="text-align:center;padding:8px 0 10px">
      ${btn("View Reply →", `https://vesselpda.com/forum/${params.topicId}`, "sky")}
    </div>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <p style="color:#475569;font-size:12px;margin:0">You received this because someone replied to your forum topic on VesselPDA.</p>
  `;
  return {
    subject: `[VesselPDA Forum] New reply: "${params.topicTitle}"`,
    html: baseTemplate(content),
  };
}

export function messageBridgeTemplate(params: {
  toName: string;
  senderName: string;
  content: string;
  fileName?: string;
}): { subject: string; html: string } {
  const fileSection = params.fileName ? `
    <div style="background:#0f1a30;border-radius:8px;padding:10px 14px;margin-top:10px;border:1px solid #2d3a56">
      <span style="font-size:16px">📎</span>
      <span style="color:#94a3b8;font-size:14px;margin-left:6px">${params.fileName}</span>
    </div>` : "";

  const htmlContent = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">New Message — VesselPDA</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Hello ${params.toName || ""},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">
      <strong style="color:#f1f5f9">${params.senderName}</strong> sent you a message via VesselPDA:
    </p>
    <div style="background:#0f1a30;border-left:3px solid #38BDF8;border-radius:0 8px 8px 0;padding:14px 18px;margin:14px 0">
      <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;white-space:pre-wrap">${params.content}</p>
    </div>
    ${fileSection}
    <div style="margin-top:18px">
      <p style="margin:0 0 10px;color:#64748b;font-size:13px">To follow this conversation on the platform:</p>
      <div style="text-align:center;padding:6px 0 10px">
        ${btn("Join VesselPDA →", "https://vesselpda.com/register", "sky")}
      </div>
    </div>
    <hr style="height:1px;background-color:#2d3a56;margin:16px 0;border:none">
    <p style="color:#475569;font-size:12px;margin:0">This email was forwarded via the VesselPDA email bridge feature.</p>
  `;
  return {
    subject: `[VesselPDA] ${params.senderName} sent you a message`,
    html: baseTemplate(htmlContent),
  };
}

export function contactAdminTemplate(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 16px 0">${params.subject}</h1>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
      ${infoRow("Full Name", params.name)}
      ${infoRow("Email", `<a href="mailto:${params.email}" style="color:#38BDF8">${params.email}</a>`)}
    </table>
    <div style="background:#0f1a30;border-radius:8px;padding:14px 18px;border-left:3px solid #38BDF8;border-radius:0 8px 8px 0">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Message</p>
      <p style="margin:0;color:#cbd5e1;white-space:pre-wrap;font-size:14px;line-height:1.6">${params.message}</p>
    </div>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <p style="color:#475569;font-size:12px;margin:0">This message was sent via the VesselPDA contact form.</p>
  `;
  return {
    subject: `[VesselPDA Contact] ${params.subject}`,
    html: baseTemplate(content),
  };
}

export function contactAutoReplyTemplate(params: {
  name: string;
  subject: string;
  message: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 8px 0">We Received Your Message</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.name},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">
      Thank you for reaching out to us. We have received your message regarding <strong style="color:#f1f5f9">"${params.subject}"</strong> and our team will review it shortly.
    </p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">
      We will get back to you as soon as possible. In the meantime, feel free to explore the VesselPDA platform.
    </p>
    <div style="background:#0f1a30;border-radius:8px;padding:14px 18px;border-left:3px solid #2d3a56;margin:16px 0">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase">Your message</p>
      <p style="margin:0;color:#94a3b8;white-space:pre-wrap;font-size:13px;line-height:1.6">${params.message}</p>
    </div>
    <div style="text-align:center;padding:12px 0 10px">
      ${btn("Visit VesselPDA →", "https://vesselpda.com", "sky")}
    </div>
    <hr style="height:1px;background-color:#2d3a56;margin:16px 0;border:none">
    <p style="color:#475569;font-size:12px;margin:0">This is an automated confirmation. Please do not reply — contact us at <a href="mailto:info@vesselpda.com" style="color:#38BDF8">info@vesselpda.com</a>.</p>
  `;
  return {
    subject: `We received your message — VesselPDA`,
    html: baseTemplate(content),
  };
}

export function invoiceReminderTemplate(params: {
  recipientName: string;
  invoiceTitle: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysUntilDue: number;
  invoiceUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#F59E0B;font-size:20px;margin:0 0 8px 0">⏰ Payment Reminder</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.recipientName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">This is a friendly reminder that the following invoice is due soon.</p>
    <div style="text-align:center;padding:16px 0 8px">
      <div style="display:inline-block;padding:10px 24px;background-color:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:10px">
        <span style="font-size:15px;font-weight:700;color:#F59E0B">Due in ${params.daysUntilDue} day${params.daysUntilDue !== 1 ? "s" : ""}</span>
      </div>
    </div>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Invoice", params.invoiceTitle)}
      ${infoRow("Amount", `<span style="font-weight:700;color:#F59E0B">${params.currency} ${params.amount.toLocaleString("en", { minimumFractionDigits: 2 })}</span>`)}
      ${infoRow("Due Date", `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background-color:rgba(245,158,11,0.15);color:#F59E0B">${params.dueDate}</span>`)}
    </table>
    <div style="text-align:center;padding:18px 0 10px">
      <a href="${params.invoiceUrl}" style="display:inline-block;padding:12px 28px;background-color:#F59E0B;color:#0B1120;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Pay Now →</a>
    </div>
    <p style="color:#64748b;font-size:12px;margin:12px 0 0">If you have already made payment, please disregard this reminder. For any questions, contact us at <a href="mailto:info@vesselpda.com" style="color:#F59E0B">info@vesselpda.com</a>.</p>
  `;
  return {
    subject: `Payment Reminder: ${params.invoiceTitle} — Due in ${params.daysUntilDue} day${params.daysUntilDue !== 1 ? "s" : ""}`,
    html: baseTemplate(content),
  };
}

export function invoiceOverdueTemplate(params: {
  recipientName: string;
  invoiceTitle: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  invoiceUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="color:#EF4444;font-size:20px;margin:0 0 8px 0">🚨 Payment Overdue</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Dear ${params.recipientName},</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0">Your invoice payment is now overdue. Please arrange payment as soon as possible to avoid any service interruptions.</p>
    <div style="text-align:center;padding:16px 0 8px">
      <div style="display:inline-block;padding:10px 24px;background-color:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:10px">
        <span style="font-size:15px;font-weight:700;color:#EF4444">${params.daysOverdue} day${params.daysOverdue !== 1 ? "s" : ""} past due</span>
      </div>
    </div>
    <hr style="height:1px;background-color:#2d3a56;margin:18px 0;border:none">
    <table style="width:100%;border-collapse:collapse">
      ${infoRow("Invoice", params.invoiceTitle)}
      ${infoRow("Amount", `<span style="font-weight:700;color:#EF4444">${params.currency} ${params.amount.toLocaleString("en", { minimumFractionDigits: 2 })}</span>`)}
      ${infoRow("Was Due", `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background-color:rgba(239,68,68,0.15);color:#EF4444">${params.dueDate}</span>`)}
    </table>
    <div style="text-align:center;padding:18px 0 10px">
      <a href="${params.invoiceUrl}" style="display:inline-block;padding:12px 28px;background-color:#EF4444;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Pay Now Immediately →</a>
    </div>
    <p style="color:#64748b;font-size:12px;margin:12px 0 0">If you believe this is an error or have already made payment, please contact us immediately at <a href="mailto:info@vesselpda.com" style="color:#EF4444">info@vesselpda.com</a>.</p>
  `;
  return {
    subject: `OVERDUE: ${params.invoiceTitle} — ${params.daysOverdue} day${params.daysOverdue !== 1 ? "s" : ""} past due`,
    html: baseTemplate(content),
  };
}

export function orgInviteTemplate(params: {
  recipientEmail: string;
  organizationName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}): { subject: string; html: string } {
  const subject = `You've been invited to join ${params.organizationName} on VesselPDA`;
  const roleDisplay = params.role.charAt(0).toUpperCase() + params.role.slice(1);
  const content = `
    <h2 style="font-family:Georgia,serif;font-size:22px;color:#F8FAFC;margin:0 0 6px 0">⚓ Team Invitation</h2>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px 0">You have been invited to join a team workspace on VesselPDA — the maritime platform connecting ship agents, shipowners, and service providers.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px 0">
      ${infoRow("Organization", params.organizationName)}
      ${infoRow("Invited By", params.inviterName)}
      ${infoRow("Your Role", `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background-color:rgba(56,189,248,0.15);color:#38BDF8">${roleDisplay}</span>`)}
    </table>
    <div style="text-align:center;padding:16px 0 8px">
      <a href="${params.acceptUrl}" style="display:inline-block;padding:14px 32px;background-color:#38BDF8;color:#0B1120;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">Accept Invitation →</a>
    </div>
    <p style="color:#64748b;font-size:12px;margin:20px 0 0;text-align:center">This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore it.</p>
  `;
  return { subject, html: baseTemplate(content, "VesselPDA Team Management") };
}
