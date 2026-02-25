import { Resend } from "resend";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
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
  const resend = getResendClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    return false;
  }

  const toAddresses = [data.agentEmail, ...(data.extraEmails || [])].filter(Boolean);

  const vesselRows = [
    data.vesselName ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Gemi Adı</td><td style="font-weight:600">${data.vesselName}</td></tr>` : "",
    data.flag ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Bayrak</td><td style="font-weight:600">${data.flag}</td></tr>` : "",
    data.grt ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">GRT</td><td style="font-weight:600">${Number(data.grt).toLocaleString("tr-TR")}</td></tr>` : "",
    data.nrt ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">NRT</td><td style="font-weight:600">${Number(data.nrt).toLocaleString("tr-TR")}</td></tr>` : "",
    data.cargoType ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Yük Türü</td><td style="font-weight:600">${data.cargoType}</td></tr>` : "",
    data.cargoQuantity ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Yük Miktarı</td><td style="font-weight:600">${data.cargoQuantity}</td></tr>` : "",
    data.previousPort ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">Önceki Liman</td><td style="font-weight:600">${data.previousPort}</td></tr>` : "",
  ].filter(Boolean).join("");

  const noteSection = data.note
    ? `<div style="margin-top:20px;background:#f8fafc;border-left:3px solid #003D7A;padding:12px 16px;border-radius:0 6px 6px 0">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Armatör Notu</p>
        <p style="margin:0;color:#1e293b">${data.note}</p>
       </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>VesselPDA Nominasyon</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#003D7A,#0077BE);padding:28px 32px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700">⚓ VesselPDA</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Nominasyon Bildirimi</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a">
                ${data.agentCompanyName} — Nominasyon Tamamlandı
              </p>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px">
                Aşağıda nominasyona ait gemi ve liman bilgilerini bulabilirsiniz.
              </p>

              <!-- Port -->
              <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Liman</p>
                <p style="margin:0;font-size:16px;font-weight:700;color:#003D7A">${data.portName}</p>
              </div>

              <!-- Vessel & Cargo table -->
              ${vesselRows ? `
              <div style="margin-bottom:20px">
                <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Gemi &amp; Yük Bilgileri</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  ${vesselRows}
                </table>
              </div>` : ""}

              ${noteSection}

              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0">
                <p style="margin:0;color:#94a3b8;font-size:12px">Bu email VesselPDA platformu üzerinden otomatik olarak gönderilmiştir.</p>
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
      from: "VesselPDA <noreply@vesselpda.com>",
      to: toAddresses,
      subject: `[VesselPDA] Nominasyon Bildirimi — ${data.portName}${data.vesselName ? ` / ${data.vesselName}` : ""}`,
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
