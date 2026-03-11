import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

router.post("/parse-crew-text", isAuthenticated, async (req: any, res) => {
  try {
    const { rawText, portName } = req.body;
    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ error: "Text too short" });
    }

    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) return res.json({ method: "fallback", crew: [] });
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are a maritime crew data parser. Parse the following text and extract ALL crew members. The text may be in ANY format — structured email, table, list, PDF copy-paste, tab-separated, Turkish, or messy formatting.

For each crew member extract (use null if not found):
- signerType: "on_signer" or "off_signer" — see CRITICAL RULES below
- rank: position on vessel
- firstName: (Title Case)
- lastName: (Title Case)
- middleName: if any
- dob: date of birth (DD Mon YYYY)
- birthPlace
- nationality
- passportNo
- passportIssued: issue date
- passportExpiry: expiry date
- passportPlace: issue place
- seamansBookNo
- seamansBookIssued
- seamansBookExpiry
- seamansBookPlace
- employeeNo
- flights: array of { legNo, flightNo, date, fromAirport (3-letter IATA), toAirport (3-letter IATA), depTime (HH:MM), arrTime (HH:MM) }

CRITICAL RULES FOR SIGNER TYPE (read carefully):
- When you see a section header "Off-Signers Details", "Off-Signers", "Sign Off", "Departing", "Leaving" — ALL crew members listed AFTER that header (until the next section or end of text) are "off_signer"
- When you see a section header "On-Signers Details", "On-Signers", "Sign On", "Joining", "Embarking" — ALL crew members listed AFTER that header are "on_signer"
- "Planned Rank :" usually indicates on-signer; "Rank :" alone usually indicates off-signer
- If the text has BOTH sections, you MUST assign different signerType values — never assign all crew to the same type when two sections exist
- If only one section exists with no header, default to "on_signer"
- VERIFY: Count how many on_signer and off_signer you found — if the text has both sections but all are same type, you made an error

Additional Rules:
- Names often "LASTNAME, FIRSTNAME MIDDLENAME" — split correctly
- Flight routes "GDNMUC" = GDN→MUC, "ADBIST" = ADB→IST (first 3 = from, last 3 = to)
- Detect crew even with inconsistent formatting
- Current port: ${portName || "unknown"}

Respond ONLY with a raw JSON array. No markdown, no backticks, no explanation.

TEXT:
${rawText}`
      }]
    });

    const textContent = response.content.find((c: any) => c.type === "text");
    if (!textContent) return res.json({ method: "fallback", crew: [] });

    let jsonStr = (textContent as any).text.trim()
      .replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: any[];
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const s = jsonStr.indexOf("[");
      const e = jsonStr.lastIndexOf("]");
      if (s !== -1 && e !== -1) {
        parsed = JSON.parse(jsonStr.substring(s, e + 1));
      } else {
        return res.json({ method: "fallback", crew: [] });
      }
    }

    if (!Array.isArray(parsed)) return res.json({ method: "fallback", crew: [] });

    const enriched = parsed.map((m: any) => {
      const warnings: string[] = [];
      if (m.passportExpiry) {
        const exp = new Date(m.passportExpiry);
        if (!isNaN(exp.getTime())) {
          const ml = (exp.getTime() - Date.now()) / (30 * 24 * 3600000);
          if (ml < 0) warnings.push("⛔ Passport EXPIRED!");
          else if (ml < 6) warnings.push(`⚠️ Passport expires in ${Math.round(ml)} months`);
        }
      }
      if (m.seamansBookExpiry) {
        const exp = new Date(m.seamansBookExpiry);
        if (!isNaN(exp.getTime())) {
          const ml = (exp.getTime() - Date.now()) / (30 * 24 * 3600000);
          if (ml < 0) warnings.push("⛔ Seaman's Book EXPIRED!");
          else if (ml < 6) warnings.push(`⚠️ Seaman's Book expires in ${Math.round(ml)} months`);
        }
      }
      if (!m.flights?.length) warnings.push("✈️ No flight info");
      if (!m.passportNo) warnings.push("⚠️ Passport missing");
      if (m.nationality?.toLowerCase()?.includes("russian")) warnings.push("🛂 Russian — verify visa");
      const last = m.flights?.[m.flights.length - 1];
      return {
        ...m,
        signerType: m.signerType || "on_signer",
        firstName: m.firstName || "",
        lastName: m.lastName || "",
        fullName: `${m.lastName || ""}, ${m.firstName || ""} ${m.middleName || ""}`.trim(),
        firstFlightCode: m.flights?.[0]?.flightNo || "",
        lastFlightArrival: last?.arrTime || "",
        lastArrivalAirport: last?.toAirport || "",
        warnings,
      };
    });

    res.json({ method: "ai", crew: enriched });
  } catch (err: any) {
    console.error("[crew-parse] Error:", err.message);
    res.json({ method: "fallback", crew: [], error: err.message });
  }
});

export default router;
