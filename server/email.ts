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

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string
): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) {
    console.warn("[email] No Resend credentials — skipping verification email");
    return false;
  }

  const resend = new Resend(creds.apiKey);
  const verifyUrl = `https://vesselpda.com/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Email Verification — VesselPDA</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
          <tr>
            <td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Email Verification / Email Doğrulama</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">Welcome, ${firstName}!</p>
              <p style="margin:0 0 8px;color:#475569;font-size:15px;line-height:1.6">
                Thank you for joining VesselPDA. Please verify your email address to activate your account.
              </p>
              <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6">
                Hesabınızı etkinleştirmek için lütfen e-posta adresinizi doğrulayın.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#003D7A;border-radius:8px;padding:0">
                    <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px">
                      ✓ Verify Email / Emaili Doğrula
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">
                This link expires in 24 hours. If you didn't create an account, please ignore this email.<br>
                Bu link 24 saat içinde geçerliliğini yitirir. Hesap oluşturmadıysanız bu emaili görmezden gelin.
              </p>
              <div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
                <p style="margin:0;color:#64748b;font-size:11px;word-break:break-all">Or copy: ${verifyUrl}</p>
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
      to: [to],
      subject: "VesselPDA — Email Adresinizi Doğrulayın / Verify Your Email",
      html,
    });

    if (error) {
      console.error("[email] Resend verification error:", error);
      return false;
    }

    console.log(`[email] Verification email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send verification email:", err);
    return false;
  }
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string
): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) {
    console.warn("[email] No Resend credentials — skipping password reset email");
    return false;
  }

  const resend = new Resend(creds.apiKey);
  const resetUrl = `https://vesselpda.com/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password Reset — VesselPDA</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
          <tr>
            <td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Password Reset / Şifre Sıfırlama</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">Hello, ${firstName}</p>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6">
                We received a request to reset your VesselPDA password. Click the button below to set a new password.<br><br>
                VesselPDA şifrenizi sıfırlamak için bir istek aldık. Yeni şifre belirlemek için aşağıdaki butona tıklayın.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#003D7A;border-radius:8px;padding:0">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px">
                      Reset Password / Şifreyi Sıfırla
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">
                This link expires in 1 hour. If you didn't request a password reset, please ignore this email — your account is safe.<br>
                Bu link 1 saat içinde geçerliliğini yitirir. Şifre sıfırlama isteği siz yapmadıysanız bu emaili görmezden gelin.
              </p>
              <div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
                <p style="margin:0;color:#64748b;font-size:11px;word-break:break-all">Or copy: ${resetUrl}</p>
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
      to: [to],
      subject: "VesselPDA — Şifre Sıfırlama / Password Reset",
      html,
    });

    if (error) {
      console.error("[email] Resend password reset error:", error);
      return false;
    }

    console.log(`[email] Password reset email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err);
    return false;
  }
}

export interface ForumReplyEmailData {
  toEmail: string;
  topicTitle: string;
  topicId: number;
  replyAuthor: string;
  replyPreview: string;
}

export async function sendForumReplyEmail(data: ForumReplyEmailData): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendForumReplyEmail"); return false; }
  const resend = new Resend(creds.apiKey);
  const html = emailWrapper(`
    <tr>${emailHeader("New Reply on Your Topic")}</tr>
    <tr><td style="padding:32px">
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">Someone replied to your topic</p>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Topic</p>
      <p style="margin:0 0 20px;color:#1e293b;font-size:15px;font-weight:500">${data.topicTitle}</p>
      <div style="background:#f8fafc;border-left:3px solid #003D7A;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">${data.replyAuthor} wrote</p>
        <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">${data.replyPreview}</p>
      </div>
      <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#003D7A">
        <a href="https://vesselpda.com/forum/${data.topicId}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none">View Reply →</a>
      </td></tr></table>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px">You are receiving this because someone replied to your forum topic on VesselPDA.</p>
      </div>
    </td></tr>
    <tr>${emailFooter()}</tr>
  `);
  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.toEmail],
      subject: `[VesselPDA Forum] New reply: "${data.topicTitle}"`,
      html,
    });
    if (error) { console.error("[email] sendForumReplyEmail error:", error); return false; }
    console.log(`[email] Forum reply notification sent to ${data.toEmail}`);
    return true;
  } catch (err) { console.error("[email] sendForumReplyEmail failed:", err); return false; }
}

export interface ProformaEmailData {
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
}

