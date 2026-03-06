import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { handleAiChat } from "../anthropic";
import { calculateLimiter } from "./shared";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { aiAnalysisHistory } from "../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const parseRateLimiter = new Map<string, number[]>();

function checkParseRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 5;
  const timestamps = (parseRateLimiter.get(userId) || []).filter(
    (t) => now - t < windowMs
  );
  if (timestamps.length >= maxRequests) return false;
  timestamps.push(now);
  parseRateLimiter.set(userId, timestamps);
  return true;
}

const PARSE_SYSTEM_PROMPT = `You are an expert maritime and ship agency operations assistant. Analyze the following email, document or note and extract structured information. Return ONLY a valid JSON object with this exact structure, nothing else:
{
  "detected_event": "crew_change",
  "confidence": 0.85,
  "vessel_name": "string or null",
  "imo_number": "string or null",
  "port_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "summary": "brief one-line summary",
  "details": {},
  "action_required": "what needs to be done",
  "suggested_action": "create_voyage",
  "raw_entities": { "emails": [], "phone_numbers": [], "dates": [], "amounts": [] }
}
The detected_event must be exactly one of: crew_change, spare_part, eta_update, nomination, cargo_info, port_call, invoice, nor_tendered, sof_update, laytime_notice, general_note.
The suggested_action must be exactly one of: create_voyage, update_eta, create_proforma, add_crew, create_service_request, create_note, none.
If any field is not found, use null. Return only the JSON object, no markdown, no explanation.`;

router.post("/chat", isAuthenticated, calculateLimiter, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array required" });
    }
    const validMessages = messages.filter(
      (m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );
    if (validMessages.length === 0) {
      return res.status(400).json({ message: "No valid messages" });
    }
    const result = await handleAiChat(userId, validMessages);
    res.json(result);
  } catch (err: any) {
    console.error("AI chat error:", err);
    res.status(500).json({ message: "Failed to connect to AI service" });
  }
});

router.post("/parse-document", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;

    if (!checkParseRateLimit(userId)) {
      return res.status(429).json({ message: "Rate limit exceeded. Maximum 5 analyses per minute." });
    }

    const { content, fileType, fileName } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ message: "content is required" });
    }

    const truncatedContent = content.slice(0, 8000);

    let analysis: any;
    let tokensUsed = 0;

    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: PARSE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: truncatedContent }],
      });

      tokensUsed =
        (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

      let rawText =
        response.content[0]?.type === "text" ? response.content[0].text : "";

      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) rawText = jsonMatch[1];

      rawText = rawText.trim();
      if (!rawText.startsWith("{")) {
        const startIdx = rawText.indexOf("{");
        if (startIdx !== -1) rawText = rawText.slice(startIdx);
      }

      analysis = JSON.parse(rawText);
    } catch {
      analysis = {
        detected_event: "general_note",
        confidence: 0.3,
        vessel_name: null,
        imo_number: null,
        port_name: null,
        date: null,
        summary: "Document analyzed but structured data could not be extracted.",
        details: {},
        action_required: "Please review document manually.",
        suggested_action: "create_note",
        raw_entities: { emails: [], phone_numbers: [], dates: [], amounts: [] },
      };
    }

    const [historyEntry] = await db
      .insert(aiAnalysisHistory)
      .values({
        userId,
        fileName: fileName || "unknown",
        fileType: fileType || "text/plain",
        detectedEvent: analysis.detected_event || "general_note",
        confidence: analysis.confidence || 0,
        summary: analysis.summary || "",
        fullAnalysis: analysis,
      })
      .returning();

    res.json({ success: true, analysis, historyId: historyEntry.id, tokensUsed });
  } catch (err: any) {
    console.error("AI parse-document error:", err);
    res.status(500).json({ message: "Failed to analyze document" });
  }
});

