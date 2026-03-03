import { pool } from "./db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// ── Forwarding address generation ─────────────────────────────────────────────
export function generateForwardingEmail(orgSlug: string): string {
  const slug = (orgSlug || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 20)
    .replace(/^-|-$/g, "");
  const code = Math.random().toString(36).substring(2, 7);
  return `${slug}-${code}@inbound.vesselpda.app`;
}

// ── AI email classification & extraction ─────────────────────────────────────
export async function classifyEmailWithAI(subject: string, bodyText: string): Promise<{
  classification: string;
  extractedData: any;
  suggestion: string;
}> {
  try {
    const prompt = `You are a maritime operations assistant. Analyze this email and extract key information.

Subject: ${subject || "(no subject)"}
Body: ${(bodyText || "").substring(0, 2000)}

Respond in JSON with this exact structure:
{
  "classification": "<one of: nomination, sof_update, da_proforma, fixture_recap, crew_change, bunker_inquiry, port_clearance, general>",
  "confidence": "<high|medium|low>",
  "extractedData": {
    "vesselName": "<if mentioned>",
    "imoNumber": "<if mentioned>",
    "portName": "<if mentioned>",
    "eta": "<if mentioned, ISO date>",
    "etd": "<if mentioned, ISO date>",
    "cargoType": "<if mentioned>",
    "cargoQuantity": "<if mentioned>",
    "charterer": "<if mentioned>",
    "shipowner": "<if mentioned>",
    "agentName": "<if mentioned>",
    "voyageNumber": "<if mentioned>",
    "events": [{"eventName": "...", "eventTime": "..."}]
  },
  "suggestion": "<1-2 sentence action suggestion in English, e.g. 'This appears to be a vessel nomination for MV Example arriving at Port X. Would you like to create a voyage?'>"
}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        classification: parsed.classification || "general",
        extractedData: parsed.extractedData || {},
        suggestion: parsed.suggestion || "",
      };
    }
  } catch (err) {
    console.error("[email-inbound] AI classification error:", err);
  }
  return { classification: "general", extractedData: {}, suggestion: "" };
}

// ── Lookup user by forwarding email ──────────────────────────────────────────
export async function resolveForwardingEmail(toEmail: string): Promise<{
  userId: string | null;
  organizationId: number | null;
  linkedVoyageId: number | null;
  ruleType: string;
} | null> {
  const res = await pool.query(
    `SELECT user_id, organization_id, linked_voyage_id, rule_type
     FROM email_forwarding_rules
     WHERE forwarding_email = $1 AND is_active = TRUE LIMIT 1`,
    [toEmail]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    userId: row.user_id,
    organizationId: row.organization_id,
    linkedVoyageId: row.linked_voyage_id,
    ruleType: row.rule_type,
  };
}

// ── Save inbound email to DB ──────────────────────────────────────────────────
export async function saveInboundEmail(data: {
  userId: string | null;
  organizationId: number | null;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: any[];
  linkedVoyageId?: number | null;
  aiClassification?: string;
  aiExtractedData?: any;
  aiSuggestion?: string;
}): Promise<number> {
  const res = await pool.query(
    `INSERT INTO inbound_emails
      (user_id, organization_id, from_email, from_name, to_email, subject, body_text, body_html,
       attachments, linked_voyage_id, ai_classification, ai_extracted_data, ai_suggestion)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      data.userId,
      data.organizationId,
      data.fromEmail,
      data.fromName || null,
      data.toEmail,
      data.subject || null,
      data.bodyText || null,
      data.bodyHtml || null,
      JSON.stringify(data.attachments || []),
      data.linkedVoyageId || null,
      data.aiClassification || "general",
      JSON.stringify(data.aiExtractedData || {}),
      data.aiSuggestion || null,
    ]
  );
  return res.rows[0].id;
}

// ── Mark email processed ──────────────────────────────────────────────────────
export async function markEmailProcessed(
  emailId: number,
  action: string,
  entityId?: number
): Promise<void> {
  await pool.query(
    `UPDATE inbound_emails
     SET is_processed = TRUE, processed_action = $1, processed_entity_id = $2
     WHERE id = $3`,
    [action, entityId || null, emailId]
  );
}
