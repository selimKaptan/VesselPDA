import { Resend } from "resend";
import {
  contactAdminTemplate,
  contactAutoReplyTemplate,
  bidReceivedTemplate,
  bidSelectedTemplate,
  newTenderTemplate,
  nominationTemplate,
  nominationResponseTemplate,
  verificationTemplate,
  passwordResetTemplate,
  forumReplyTemplate,
  messageBridgeTemplate,
  pdaFullTemplate,
  pdaApprovalRequestTemplate,
  orgInviteTemplate,
  voyageInviteTemplate,
  cargoReportTemplate,
} from "./email-templates";
import { db } from "./db";
import { eq, asc } from "drizzle-orm";
import { voyageCargoLogs, voyageCargoReceivers, voyages } from "@shared/schema";
import { vessels } from "@shared/schema";
import { ports } from "@shared/schema";

// Replit Resend integration — fetches API key via OAuth connector
let _connectionSettings: any;

export async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string } | null> {
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
  const { html } = contactAdminTemplate(data);

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
      const { html: confirmHtml } = contactAutoReplyTemplate(data);
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

  const { html, subject } = bidReceivedTemplate({
    shipownerName: data.ownerName || "Shipowner",
    agentName: data.agentName || "",
    agentCompany: "",
    vesselName: data.vesselName || "",
    portName: data.portName,
    bidAmount: parseFloat(data.totalAmount || "0"),
    currency: data.currency || "USD",
    tenderUrl: `https://vesselpda.com/tenders/${data.tenderId}`,
  });

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.ownerEmail],
      subject,
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

  const { html, subject } = bidSelectedTemplate({
    agentName: data.agentName || "",
    agentCompany: "",
    vesselName: data.vesselName || "",
    portName: data.portName,
    tenderUrl: `https://vesselpda.com/tenders/${data.tenderId}`,
  });

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.agentEmail],
      subject,
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

  const { html, subject } = newTenderTemplate({
    agentName: data.agentName || "Agent",
    vesselName: data.vesselName || "",
    portName: data.portName,
    cargoType: data.cargoType || "",
    cargoQuantity: data.cargoQuantity || "",
    expiryHours: data.expiryHours,
    tenderUrl: `https://vesselpda.com/tenders/${data.tenderId}`,
  });

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.agentEmail],
      subject,
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

  const { html, subject } = nominationTemplate({
    agentName: data.agentCompanyName,
    agentCompanyName: data.agentCompanyName,
    portName: data.portName,
    vesselName: data.vesselName,
    flag: data.flag,
    grt: data.grt,
    nrt: data.nrt,
    cargoType: data.cargoType,
    cargoQuantity: data.cargoQuantity,
    previousPort: data.previousPort,
    note: data.note,
    shipownerName: data.shipownerName,
  });

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: toAddresses,
      subject,
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

export interface NominationResponseEmailData {
  nominatorEmail: string;
  nominatorName: string;
  agentCompanyName: string;
  status: "accepted" | "declined";
  portName: string;
  vesselName?: string;
  eta?: string;
  notes?: string;
}

