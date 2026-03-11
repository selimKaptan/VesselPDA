import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.post("/parse-declaration", isAuthenticated, async (req: any, res) => {
  try {
    const { rawText, documentType, operationType } = req.body;
    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ error: "Text too short" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.json({ method: "fallback", parcels: [] });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 6000,
      messages: [{
        role: "user",
        content: `You are a maritime cargo declaration parser. Parse the following customs declaration document and extract ALL cargo parcels/line items.

For each cargo parcel extract (use null if not found):
- blNumber: Bill of Lading number (alphanumeric, e.g. "PKLIZR01", "PGIZR1", "PGMER3D")
- cargoType: name/description of the cargo (e.g. "Palm Oil", "Soybean Meal", "Wheat")
- cargoGrade: quality or grade if specified (e.g. "RBD", "GMO-Free")
- hsCode: HS/GTİP code (e.g. "1511.90", "1513.29")
- quantity: numeric quantity converted to MT (see Turkish format rules below)
- unit: always "MT"
- shipperName: exporter/shipper name
- receiverName: importer/consignee name (use "TO ORDER" if not specified)
- countryOfOrigin: country where cargo originated
- portOfLoading: port where cargo was loaded
- portOfDischarge: destination port
- packageCount: number of packages/containers if applicable
- packageType: type of package (e.g. "BULK", "BAG", "FCL")
- holdNumbers: hold assignment (null if unknown)
- tankNumbers: tank assignment for liquid cargo (null if unknown)

TURKISH ÖZET BEYAN FORMAT RULES (CRITICAL):
- This is a Turkish "Özet Beyan" (Customs Summary Declaration)
- Column headers may not exist — data is in fixed-position format
- B/L numbers are alphanumeric codes like "PKLIZR01", "PGIZR1", "PGMER3D"  
- HS codes (GTİP) like "1511.90", "1513.29" appear before the cargo description
- Quantities use Turkish number format: dots as thousands separator (e.g. "600.162,00" = 600,162 kg → divide by 1000 for MT)
- If quantities appear very large (>10,000), they're likely in KG — convert to MT by dividing by 1000
- "ADR" in the document typically means "Adres" (address) column
- "VL" means "Değer/Value" column
- Shipper/Exporter is typically at the top of the document
- Receivers (consignees) are listed per line item
- "TO ORDER" means the receiver is not yet specified — use "TO ORDER" as receiverName
- Port of loading and discharge are typically at the top
- The agent/declarer info is at the bottom (e.g. "SELİM DENİZCİLİK")
- Each row typically has: [Line#] [B/L No] [Package Count] [Package Type] [Country] [HS Code] [Cargo Description] [Quantity] [Shipper] [Receiver]

Operation type: ${operationType || "discharging"}

IMPORTANT: Return a JSON object with a "parcels" array. Each parcel should have all fields above. If a field is not found, use null.

Respond ONLY with a raw JSON object like:
{"parcels": [...], "documentSummary": {"shipper": "...", "pol": "...", "pod": "...", "totalQuantityMT": 0}}

No markdown, no backticks, no explanation.

DOCUMENT TEXT:
${rawText}`
      }]
    });

    const textContent = response.content.find((c: any) => c.type === "text");
    if (!textContent) return res.json({ method: "fallback", parcels: [] });

    let jsonStr = (textContent as any).text.trim()
      .replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const s = jsonStr.indexOf("{");
      const e = jsonStr.lastIndexOf("}");
      if (s !== -1 && e !== -1) {
        try {
          parsed = JSON.parse(jsonStr.substring(s, e + 1));
        } catch {
          return res.json({ method: "fallback", parcels: [] });
        }
      } else {
        return res.json({ method: "fallback", parcels: [] });
      }
    }

    const parcels = (Array.isArray(parsed) ? parsed : parsed?.parcels) || [];

    const normalized = parcels.map((p: any, i: number) => ({
      ...p,
      quantity: typeof p.quantity === "number" ? p.quantity : parseFloat(String(p.quantity || "0").replace(/\./g, "").replace(",", ".")) / (String(p.quantity || "").replace(/\./g, "").replace(",", ".").length > 5 ? 1000 : 1),
      unit: "MT",
      sequence: i + 1,
    }));

    res.json({ method: "ai", parcels: normalized, documentSummary: parsed?.documentSummary || null });
  } catch (err: any) {
    console.error("[cargo-parse] Error:", err.message);
    res.json({ method: "fallback", parcels: [], error: err.message });
  }
});

router.post("/extract-pdf-text", isAuthenticated, async (req: any, res) => {
  try {
    const { pdfBase64, fileName } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: "No file data" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(400).json({ error: "AI not configured" });

    const client = new Anthropic({ apiKey });

    const isPdf = fileName?.toLowerCase().endsWith(".pdf");
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || "");

    if (isPdf) {
      const response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            } as any,
            {
              type: "text",
              text: "Extract ALL text from this document. Preserve the structure, table layout, columns, and line breaks as much as possible. Output only the raw extracted text, no explanation.",
            }
          ]
        }]
      });
      const textContent = response.content.find((c: any) => c.type === "text");
      return res.json({ text: (textContent as any)?.text || "" });
    }

    if (isImage) {
      const ext = (fileName?.split(".").pop() || "jpeg").toLowerCase();
      const mediaTypeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mediaType = mediaTypeMap[ext] || "image/jpeg";

      const response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as any, data: pdfBase64 },
            },
            {
              type: "text",
              text: "Extract ALL text from this image. Preserve the structure, table layout, columns, and line breaks. Output only the raw extracted text, no explanation.",
            }
          ]
        }]
      });
      const textContent = response.content.find((c: any) => c.type === "text");
      return res.json({ text: (textContent as any)?.text || "" });
    }

    return res.status(400).json({ error: "Unsupported file type" });
  } catch (err: any) {
    console.error("[cargo-extract-pdf] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
