import { Resend } from "resend";

// Replit Resend integration — fetches API key via OAuth connector
let _connectionSettings: any;

async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string } | null> {
  const FROM_EMAIL = "noreply@vesselpda.com";

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) {
    const fallback = process.env.RESEND_API_KEY;
    if (fallback) return { apiKey: fallback, fromEmail: FROM_EMAIL };
    return null;
  }

  try {
    _connectionSettings = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      }
    )
      .then((r) => r.json())
      .then((d) => d.items?.[0]);

    if (!_connectionSettings?.settings?.api_key) {
      console.warn("[email] Resend connector not connected");
      return null;
    }

    return {
      apiKey: _connectionSettings.settings.api_key,
      fromEmail: FROM_EMAIL,
    };
  } catch (err) {
    console.error("[email] Failed to fetch Resend credentials:", err);
    return null;
  }
}

export interface ContactEmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(data: ContactEmailData): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) {
    console.warn("[email] No Resend credentials available — skipping contact email");
    return false;
  }

  const resend = new Resend(creds.apiKey);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>VesselPDA Contact Form</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
          <tr>
            <td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Contact Form Message</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#0f172a">${data.subject}</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
                <tr>
                  <td style="color:#64748b;padding:4px 12px 4px 0;white-space:nowrap">Full Name</td>
                  <td style="font-weight:600;color:#1e293b">${data.name}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;padding:4px 12px 4px 0;white-space:nowrap">Email</td>
                  <td style="font-weight:600;color:#1e293b"><a href="mailto:${data.email}" style="color:#0077BE">${data.email}</a></td>
                </tr>
              </table>
              <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;border-left:3px solid #003D7A">
                <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Message</p>
                <p style="margin:0;color:#1e293b;white-space:pre-wrap;font-size:14px;line-height:1.6">${data.message}</p>
              </div>
              <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0">
                <p style="margin:0;color:#94a3b8;font-size:12px">This message was sent via the VesselPDA contact form.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
              <p style="margin:0;color:#94a3b8;font-size:12px">© ${new Date().getFullYear()} VesselPDA · <a href="https://vesselpda.com" style="color:#0077BE;text-decoration:none">vesselpda.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: ["info@vesselpda.com"],
      replyTo: `${data.name} <${data.email}>`,
      subject: `[VesselPDA Contact] ${data.subject}`,
      html,
    });

    if (error) {
      console.error("[email] Resend contact error:", error);
      return false;
    }

    console.log(`[email] Contact email sent from ${data.email}`);

    // Auto-reply confirmation to the sender
    try {
      const confirmHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Message Received — VesselPDA</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
          <tr>
            <td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Message Confirmation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">Dear ${data.name},</p>
              <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7">
                Thank you for reaching out to us. We have received your message regarding <strong>"${data.subject}"</strong> and our team will review it shortly.
              </p>
              <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.7">
                We will get back to you as soon as possible. In the meantime, feel free to explore the VesselPDA platform.
              </p>
              <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;border-left:3px solid #003D7A;margin-bottom:24px">
                <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Your message</p>
                <p style="margin:0;color:#475569;white-space:pre-wrap;font-size:13px;line-height:1.6">${data.message}</p>
              </div>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#003D7A">
                    <a href="https://vesselpda.com" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none">Visit VesselPDA →</a>
                  </td>
                </tr>
              </table>
              <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0">
                <p style="margin:0;color:#94a3b8;font-size:12px">This is an automated confirmation. Please do not reply to this email — contact us at <a href="mailto:info@vesselpda.com" style="color:#0077BE">info@vesselpda.com</a>.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
              <p style="margin:0;color:#94a3b8;font-size:12px">© ${new Date().getFullYear()} VesselPDA · <a href="https://vesselpda.com" style="color:#0077BE;text-decoration:none">vesselpda.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      await resend.emails.send({
        from: `VesselPDA <${creds.fromEmail}>`,
        to: [data.email],
        subject: `We received your message — VesselPDA`,
        html: confirmHtml,
      });
      console.log(`[email] Auto-reply sent to ${data.email}`);
    } catch (replyErr) {
      console.warn("[email] Auto-reply failed (non-critical):", replyErr);
    }

    return true;
  } catch (err) {
    console.error("[email] Failed to send contact email:", err);
    return false;
  }
}

