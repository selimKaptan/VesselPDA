import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { storage } from "../storage";
import { db } from "../db";
import { sql as drizzleSql, desc } from "drizzle-orm";
import { cached, invalidateCache } from "../cache";

const router = Router();

let freightIndexCache: { data: any; fetchedAt: number } | null = null;
const FREIGHT_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

const FREIGHT_META: Record<string, { name: string; description: string }> = {
  BDI:  { name: "Baltic Dry Index",          description: "Dry Bulk" },
  BCTI: { name: "Baltic Clean Tanker Index", description: "Clean Tanker" },
  BDTI: { name: "Baltic Dirty Tanker Index", description: "Dirty Tanker" },
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

router.get("/freight-indices", isAuthenticated, async (_req, res) => {
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


router.get("/bunker-prices", isAuthenticated, async (_req, res) => {
  try {
    const prices = await cached('bunker-prices', 'long', () => storage.getBunkerPrices());
    res.json(prices);
  } catch {
    res.status(500).json({ message: "Failed to fetch bunker prices" });
  }
});


export default router;
