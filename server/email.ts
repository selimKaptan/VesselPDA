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
} from "./email-templates";

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
