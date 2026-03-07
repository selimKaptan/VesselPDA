import { XMLParser } from "fast-xml-parser";
import { pool } from "./db";

const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

const FALLBACK: Record<string, { buy: number; sell: number; effective: number }> = {
  "USD/TRY": { buy: 43.50, sell: 44.22, effective: 43.86 },
  "EUR/TRY": { buy: 51.30, sell: 52.16, effective: 51.73 },
  "GBP/TRY": { buy: 55.10, sell: 55.90, effective: 55.50 },
  "JPY/TRY": { buy: 0.28, sell: 0.30, effective: 0.29 },
  "CNY/TRY": { buy: 6.00, sell: 6.20, effective: 6.10 },
  "NOK/TRY": { buy: 3.90, sell: 4.10, effective: 4.00 },
  "SGD/TRY": { buy: 32.00, sell: 33.00, effective: 32.50 },
  "EUR/USD": { buy: 1.170, sell: 1.185, effective: 1.178 },
};

export interface RateRecord {
  baseCurrency: string;
  targetCurrency: string;
  buyRate: number | null;
  sellRate: number | null;
  effectiveRate: number;
  source: string;
  updatedAt: Date;
}

export interface RatesBundle {
  usdTry: number;
  eurTry: number;
  gbpTry: number;
  jpyTry: number;
  cnyTry: number;
  nokTry: number;
  sgdTry: number;
  eurUsd: number;
  source: string;
  updatedAt: string | null;
}

