import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "../replit_integrations/auth";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp, rmdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const router = Router();

async function convertPdfToImage(pdfBase64: string): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), "pdfimg-"));
  const pdfPath = join(tmpDir, "input.pdf");
  const outPrefix = join(tmpDir, "page");

  try {
    await writeFile(pdfPath, Buffer.from(pdfBase64, "base64"));

    await new Promise<void>((resolve, reject) => {
      execFile("pdftoppm", ["-png", "-r", "300", "-singlefile", pdfPath, outPrefix], { timeout: 30000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const pngPath = outPrefix + ".png";
    const pngBuffer = await readFile(pngPath);
    return pngBuffer.toString("base64");
  } finally {
    await unlink(join(tmpDir, "input.pdf")).catch(() => {});
    await unlink(outPrefix + ".png").catch(() => {});
    await rmdir(tmpDir).catch(() => {});
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_API_KEY ? {} : { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }),
});

const PARSE_SYSTEM_PROMPT = `You are a maritime cargo declaration parser. Extract ALL cargo parcels/line items from the document.

For each cargo parcel extract (use null if not found):
- blNumber: Bill of Lading number (e.g. "PKLIZR01", "PGIZR1", "PGMER3D")
- cargoType: name/description of the cargo (e.g. "Palm Oil", "RBD Palm Stearin", "Wheat")
- cargoGrade: quality or grade if specified (e.g. "RBD", "GMO-Free")
- hsCode: HS/GTİP code (e.g. "1511.90", "1513.29")
- quantity: numeric quantity converted to MT
- unit: always "MT"
- shipperName: exporter/shipper name
- receiverName: importer/consignee name (use "TO ORDER" if not specified)
- countryOfOrigin: country where cargo originated
- portOfLoading: port where cargo was loaded
- portOfDischarge: destination port
- packageCount: number of packages
- packageType: type (e.g. "BULK", "BAG", "FCL")
- holdNumbers: null if unknown
- tankNumbers: null if unknown

TURKISH ÖZET BEYAN FORMAT RULES:
- B/L numbers are alphanumeric codes like "PKLIZR01", "PGIZR1"
- HS codes like "1511.90" appear before cargo description
- Turkish number format: "600.162,00" = 600,162 (dot=thousands, comma=decimal) → KG → divide by 1000 for MT
- If quantities >10,000, they're in KG — divide by 1000 for MT
- Shipper/Exporter is at top; receivers per line item
- Each row: [Line#] [B/L No] [Pkg Count] [Pkg Type] [Country] [HS Code] [Cargo] [Qty] [Shipper] [Receiver]

Respond ONLY with raw JSON (no markdown, no backticks):
{"parcels": [...], "documentSummary": {"shipper": "...", "pol": "...", "pod": "...", "totalQuantityMT": 0}}`;

router.post("/parse-declaration", isAuthenticated, async (req: any, res) => {
  try {
    const { rawText, pdfBase64, fileName, documentType, operationType } = req.body;

    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
      console.error("[cargo-parse] AI_INTEGRATIONS_ANTHROPIC_API_KEY not set");
      return res.json({ method: "fallback", parcels: [] });
    }

    let messageContent: any[];

    if (pdfBase64) {
      const isPdf = (fileName || "").toLowerCase().endsWith(".pdf");
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || "");

      if (isPdf) {
        try {
          console.log(`[cargo-parse] Converting PDF to PNG via pdftoppm...`);
          const pngBase64 = await convertPdfToImage(pdfBase64);
          console.log(`[cargo-parse] PDF→PNG conversion OK (${Math.round(pngBase64.length * 3 / 4 / 1024)} KB)`);
          messageContent = [
            { type: "image", source: { type: "base64", media_type: "image/png", data: pngBase64 } },
            { type: "text", text: `${PARSE_SYSTEM_PROMPT}\n\nOperation type: ${operationType || "discharging"}` },
          ];
        } catch (convErr: any) {
          console.warn(`[cargo-parse] pdftoppm failed (${convErr.message}), falling back to document type`);
          messageContent = [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: `${PARSE_SYSTEM_PROMPT}\n\nOperation type: ${operationType || "discharging"}` },
          ];
        }
      } else if (isImage) {
        const ext = (fileName?.split(".").pop() || "jpeg").toLowerCase();
        const mediaTypeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
        messageContent = [
          { type: "image", source: { type: "base64", media_type: mediaTypeMap[ext] || "image/jpeg", data: pdfBase64 } },
          { type: "text", text: `${PARSE_SYSTEM_PROMPT}\n\nOperation type: ${operationType || "discharging"}` },
        ];
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }
    } else if (rawText && rawText.trim().length >= 20) {
      messageContent = [{ type: "text", text: `${PARSE_SYSTEM_PROMPT}\n\nOperation type: ${operationType || "discharging"}\n\nDOCUMENT TEXT:\n${rawText}` }];
    } else {
      return res.status(400).json({ error: "No document content provided" });
    }

    console.log(`[cargo-parse] Calling Anthropic for ${pdfBase64 ? fileName : "text"}, opType=${operationType}`);
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 6000,
      messages: [{ role: "user", content: messageContent }],
    });

    const textContent = response.content.find((c: any) => c.type === "text");
    const rawAiText = (textContent as any)?.text || "";
    console.log(`[cargo-parse] Claude response (${rawAiText.length} chars): ${rawAiText.substring(0, 300)}...`);
    if (!textContent) return res.json({ method: "fallback", parcels: [] });

    let jsonStr = rawAiText.trim()
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

    const normalized = parcels.map((p: any, i: number) => {
      let qty: number;
      if (typeof p.quantity === "number") {
        qty = p.quantity > 100000 ? p.quantity / 1000 : p.quantity;
      } else {
        const raw = String(p.quantity || "0");
        const cleaned = raw.replace(/\./g, "").replace(",", ".");
        const num = parseFloat(cleaned) || 0;
        qty = num > 100000 ? num / 1000 : num;
      }
      return { ...p, quantity: Math.round(qty * 1000) / 1000, unit: "MT", sequence: i + 1 };
    });

    console.log(`[cargo-parse] Parsed ${normalized.length} parcels`);
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

    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) return res.status(400).json({ error: "AI not configured" });

    const isPdf = fileName?.toLowerCase().endsWith(".pdf");
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || "");

    if (isPdf) {
      let contentPart: any;
      try {
        console.log(`[cargo-extract-pdf] Converting PDF to PNG via pdftoppm...`);
        const pngBase64 = await convertPdfToImage(pdfBase64);
        console.log(`[cargo-extract-pdf] PDF→PNG conversion OK (${Math.round(pngBase64.length * 3 / 4 / 1024)} KB)`);
        contentPart = { type: "image", source: { type: "base64", media_type: "image/png", data: pngBase64 } };
      } catch (convErr: any) {
        console.warn(`[cargo-extract-pdf] pdftoppm failed (${convErr.message}), falling back to document type`);
        contentPart = { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } };
      }

      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: [
            contentPart,
            {
              type: "text",
              text: "Extract ALL text from this document. Preserve the structure, table layout, columns, and line breaks as much as possible. Output only the raw extracted text, no explanation.",
            }
          ]
        }]
      });
      const textContent = response.content.find((c: any) => c.type === "text");
      const extractedText = (textContent as any)?.text || "";
      console.log(`[cargo-extract-pdf] Claude response (${extractedText.length} chars): ${extractedText.substring(0, 300)}...`);
      return res.json({ text: extractedText });
    }

    if (isImage) {
      const ext = (fileName?.split(".").pop() || "jpeg").toLowerCase();
      const mediaTypeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mediaType = mediaTypeMap[ext] || "image/jpeg";

      const response = await anthropic.messages.create({
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
