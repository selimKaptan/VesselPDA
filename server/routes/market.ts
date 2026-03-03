import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

// ─── FIXTURES ───────────────────────────────────────────────────────────────

router.get("/fixtures", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    const result = isAdmin ? await storage.getAllFixtures() : await storage.getFixtures(userId);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch fixtures" });
  }
});

router.post("/fixtures", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const fixture = await storage.createFixture({ ...req.body, userId });
    res.status(201).json(fixture);
  } catch {
    res.status(500).json({ message: "Failed to create fixture" });
  }
});

router.get("/fixtures/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const fixture = await storage.getFixture(id);
    if (!fixture) return res.status(404).json({ message: "Fixture not found" });
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
    res.json(fixture);
  } catch {
    res.status(500).json({ message: "Failed to fetch fixture" });
  }
});

router.patch("/fixtures/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const fixture = await storage.getFixture(id);
    if (!fixture) return res.status(404).json({ message: "Fixture not found" });
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateFixture(id, req.body);
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update fixture" });
  }
});

router.delete("/fixtures/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const fixture = await storage.getFixture(id);
    if (!fixture) return res.status(404).json({ message: "Fixture not found" });
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteFixture(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete fixture" });
  }
});

// ─── LAYTIME CALCULATIONS ────────────────────────────────────────────────────