export async function sendProformaEmail(data: ProformaEmailData): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendProformaEmail"); return false; }
  const resend = new Resend(creds.apiKey);

  const lineItemRows = data.lineItems.map(item => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 12px;font-size:13px;color:#1e293b">${item.description}${item.notes ? ` <span style="color:#94a3b8;font-size:11px">(${item.notes})</span>` : ""}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1e293b;text-align:right;font-family:monospace">$${item.amountUsd.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1e293b;text-align:right;font-family:monospace">€${(item.amountUsd / data.exchangeRate).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`).join("");

  const bankSection = data.bankDetails ? `
    <div style="margin-top:24px;background:#f8fafc;border-radius:8px;padding:16px 20px">
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Bank Details</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${data.bankDetails.bankName ? `<tr><td style="color:#64748b;padding:3px 12px 3px 0">Bank</td><td style="color:#1e293b;font-weight:500">${data.bankDetails.bankName}</td></tr>` : ""}
        ${data.bankDetails.swiftCode ? `<tr><td style="color:#64748b;padding:3px 12px 3px 0">SWIFT</td><td style="color:#1e293b;font-weight:500">${data.bankDetails.swiftCode}</td></tr>` : ""}
        ${data.bankDetails.usdIban ? `<tr><td style="color:#64748b;padding:3px 12px 3px 0">USD IBAN</td><td style="color:#1e293b;font-weight:500;word-break:break-all">${data.bankDetails.usdIban}</td></tr>` : ""}
        ${data.bankDetails.eurIban ? `<tr><td style="color:#64748b;padding:3px 12px 3px 0">EUR IBAN</td><td style="color:#1e293b;font-weight:500;word-break:break-all">${data.bankDetails.eurIban}</td></tr>` : ""}
        ${data.bankDetails.beneficiary ? `<tr><td style="color:#64748b;padding:3px 12px 3px 0">Beneficiary</td><td style="color:#1e293b;font-weight:500">${data.bankDetails.beneficiary}</td></tr>` : ""}
      </table>
    </div>` : "";

  const messageSection = data.message ? `
    <div style="margin-bottom:24px;background:#f0f9ff;border-left:3px solid #0077BE;border-radius:0 8px 8px 0;padding:14px 18px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#0369a1;text-transform:uppercase;letter-spacing:.05em">Message</p>
      <p style="margin:0;color:#0c4a6e;font-size:14px;white-space:pre-wrap">${data.message}</p>
    </div>` : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.subject}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
      <tr><td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
        <table width="100%"><tr>
          <td><p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p><p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px">Proforma Disbursement Account</p></td>
          <td style="text-align:right;vertical-align:top"><p style="margin:0;color:rgba(255,255,255,.9);font-size:13px;font-weight:600">${data.referenceNumber}</p><p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:12px">${new Date(data.createdAt).toLocaleDateString("en-GB")}</p></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 32px">
        ${messageSection}
        <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="color:#64748b;padding:4px 12px 4px 0">Vessel</td><td style="font-weight:600;color:#1e293b">${data.vesselName}</td></tr>
            <tr><td style="color:#64748b;padding:4px 12px 4px 0">Port</td><td style="font-weight:600;color:#1e293b">${data.portName}</td></tr>
            <tr><td style="color:#64748b;padding:4px 12px 4px 0">Purpose</td><td style="font-weight:600;color:#1e293b">${data.purposeOfCall}</td></tr>
            ${data.toCompany ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Addressed To</td><td style="font-weight:600;color:#1e293b">${data.toCompany}</td></tr>` : ""}
            <tr><td style="color:#64748b;padding:4px 12px 4px 0">Exchange Rate</td><td style="font-weight:600;color:#1e293b">1 USD = ${data.exchangeRate.toFixed(4)} EUR</td></tr>
          </table>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
          <thead>
            <tr style="background:#003D7A">
              <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Description</th>
              <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.05em">USD</th>
              <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.05em">EUR</th>
            </tr>
          </thead>
          <tbody>${lineItemRows}</tbody>
          <tfoot>
            <tr style="background:#eff6ff">
              <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#1e3a5f">Total Port Expenses</td>
              <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#1e3a5f;text-align:right;font-family:monospace">$${data.totalUsd.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#1e3a5f;text-align:right;font-family:monospace">€${data.totalEur.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
        ${bankSection}
        <div style="margin-top:20px;padding:12px 16px;background:#fafafa;border-radius:6px">
          <p style="margin:0;color:#94a3b8;font-size:11px;font-style:italic">This proforma disbursement account is an estimate only. Actual charges are subject to change based on vessel call conditions and applicable tariffs.</p>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px">© ${new Date().getFullYear()} VesselPDA · <a href="https://vesselpda.com" style="color:#0077BE;text-decoration:none">vesselpda.com</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.toEmail],
      subject: data.subject,
      html,
    });
    if (error) { console.error("[email] sendProformaEmail error:", error); return false; }
    console.log(`[email] Proforma email sent to ${data.toEmail}`);
    return true;
  } catch (err) { console.error("[email] sendProformaEmail failed:", err); return false; }
}