function emailHeader(subtitle: string) {
  return `<td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
      <p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">${subtitle}</p>
    </td>`;
}
function emailFooter() {
  return `<td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:12px">© ${new Date().getFullYear()} VesselPDA · <a href="https://vesselpda.com" style="color:#0077BE;text-decoration:none">vesselpda.com</a></p>
    </td>`;
}
function emailWrapper(rows: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
      ${rows}
    </table>
  </td></tr></table>
</body></html>`;
}

export interface BidNotificationData {
  ownerEmail?: string;
  ownerName?: string;
  agentEmail?: string;
  agentName?: string;
  portName: string;
  vesselName?: string;
  totalAmount?: string;
  currency?: string;
  tenderId: number;
}

export async function sendBidReceivedEmail(data: BidNotificationData): Promise<boolean> {
  if (!data.ownerEmail) return false;
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendBidReceivedEmail"); return false; }
  const resend = new Resend(creds.apiKey);
  const html = emailWrapper(`
    <tr>${emailHeader("New Bid Received")}</tr>
    <tr><td style="padding:32px">
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">You received a new bid!</p>
      <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7">
        A bid has been submitted for your tender at <strong>${data.portName}</strong>${data.vesselName ? ` for vessel <strong>${data.vesselName}</strong>` : ""}.
      </p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${data.agentName ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Agent</td><td style="font-weight:600">${data.agentName}</td></tr>` : ""}
          ${data.totalAmount ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Offered Amount</td><td style="font-weight:600;color:#003D7A">${data.totalAmount} ${data.currency || "USD"}</td></tr>` : ""}
        </table>
      </div>
      <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#003D7A">
        <a href="https://vesselpda.com/tenders/${data.tenderId}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none">Review Bid →</a>
      </td></tr></table>
    </td></tr>
    <tr>${emailFooter()}</tr>
  `);
  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.ownerEmail],
      subject: `[VesselPDA] New bid received — ${data.portName}`,
      html,
    });
    if (error) { console.error("[email] sendBidReceivedEmail error:", error); return false; }
    console.log(`[email] Bid received email sent to ${data.ownerEmail}`);
    return true;
  } catch (err) { console.error("[email] sendBidReceivedEmail failed:", err); return false; }
}

export async function sendBidSelectedEmail(data: BidNotificationData): Promise<boolean> {
  if (!data.agentEmail) return false;
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendBidSelectedEmail"); return false; }
  const resend = new Resend(creds.apiKey);
  const html = emailWrapper(`
    <tr>${emailHeader("Bid Selected")}</tr>
    <tr><td style="padding:32px">
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">Congratulations — Your bid was selected!</p>
      <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7">
        Your proforma bid for the port call tender at <strong>${data.portName}</strong>${data.vesselName ? ` (${data.vesselName})` : ""} has been selected by the shipowner.
      </p>
      <div style="background:#ecfdf5;border-left:3px solid #10b981;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px">
        <p style="margin:0;color:#065f46;font-size:14px;font-weight:600">You will be contacted by the shipowner for the next steps.</p>
      </div>
      <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#003D7A">
        <a href="https://vesselpda.com/tenders/${data.tenderId}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none">View Tender →</a>
      </td></tr></table>
    </td></tr>
    <tr>${emailFooter()}</tr>
  `);
  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.agentEmail],
      subject: `[VesselPDA] 🎉 Your bid was selected — ${data.portName}`,
      html,
    });
    if (error) { console.error("[email] sendBidSelectedEmail error:", error); return false; }
    console.log(`[email] Bid selected email sent to ${data.agentEmail}`);
    return true;
  } catch (err) { console.error("[email] sendBidSelectedEmail failed:", err); return false; }
}

export interface NewTenderEmailData {
  agentEmail: string;
  agentName?: string;
  portName: string;
  vesselName?: string;
  cargoType?: string;
  cargoQuantity?: string;
  expiryHours: number;
  tenderId: number;
}

export async function sendNewTenderEmail(data: NewTenderEmailData): Promise<boolean> {
  if (!data.agentEmail) return false;
  const creds = await getResendCredentials();
  if (!creds) return false;
  const resend = new Resend(creds.apiKey);
  const html = emailWrapper(`
    <tr>${emailHeader("New Tender Available")}</tr>
    <tr><td style="padding:32px">
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">New tender at ${data.portName}</p>
      <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7">
        A shipowner has posted a new port call tender at <strong>${data.portName}</strong> — a port you serve. Submit your proforma bid quickly as this tender expires in <strong>${data.expiryHours} hours</strong>.
      </p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${data.vesselName ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Vessel</td><td style="font-weight:600">${data.vesselName}</td></tr>` : ""}
          ${data.cargoType ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Cargo Type</td><td style="font-weight:600">${data.cargoType}</td></tr>` : ""}
          ${data.cargoQuantity ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Quantity</td><td style="font-weight:600">${data.cargoQuantity}</td></tr>` : ""}
          <tr><td style="color:#64748b;padding:4px 12px 4px 0">Deadline</td><td style="font-weight:600;color:#dc2626">${data.expiryHours}h from posting</td></tr>
        </table>
      </div>
      <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#003D7A">
        <a href="https://vesselpda.com/tenders/${data.tenderId}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none">View & Submit Bid →</a>
      </td></tr></table>
    </td></tr>
    <tr>${emailFooter()}</tr>
  `);
  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.agentEmail],
      subject: `[VesselPDA] New tender at ${data.portName} — ${data.expiryHours}h deadline`,
      html,
    });
    if (error) { console.error("[email] sendNewTenderEmail error:", error); return false; }
    return true;
  } catch (err) { console.error("[email] sendNewTenderEmail failed:", err); return false; }
}