router.get("/fixtures/:id/laytime", isAuthenticated, async (req: any, res) => {
  try {
    const fixtureId = parseInt(req.params.id);
    const { rows } = await pool.query(
      "SELECT * FROM laytime_calculations WHERE fixture_id = $1 ORDER BY created_at ASC",
      [fixtureId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch laytime calculations" });
  }
});

router.post("/fixtures/:id/laytime", isAuthenticated, async (req: any, res) => {
  try {
    const fixtureId = parseInt(req.params.id);
    const { calculateLaytime } = await import("./laytime-calculator");
    const {
      portCallType = "loading",
      portName,
      allowedLaytimeHours = 0,
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate = 0,
      despatchRate = 0,
      currency = "USD",
      deductions = [],
      notes,
    } = req.body;

    const calc = calculateLaytime({
      allowedLaytimeHours: Number(allowedLaytimeHours),
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate: Number(demurrageRate),
      despatchRate: Number(despatchRate),
      deductions,
    });

    const { rows } = await pool.query(
      `INSERT INTO laytime_calculations
        (fixture_id, port_call_type, port_name, allowed_laytime_hours,
         nor_started_at, berthing_at, loading_started_at, loading_completed_at, departed_at,
         time_used_hours, demurrage_rate, despatch_rate, demurrage_amount, despatch_amount,
         currency, deductions, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        fixtureId, portCallType, portName || null, allowedLaytimeHours,
        norStartedAt || null, berthingAt || null, loadingStartedAt || null,
        loadingCompletedAt || null, departedAt || null,
        calc.timeUsedHours, demurrageRate, despatchRate,
        calc.demurrageAmount, calc.despatchAmount,
        currency, JSON.stringify(deductions), notes || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to create laytime calculation", error: e.message });
  }
});

router.put("/laytime/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { calculateLaytime } = await import("./laytime-calculator");
    const {
      portCallType,
      portName,
      allowedLaytimeHours,
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate,
      despatchRate,
      currency,
      deductions,
      notes,
    } = req.body;

    const calc = calculateLaytime({
      allowedLaytimeHours: Number(allowedLaytimeHours || 0),
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate: Number(demurrageRate || 0),
      despatchRate: Number(despatchRate || 0),
      deductions: deductions || [],
    });

    const { rows } = await pool.query(
      `UPDATE laytime_calculations SET
        port_call_type = $2, port_name = $3, allowed_laytime_hours = $4,
        nor_started_at = $5, berthing_at = $6, loading_started_at = $7,
        loading_completed_at = $8, departed_at = $9,
        time_used_hours = $10, demurrage_rate = $11, despatch_rate = $12,
        demurrage_amount = $13, despatch_amount = $14,
        currency = $15, deductions = $16, notes = $17
       WHERE id = $1 RETURNING *`,
      [
        id, portCallType, portName || null, allowedLaytimeHours || 0,
        norStartedAt || null, berthingAt || null, loadingStartedAt || null,
        loadingCompletedAt || null, departedAt || null,
        calc.timeUsedHours, demurrageRate || 0, despatchRate || 0,
        calc.demurrageAmount, calc.despatchAmount,
        currency || "USD", JSON.stringify(deductions || []), notes || null,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to update laytime calculation", error: e.message });
  }
});

router.delete("/laytime/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query("DELETE FROM laytime_calculations WHERE id = $1", [id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete laytime calculation" });
  }
});

// ─── CARGO POSITIONS ────────────────────────────────────────────────────────
// ─── CARGO POSITIONS ────────────────────────────────────────────────────────

router.get("/cargo-positions", isAuthenticated, async (req: any, res) => {
  try {
    const positions = await storage.getCargoPositions();
    res.json(positions);
  } catch {
    res.status(500).json({ message: "Failed to fetch cargo positions" });
  }
});

router.get("/cargo-positions/mine", isAuthenticated, async (req: any, res) => {
  try {
    const positions = await storage.getMyCargoPositions(req.user.claims.sub);
    res.json(positions);
  } catch {
    res.status(500).json({ message: "Failed to fetch my cargo positions" });
  }
});

router.post("/cargo-positions", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const pos = await storage.createCargoPosition({ ...req.body, userId });
    res.status(201).json(pos);

    if (pos.positionType === "cargo") {
      const allVessels = await storage.getAllVessels();
      const notifiedOwners = new Set<string>();
      for (const vessel of allVessels) {
        if (!vessel.userId || notifiedOwners.has(vessel.userId) || vessel.userId === userId) continue;
        notifiedOwners.add(vessel.userId);
        await storage.createNotification({
          userId: vessel.userId,
          type: "cargo_match",
          title: "Yeni Kargo İlanı",
          message: `${pos.cargoType || "Kargo"} ilanı: ${pos.loadingPort} → ${pos.dischargePort}`,
          link: "/cargo-positions",
        });
      }
    }
  } catch {
    res.status(500).json({ message: "Failed to create cargo position" });
  }
});

router.patch("/cargo-positions/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateCargoPosition(id, req.body);
    if (!updated) return res.status(404).json({ message: "Position not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update cargo position" });
  }
});

router.delete("/cargo-positions/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteCargoPosition(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete cargo position" });
  }
});

// ─── FREIGHT INDICES (Trading Economics or Fallback, 4h cache) ──────────────

let freightIndexCache: { data: any; fetchedAt: number } | null = null;
const FREIGHT_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

const FREIGHT_META: Record<string, { name: string; description: string }> = {
  BDI:  { name: "Baltic Dry Index",          description: "Kuru Dökme Yük" },
  BCTI: { name: "Baltic Clean Tanker Index", description: "Temiz Tanker" },
  BDTI: { name: "Baltic Dirty Tanker Index", description: "Kirli Tanker" },
};

const FREIGHT_FALLBACK = [
  { code: "BDI",  ...FREIGHT_META.BDI,  value: 1245, change: 0, changePct: 0, previousClose: 1245 },
  { code: "BCTI", ...FREIGHT_META.BCTI, value: 731,  change: 0, changePct: 0, previousClose: 731  },
  { code: "BDTI", ...FREIGHT_META.BDTI, value: 1089, change: 0, changePct: 0, previousClose: 1089 },
];

// ── Attempt 1: Trading Economics API (requires TRADING_ECONOMICS_API_KEY) ──
async function fetchFromTradingEconomics(): Promise<any[] | null> {
  const teKey = process.env.TRADING_ECONOMICS_API_KEY;
  if (!teKey) return null;
  try {
    const symbols = "BDI:IND,BCTI:IND,BDTI:IND";
    const url = `https://api.tradingeconomics.com/markets/symbol/${encodeURIComponent(symbols)}?c=${encodeURIComponent(teKey)}`;
    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      console.warn("[freight] Trading Economics response not OK:", resp.status);
      return null;
    }
    const json = await resp.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    const mapped = json.map((item: any) => {
      const ticker = (item.Ticker || "").toUpperCase();
      const code = ticker.replace(/:IND$/, "");
      const meta = FREIGHT_META[code];
      if (!meta) return null;
      const last = Number(item.Last ?? item.Close ?? 0);
      const prev = Number(item.Close ?? last);
      const chg  = Number(item.DailyChange ?? 0);
      const chgPct = Number(item.DailyPercentualChange ?? 0);
      return {
        code,
        name: meta.name,
        description: meta.description,
        value: Math.round(last),
        change: Math.round(chg * 100) / 100,
        changePct: Math.round(chgPct * 100) / 100,
        previousClose: Math.round(prev - chg),
      };
    }).filter(Boolean);

    if (mapped.length === 0) return null;
    // Ensure all three indices are present; fill gaps from fallback
    return ["BDI", "BCTI", "BDTI"].map(
      code => mapped.find((m: any) => m.code === code) || FREIGHT_FALLBACK.find(f => f.code === code)!
    );
  } catch (err) {
    console.warn("[freight] Trading Economics fetch failed:", err);
    return null;
  }
}

// ── Attempt 2: Yahoo Finance crumb-based (in-memory, no file writes) ────────
async function fetchFromYahooFinance(): Promise<any[] | null> {
  try {
    // Step 1: get crumb + cookie in memory
    const cookieResp = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    const rawCookies: string[] = [];
    const setCookie = cookieResp.headers.get("set-cookie");
    if (setCookie) rawCookies.push(...setCookie.split(/,(?=[^ ])/));

    const cookieHeader = rawCookies
      .map(c => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    // Step 2: get crumb
    const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Cookie": cookieHeader,
      },
      signal: AbortSignal.timeout(6000),
    });
    const crumb = await crumbResp.text();
    if (!crumb || crumb.includes("<") || crumb.length > 50) return null;

    // Step 3: try known BDI-related tickers
    const tickerMap: Record<string, string> = {
      BDI: "BDI",
      BCTI: "BCTI",
      BDTI: "BDTI",
    };
    const results = await Promise.all(
      Object.entries(tickerMap).map(async ([code, ticker]) => {
        try {
          const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d&crumb=${encodeURIComponent(crumb)}`;
          const r = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
              "Cookie": cookieHeader,
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) return null;
          const j = await r.json();
          const meta = j?.chart?.result?.[0]?.meta;
          if (!meta?.regularMarketPrice || meta.regularMarketPrice < 10) return null;
          const meta2 = FREIGHT_META[code]!;
          const price = meta.regularMarketPrice;
          const prev  = meta.previousClose || price;
          return {
            code,
            name: meta2.name,
            description: meta2.description,
            value: Math.round(price),
            change: Math.round((price - prev) * 100) / 100,
            changePct: Math.round(((price - prev) / prev) * 10000) / 100,
            previousClose: Math.round(prev),
          };
        } catch { return null; }
      })
    );
    const valid = results.filter(Boolean);
    if (valid.length === 0) return null;
    return ["BDI", "BCTI", "BDTI"].map(
      code => valid.find((v: any) => v?.code === code) || FREIGHT_FALLBACK.find(f => f.code === code)!
    );
  } catch (err) {
    console.warn("[freight] Yahoo Finance fetch failed:", err);
    return null;
  }
}

async function fetchFreightIndices(): Promise<{ indices: any[]; source: string } | null> {
  // Try Trading Economics first (most reliable if API key is set)
  const teData = await fetchFromTradingEconomics();
  if (teData) return { indices: teData, source: "Trading Economics" };

  // Try Yahoo Finance with crumb auth
  const yfData = await fetchFromYahooFinance();
  if (yfData) return { indices: yfData, source: "Yahoo Finance" };

  return null;
}

router.get("/market/freight-indices", isAuthenticated, async (_req, res) => {
  try {
    const now = Date.now();
    const cacheValid = freightIndexCache && (now - freightIndexCache.fetchedAt) < FREIGHT_CACHE_TTL;

    if (cacheValid) {
      return res.json({ ...freightIndexCache!.data, cached: true });
    }

    const fresh = await fetchFreightIndices();
    const hasApiKey = !!process.env.TRADING_ECONOMICS_API_KEY;
    const data = {
      indices: fresh?.indices ?? FREIGHT_FALLBACK,
      lastUpdated: new Date().toISOString(),
      source: fresh?.source ?? "Fallback",
      cached: false,
      hasApiKey,
    };

    if (fresh) freightIndexCache = { data, fetchedAt: now };

    res.json(data);
  } catch {
    res.json({ indices: FREIGHT_FALLBACK, lastUpdated: new Date().toISOString(), source: "Fallback", cached: false, hasApiKey: false });
  }
});

// ─── BUNKER PRICES ───────────────────────────────────────────────────────────

router.get("/market/bunker-prices", isAuthenticated, async (_req, res) => {
  try {
    const prices = await storage.getBunkerPrices();
    res.json(prices);
  } catch {
    res.status(500).json({ message: "Failed to fetch bunker prices" });
  }
});

router.post("/admin/bunker-prices", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const price = await storage.upsertBunkerPrice({ ...req.body, updatedBy: userId });
    res.status(201).json(price);
  } catch {
    res.status(500).json({ message: "Failed to save bunker price" });
  }
});

router.patch("/admin/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const price = await storage.upsertBunkerPrice({ ...req.body, updatedBy: userId });
    res.json(price);
  } catch {
    res.status(500).json({ message: "Failed to update bunker price" });
  }
});

router.delete("/admin/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.deleteBunkerPrice(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete bunker price" });
  }
});
// ─── DOCUMENT TEMPLATES ─────────────────────────────────────────────────────

router.get("/document-templates", isAuthenticated, async (_req, res) => {
  try {
    const templates = await storage.getDocumentTemplates();
    res.json(templates);
  } catch {
    res.status(500).json({ message: "Failed to get templates" });
  }
});

router.post("/voyages/:id/documents/from-template", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const { templateId } = req.body;
    if (!templateId) return res.status(400).json({ message: "templateId required" });

    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });

    const templates = await storage.getDocumentTemplates();
    const template = templates.find((t: any) => t.id === templateId);
    if (!template) return res.status(404).json({ message: "Template not found" });

    const port = voyage.port || { name: "N/A" };
    const portName = typeof port === "object" ? (port.name || "N/A") : String(port);
    const formatDate = (d?: string | Date | null) => d ? new Date(d).toLocaleDateString("tr-TR") : "N/A";

    let content = template.content
      .replace(/\{\{vesselName\}\}/g, voyage.vesselName || "N/A")
      .replace(/\{\{imoNumber\}\}/g, voyage.imoNumber || "N/A")
      .replace(/\{\{port\}\}/g, portName)
      .replace(/\{\{grt\}\}/g, voyage.grt ? String(voyage.grt) : "N/A")
      .replace(/\{\{eta\}\}/g, formatDate(voyage.eta))
      .replace(/\{\{etd\}\}/g, formatDate(voyage.etd))
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("tr-TR"))
      .replace(/\{\{purposeOfCall\}\}/g, voyage.purposeOfCall || "N/A");

    const fileBase64 = Buffer.from(content).toString("base64");
    const doc = await storage.createVoyageDocument({
      voyageId,
      name: `${template.name} - ${voyage.vesselName || "Gemi"}`,
      docType: template.category.toLowerCase(),
      fileBase64: `data:text/html;base64,${fileBase64}`,
      notes: "Şablondan otomatik oluşturuldu",
      uploadedByUserId: userId,
      version: 1,
      templateId: template.id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error("from-template error:", err);
    res.status(500).json({ message: "Failed to create document from template" });
  }
});

router.post("/voyages/:id/documents/:docId/sign", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    const { signatureText } = req.body;
    if (!signatureText) return res.status(400).json({ message: "signatureText required" });

    const voyage = await storage.getVoyageById(voyageId);
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });
    if (voyage.userId !== userId && voyage.agentUserId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await storage.signVoyageDocument(docId, signatureText, new Date());
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to sign document" });
  }
});

router.post("/voyages/:id/documents/:docId/new-version", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    const { name, fileBase64, notes } = req.body;
    if (!fileBase64) return res.status(400).json({ message: "fileBase64 required" });

    const docs = await storage.getVoyageDocuments(voyageId);
    const parentDoc = docs.find((d: any) => d.id === docId);
    if (!parentDoc) return res.status(404).json({ message: "Document not found" });

    const newDoc = await storage.createNewDocumentVersion(parentDoc, { name: name || parentDoc.name, fileBase64, notes, uploadedByUserId: userId });
    res.status(201).json(newDoc);
  } catch {
    res.status(500).json({ message: "Failed to create new version" });
  }
});


export default router;
