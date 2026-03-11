import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.post("/parse-crew-text", isAuthenticated, async (req: any, res) => {
  try {
    const { rawText, portName } = req.body;
    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ error: "Text too short" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.json({ method: "fallback", crew: [] });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are a maritime crew data parser. Parse the following text and extract ALL crew members. The text may be in ANY format — structured email, table, list, PDF copy-paste, tab-separated, Turkish, or messy formatting.

For each crew member extract (use null if not found):
- signerType: "on_signer" or "off_signer" (detect from "On-Signers"/"Joining"/"Sign On" = on_signer; "Off-Signers"/"Leaving"/"Sign Off" = off_signer)
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

Rules:
- Names often "LASTNAME, FIRSTNAME MIDDLENAME" — split correctly
- Flight routes "GDNMUC" = GDN→MUC, "ADBIST" = ADB→IST (first 3 = from, last 3 = to)
- "Planned Rank" and "Rank" both mean rank
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