router.post("/execute-action", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { type, vesselName, details, historyId } = req.body;

    if (!type) {
      return res.status(400).json({ message: "type is required" });
    }

    let message = "";
    let redirect: string | undefined;

    if (type === "update_eta") {
      const vessel = vesselName || details?.vessel_name;
      if (vessel && details?.date) {
        try {
          await db.execute(
            sql`UPDATE voyages SET eta = ${details.date} WHERE vessel_name ILIKE ${vessel} AND user_id = ${userId} AND status = 'active' LIMIT 1`
          );
          message = `ETA updated for vessel ${vessel}`;
        } catch {
          message = "ETA update attempted";
        }
      } else {
        message = "ETA update: no vessel or date specified";
      }
    } else if (type === "add_crew") {
      const summary = `Crew change: ${JSON.stringify(details?.details || details)}`;
      await db.execute(
        sql`INSERT INTO notifications (user_id, type, title, message, read) VALUES (${userId}, 'crew_change', 'Crew Change Recorded', ${summary}, false)`
      );
      message = "Crew change recorded";
    } else if (type === "create_note") {
      const noteSummary = details?.summary || details?.action_required || "AI-generated note";
      await db.execute(
        sql`INSERT INTO notifications (user_id, type, title, message, read) VALUES (${userId}, 'note', 'Note Saved', ${noteSummary}, false)`
      );
      message = "Note saved successfully";
    } else if (type === "create_voyage") {
      const params = new URLSearchParams();
      if (vesselName) params.set("vessel", vesselName);
      if (details?.port_name) params.set("port", details.port_name);
      if (details?.date) params.set("eta", details.date);
      redirect = `/voyages?${params.toString()}`;
      message = "Redirecting to voyage creation";
    } else if (type === "create_proforma") {
      const params = new URLSearchParams();
      if (vesselName) params.set("vessel", vesselName);
      if (details?.port_name) params.set("port", details.port_name);
      redirect = `/proformas/new?${params.toString()}`;
      message = "Redirecting to proforma creation";
    } else if (type === "create_service_request") {
      const params = new URLSearchParams();
      params.set("new", "true");
      if (vesselName) params.set("vessel", vesselName);
      redirect = `/service-requests?${params.toString()}`;
      message = "Redirecting to service request";
    } else {
      message = "Action acknowledged";
    }

    if (historyId) {
      await db
        .update(aiAnalysisHistory)
        .set({ actionTaken: type })
        .where(eq(aiAnalysisHistory.id, historyId));
    }

    res.json({ success: true, message, redirect });
  } catch (err: any) {
    console.error("AI execute-action error:", err);
    res.status(500).json({ message: "Failed to execute action" });
  }
});

router.get("/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const history = await db
      .select()
      .from(aiAnalysisHistory)
      .where(eq(aiAnalysisHistory.userId, userId))
      .orderBy(desc(aiAnalysisHistory.createdAt))
      .limit(limit);

    res.json({ history });
  } catch (err: any) {
    console.error("AI history error:", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

// ── POST /api/ai/extract-crew-image ────────────────────────────────────────
// Accepts a base64-encoded image, uses Claude Vision to extract a crew list
// Returns: { text: string } — raw extracted table text ready for parseAndApplyAIText
router.post("/extract-crew-image", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!checkParseRateLimit(userId)) {
      return res.status(429).json({ message: "Rate limit exceeded. Try again in a minute." });
    }

    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "imageData and mimeType are required" });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: imageData },
            },
            {
              type: "text",
              text: `This is a maritime crew change list (email screenshot or table). 
Extract the crew data and format it as plain text with the following structure EXACTLY:

SIGN ON
CREW NAME  RANK  NATIONALITY  DOB  POB  PASSPORT  ISSUE DATE  EXPIRY DATE  SEAMAN BOOK
[row1 values separated by two spaces]
[row2 values...]

SIGN OFF
CREW NAME  RANK  NATIONALITY  DOB  POB  PASSPORT  ISSUE DATE  EXPIRY DATE  SEAMAN BOOK
[row1 values separated by two spaces]
[row2 values...]

Rules:
- Use exactly two spaces between column values
- If a section (SIGN ON or SIGN OFF) has no crew, omit that section
- Use N/A for missing values
- Keep names in UPPER CASE as they appear
- Output ONLY the formatted table, no explanation`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    res.json({ text });
  } catch (err: any) {
    console.error("[extract-crew-image]", err.message);
    res.status(500).json({ message: "AI image extraction failed" });
  }
});

export default router;