export async function sendNominationResponseEmail(data: NominationResponseEmailData): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) {
    console.warn("[email] No credentials — skipping sendNominationResponseEmail");
    return false;
  }
  const resend = new Resend(creds.apiKey);

  const { html, subject } = nominationResponseTemplate({
    nominatorName: data.nominatorName,
    agentCompanyName: data.agentCompanyName,
    status: data.status,
    portName: data.portName,
    vesselName: data.vesselName,
    notes: data.notes,
  });

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.nominatorEmail],
      subject,
      html,
    });
    if (error) { console.error("[email] sendNominationResponseEmail error:", error); return false; }
    console.log(`[email] Nomination response email sent to: ${data.nominatorEmail}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send nomination response email:", err);
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
  const { html } = verificationTemplate({ firstName, verifyUrl });

  try {
    const { data, error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [to],
      subject: "VesselPDA — Verify Your Email",
      html,
    });

    if (error) {
      console.error("[email] Resend verification error:", JSON.stringify(error));
      return false;
    }

    console.log(`[email] Verification email sent to ${to} | id=${data?.id}`);
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
  const { html } = passwordResetTemplate({ firstName, resetUrl });

  try {
    const { data, error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [to],
      subject: "VesselPDA — Password Reset",
      html,
    });

    if (error) {
      console.error("[email] Resend password reset error:", JSON.stringify(error));
      return false;
    }

    console.log(`[email] Password reset email sent to ${to} | id=${data?.id}`);
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

  const { html, subject } = forumReplyTemplate({
    toName: data.toEmail,
    topicTitle: data.topicTitle,
    topicId: data.topicId,
    replyAuthor: data.replyAuthor,
    replyPreview: data.replyPreview,
  });

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.toEmail],
      subject,
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

  const { html } = pdaFullTemplate(data);

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

export async function sendMessageBridgeEmail(
  to: string,
  toName: string,
  senderName: string,
  content: string,
  fileName?: string
): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendMessageBridgeEmail"); return false; }
  const resend = new Resend(creds.apiKey);

  const { html, subject } = messageBridgeTemplate({ toName, senderName, content, fileName });

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [to],
      subject,
      html,
    });
    if (error) { console.error("[email] sendMessageBridgeEmail error:", error); return false; }
    console.log(`[email] Message bridge email sent to ${to}`);
    return true;
  } catch (err) { console.error("[email] sendMessageBridgeEmail failed:", err); return false; }
}

export interface ApprovalRequestEmailData {
  toEmail: string;
  subject: string;
  message: string;
  referenceNumber: string;
  vesselName: string;
  portName: string;
  totalUsd: number;
  approvalToken: string;
  lineItems: Array<{ description: string; amountUsd?: number; quantity?: number; unit?: string }>;
}

export async function sendVoyageInviteEmail(
  to: string,
  params: Parameters<typeof voyageInviteTemplate>[0]
): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendVoyageInviteEmail"); return false; }
  const resend = new Resend(creds.apiKey);
  const { subject, html } = voyageInviteTemplate(params);
  try {
    const { error } = await resend.emails.send({ from: `VesselPDA <${creds.fromEmail}>`, to: [to], subject, html });
    if (error) { console.error("[email] sendVoyageInviteEmail error:", error); return false; }
    console.log(`[email] Voyage invite sent to ${to}`);
    return true;
  } catch (err) { console.error("[email] sendVoyageInviteEmail failed:", err); return false; }
}

export async function sendOrgInviteEmail(
  to: string,
  params: { organizationName: string; inviterName: string; role: string; acceptUrl: string }
): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendOrgInviteEmail"); return false; }
  const resend = new Resend(creds.apiKey);
  const { subject, html } = orgInviteTemplate({ recipientEmail: to, ...params });
  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [to],
      subject,
      html,
    });
    if (error) { console.error("[email] sendOrgInviteEmail error:", error); return false; }
    console.log(`[email] Org invite sent to ${to}`);
    return true;
  } catch (err) { console.error("[email] sendOrgInviteEmail failed:", err); return false; }
}

export async function sendApprovalRequestEmail(data: ApprovalRequestEmailData): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendApprovalRequestEmail"); return false; }
  const resend = new Resend(creds.apiKey);

  const { html } = pdaApprovalRequestTemplate(data);

  try {
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.toEmail],
      subject: data.subject,
      html,
    });
    if (error) { console.error("[email] sendApprovalRequestEmail error:", error); return false; }
    console.log(`[email] Approval request email sent to ${data.toEmail}`);
    return true;
  } catch (err) { console.error("[email] sendApprovalRequestEmail failed:", err); return false; }
}

// ─── CARGO REPORT EMAIL ───────────────────────────────────────────────────────

export async function sendCargoReportEmail(data: { toEmail: string; voyageId: number }): Promise<boolean> {
  const creds = await getResendCredentials();
  if (!creds) { console.warn("[email] No credentials — skipping sendCargoReportEmail"); return false; }

  try {
    // Fetch voyage
    const [voyage] = await db.select().from(voyages).where(eq(voyages.id, data.voyageId));
    if (!voyage) { console.warn("[email] Voyage not found:", data.voyageId); return false; }

    // Fetch vessel and port names
    const vesselName = voyage.vesselId
      ? ((await db.select({ name: vessels.name }).from(vessels).where(eq(vessels.id, voyage.vesselId)))[0]?.name ?? "Unknown Vessel")
      : "Unknown Vessel";
    const portName = (await db.select({ name: ports.name }).from(ports).where(eq(ports.id, voyage.portId)))[0]?.name ?? "Unknown Port";

    // Fetch receivers
    const receiversList = await db.select().from(voyageCargoReceivers).where(eq(voyageCargoReceivers.voyageId, data.voyageId));
    const receiverMap: Record<number, string> = Object.fromEntries(receiversList.map(r => [r.id, r.name]));

    // Fetch logs
    const logs = await db.select().from(voyageCargoLogs)
      .where(eq(voyageCargoLogs.voyageId, data.voyageId))
      .orderBy(asc(voyageCargoLogs.createdAt));

    // Compute totals
    const totalMt = voyage.cargoTotalMt ?? 0;
    const handledMt = logs.filter(l => l.logType !== "delay").reduce((s, l) => s + (l.amountHandled ?? 0), 0);
    const remainingMt = Math.max(0, totalMt - handledMt);
    const handledPct = totalMt > 0 ? Math.round((handledMt / totalMt) * 100) : 0;

    // ETC
    const totalHours = logs.reduce((s, l) => {
      if (!l.fromTime || !l.toTime) return s;
      return s + (new Date(l.toTime).getTime() - new Date(l.fromTime).getTime()) / 3_600_000;
    }, 0);
    const avgRatePerDay = totalHours > 0 ? (handledMt / totalHours) * 24 : 0;
    let etcFormatted: string | null = null;
    if (avgRatePerDay > 0 && remainingMt > 0) {
      const etcDate = new Date(Date.now() + (remainingMt / avgRatePerDay) * 86_400_000);
      etcFormatted = etcDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        + ", " + etcDate.toUTCString().slice(17, 22) + " UTC";
    }

    // Group logs by batchId for active receiver detection
    const batchMap = new Map<string, typeof logs>();
    logs.forEach(l => {
      const key = l.batchId || String(l.id);
      if (!batchMap.has(key)) batchMap.set(key, []);
      batchMap.get(key)!.push(l);
    });
    const groupedLogs = Array.from(batchMap.values());
    const lastBatch = groupedLogs.length > 0 ? groupedLogs[groupedLogs.length - 1] : null;
    const activeReceiverNames = lastBatch
      ? lastBatch.filter(l => l.receiverId && l.logType !== "delay")
          .map(l => receiverMap[l.receiverId!] || "")
          .filter(Boolean).join(" & ") || null
      : null;

    // Recent logs (last 5 batches)
    const recentGroups = groupedLogs.slice(-5);
    const fmtDT = (dt: Date | null) => dt
      ? new Date(dt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " +
        new Date(dt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "—";
    const recentLogs = recentGroups.map(batch => {
      const rep = batch[0];
      const batchMt = batch.reduce((s, l) => s + (l.amountHandled ?? 0), 0);
      const batchTrucks = batch.reduce((s, l) => s + (l.truckCount ?? 0), 0);
      const receiverNames = batch.filter(l => l.receiverId).map(l => receiverMap[l.receiverId!] || "").filter(Boolean).join(", ");
      const periodLabel = rep.fromTime && rep.toTime
        ? `${fmtDT(rep.fromTime)} → ${fmtDT(rep.toTime).split(" ")[1]}`
        : fmtDT(rep.logDate);
      return {
        periodLabel,
        receiverNames,
        amountMt: batchMt,
        truckCount: batchTrucks,
        logType: rep.logType ?? "operation",
        remarks: rep.remarks ?? "",
      };
    });

    const sentAt = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      + ", " + new Date().toUTCString().slice(17, 22) + " UTC";

    const { html, subject } = cargoReportTemplate({
      vesselName, portName,
      purposeOfCall: voyage.purposeOfCall,
      totalMt, handledMt, remainingMt, handledPct,
      etcFormatted,
      activeReceiverNames,
      recentLogs,
      sentAt,
    });

    const resend = new Resend(creds.apiKey);
    const { error } = await resend.emails.send({
      from: `VesselPDA <${creds.fromEmail}>`,
      to: [data.toEmail],
      subject,
      html,
    });
    if (error) { console.error("[email] sendCargoReportEmail error:", error); return false; }
    console.log(`[email] Cargo report sent to ${data.toEmail} for voyage ${data.voyageId}`);
    return true;
  } catch (err) {
    console.error("[email] sendCargoReportEmail failed:", err);
    return false;
  }
}