export interface NominationEmailData {
  agentEmail: string;
  agentCompanyName: string;
  extraEmails?: string[];
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
}

export async function sendNominationEmail(data: NominationEmailData): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) {
    console.warn("[email] No Resend credentials available — skipping email send");
    return false;
  }

  const resend = new Resend(creds.apiKey);
  const toAddresses = [data.agentEmail, ...(data.extraEmails || [])].filter(Boolean);

  const vesselRows = [
    data.vesselName ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Vessel Name</td><td style="font-weight:600">${data.vesselName}</td></tr>` : "",
    data.flag ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Flag</td><td style="font-weight:600">${data.flag}</td></tr>` : "",
    data.grt ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">GRT</td><td style="font-weight:600">${Number(data.grt).toLocaleString()}</td></tr>` : "",
    data.nrt ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">NRT</td><td style="font-weight:600">${Number(data.nrt).toLocaleString()}</td></tr>` : "",
    data.cargoType ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Cargo Type</td><td style="font-weight:600">${data.cargoType}</td></tr>` : "",
    data.cargoQuantity ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Cargo Quantity</td><td style="font-weight:600">${data.cargoQuantity}</td></tr>` : "",
    data.previousPort ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Previous Port</td><td style="font-weight:600">${data.previousPort}</td></tr>` : "",
  ].filter(Boolean).join("");

  const noteSection = data.note
    ? `<div style="margin-top:20px;background:#f8fafc;border-left:3px solid #003D7A;padding:12px 16px;border-radius:0 6px 6px 0">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Shipowner Note</p>
        <p style="margin:0;color:#1e293b">${data.note}</p>
       </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>VesselPDA Nomination</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Nomination Notice</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a">
                ${data.agentCompanyName} — Nomination Confirmed
              </p>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px">
                Below you will find the vessel and port details for this nomination.
              </p>

              <!-- Port -->
              <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Port</p>
                <p style="margin:0;font-size:16px;font-weight:700;color:#003D7A">${data.portName}</p>
              </div>

              <!-- Vessel & Cargo table -->
              ${vesselRows ? `
              <div style="margin-bottom:20px">
                <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Vessel &amp; Cargo Details</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  ${vesselRows}
                </table>
              </div>` : ""}

              ${noteSection}

              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0">
                <p style="margin:0;color:#94a3b8;font-size:12px">This email was sent automatically via the VesselPDA platform.</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
              <p style="margin:0;color:#94a3b8;font-size:12px">© ${new Date().getFullYear()} VesselPDA · <a href="https://vesselpda.com" style="color:#0077BE;text-decoration:none">vesselpda.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: toAddresses,
      subject: `[VesselPDA] Nomination Notice — ${data.portName}${data.vesselName ? ` / ${data.vesselName}` : ""}`,
      html,
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return false;
    }

    console.log(`[email] Nomination email sent to: ${toAddresses.join(", ")}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send nomination email:", err);
    return false;
  }
}