// ── Fetch from TCMB and upsert to DB ──────────────────────────────────────────
export async function fetchTCMBRates(): Promise<RatesBundle> {
  console.log("[exchange] Fetching TCMB rates from", TCMB_URL);

  const response = await fetch(TCMB_URL, {
    headers: { "User-Agent": "VesselPDA/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`TCMB responded with ${response.status}`);

  const xml = await response.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml) as any;

  const currencies: any[] = parsed?.Tarih_Date?.Currency ?? [];

  function findCurrency(code: string) {
    return currencies.find(
      (c: any) => c["@_CurrencyCode"] === code || c["@_Kod"] === code
    );
  }

  function extractPair(code: string): { buy: number; sell: number; effective: number } | null {
    const c = findCurrency(code);
    if (!c) return null;
    const buy = parseFloat(String(c.ForexBuying).replace(",", "."));
    const sell = parseFloat(String(c.ForexSelling).replace(",", "."));
    if (isNaN(buy) || isNaN(sell) || buy <= 0 || sell <= 0) return null;
    return { buy, sell, effective: Math.round(((buy + sell) / 2) * 10000) / 10000 };
  }

  const usd = extractPair("USD");
  const eur = extractPair("EUR");
  const gbp = extractPair("GBP");
  const jpy = extractPair("JPY");
  const cny = extractPair("CNY");
  const nok = extractPair("NOK");
  const sgd = extractPair("SGD");

  if (!usd || !eur) throw new Error("Could not parse USD/EUR rates from TCMB XML");

  const eurUsdEffective = Math.round((eur.effective / usd.effective) * 100000) / 100000;
  const gbpEff = gbp?.effective ?? FALLBACK["GBP/TRY"].effective;
  const jpyEff = jpy?.effective ?? FALLBACK["JPY/TRY"].effective;
  const cnyEff = cny?.effective ?? FALLBACK["CNY/TRY"].effective;
  const nokEff = nok?.effective ?? FALLBACK["NOK/TRY"].effective;
  const sgdEff = sgd?.effective ?? FALLBACK["SGD/TRY"].effective;

  const pairs = [
    { base: "USD", target: "TRY", buy: usd.buy, sell: usd.sell, eff: usd.effective },
    { base: "EUR", target: "TRY", buy: eur.buy, sell: eur.sell, eff: eur.effective },
    { base: "GBP", target: "TRY", buy: gbp?.buy ?? null, sell: gbp?.sell ?? null, eff: gbpEff },
    { base: "JPY", target: "TRY", buy: jpy?.buy ?? null, sell: jpy?.sell ?? null, eff: jpyEff },
    { base: "CNY", target: "TRY", buy: cny?.buy ?? null, sell: cny?.sell ?? null, eff: cnyEff },
    { base: "NOK", target: "TRY", buy: nok?.buy ?? null, sell: nok?.sell ?? null, eff: nokEff },
    { base: "SGD", target: "TRY", buy: sgd?.buy ?? null, sell: sgd?.sell ?? null, eff: sgdEff },
    { base: "EUR", target: "USD", buy: null, sell: null, eff: eurUsdEffective },
  ];

  for (const p of pairs) {
    await pool.query(
      `INSERT INTO exchange_rates (base_currency, target_currency, buy_rate, sell_rate, effective_rate, source, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'tcmb', NOW())
       ON CONFLICT (base_currency, target_currency, source)
       DO UPDATE SET buy_rate = $3, sell_rate = $4, effective_rate = $5, updated_at = NOW()`,
      [p.base, p.target, p.buy ?? null, p.sell ?? null, p.eff]
    );
  }

  const now = new Date().toISOString();
  console.log(`[exchange] Saved rates: USD/TRY=${usd.effective} EUR/TRY=${eur.effective} EUR/USD=${eurUsdEffective}`);

  return {
    usdTry: usd.effective,
    eurTry: eur.effective,
    gbpTry: gbpEff,
    jpyTry: jpyEff,
    cnyTry: cnyEff,
    nokTry: nokEff,
    sgdTry: sgdEff,
    eurUsd: eurUsdEffective,
    source: "tcmb",
    updatedAt: now,
  };
}

// ── Read cached rates from DB ──────────────────────────────────────────────────
export async function getCachedRates(): Promise<RatesBundle | null> {
  const result = await pool.query(
    `SELECT base_currency, target_currency, effective_rate, updated_at
     FROM exchange_rates
     WHERE source = 'tcmb'
     ORDER BY updated_at DESC`
  );

  if (result.rows.length === 0) return null;

  const map: Record<string, number> = {};
  let latestUpdatedAt: Date | null = null;

  for (const row of result.rows) {
    const key = `${row.base_currency}/${row.target_currency}`;
    map[key] = parseFloat(row.effective_rate);
    if (!latestUpdatedAt || row.updated_at > latestUpdatedAt) {
      latestUpdatedAt = row.updated_at;
    }
  }

  if (!map["USD/TRY"] || !map["EUR/TRY"]) return null;

  return {
    usdTry: map["USD/TRY"],
    eurTry: map["EUR/TRY"],
    gbpTry: map["GBP/TRY"] ?? FALLBACK["GBP/TRY"].effective,
    jpyTry: map["JPY/TRY"] ?? FALLBACK["JPY/TRY"].effective,
    cnyTry: map["CNY/TRY"] ?? FALLBACK["CNY/TRY"].effective,
    nokTry: map["NOK/TRY"] ?? FALLBACK["NOK/TRY"].effective,
    sgdTry: map["SGD/TRY"] ?? FALLBACK["SGD/TRY"].effective,
    eurUsd: map["EUR/USD"] ?? Math.round((map["EUR/TRY"] / map["USD/TRY"]) * 100000) / 100000,
    source: "tcmb",
    updatedAt: latestUpdatedAt?.toISOString() ?? null,
  };
}

// ── Get single pair (fallback to hardcoded) ────────────────────────────────────
export async function getExchangeRate(from: string, to: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT effective_rate FROM exchange_rates
       WHERE base_currency = $1 AND target_currency = $2 AND source = 'tcmb'
       ORDER BY updated_at DESC LIMIT 1`,
      [from.toUpperCase(), to.toUpperCase()]
    );
    if (result.rows.length > 0) return parseFloat(result.rows[0].effective_rate);
  } catch (_) {}

  const key = `${from.toUpperCase()}/${to.toUpperCase()}`;
  return FALLBACK[key]?.effective ?? 1;
}

// ── Serve rates: DB cache first, live TCMB if stale (>4h) ─────────────────────
export async function getOrFetchRates(forceRefresh = false): Promise<RatesBundle> {
  if (!forceRefresh) {
    try {
      const cached = await getCachedRates();
      if (cached && cached.updatedAt) {
        const ageMs = Date.now() - new Date(cached.updatedAt).getTime();
        if (ageMs < 4 * 60 * 60 * 1000) {
          return cached;
        }
      }
    } catch (_) {}
  }

  try {
    return await fetchTCMBRates();
  } catch (err: any) {
    console.error("[exchange] Live fetch failed:", err.message);
    const cached = await getCachedRates();
    if (cached) return cached;
    return {
      usdTry: FALLBACK["USD/TRY"].effective,
      eurTry: FALLBACK["EUR/TRY"].effective,
      gbpTry: FALLBACK["GBP/TRY"].effective,
      jpyTry: FALLBACK["JPY/TRY"].effective,
      cnyTry: FALLBACK["CNY/TRY"].effective,
      nokTry: FALLBACK["NOK/TRY"].effective,
      sgdTry: FALLBACK["SGD/TRY"].effective,
      eurUsd: FALLBACK["EUR/USD"].effective,
      source: "fallback",
      updatedAt: null,
    };
  }
}
