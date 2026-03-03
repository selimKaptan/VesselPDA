import { pool } from "./db";

// ── Schema migration ──────────────────────────────────────────────────────────
export async function ensureBenchmarkSchema() {
  console.log("[benchmarks] Ensuring schema...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS port_cost_benchmarks (
        id SERIAL PRIMARY KEY,
        port_id INTEGER NOT NULL REFERENCES ports(id) ON DELETE CASCADE,
        vessel_size_category TEXT NOT NULL,
        purpose_of_call TEXT NOT NULL,
        avg_total_cost REAL,
        min_total_cost REAL,
        max_total_cost REAL,
        avg_agency_fee REAL,
        avg_pilotage REAL,
        avg_tugboat REAL,
        avg_berthing REAL,
        avg_port_dues REAL,
        sample_count INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(port_id, vessel_size_category, purpose_of_call)
      )
    `);
    console.log("[benchmarks] ✓ Schema ready.");
  } catch (err) {
    console.error("[benchmarks] Schema error:", err);
  }
}

// ── GRT → size category ───────────────────────────────────────────────────────
function grtToCategory(grt: number): string {
  if (grt < 5000)  return "small";
  if (grt < 20000) return "medium";
  if (grt < 50000) return "large";
  return "vlarge";
}

// ── Purpose mapping from proforma data ────────────────────────────────────────
function normalizePurpose(p: string): string {
  const s = (p || "").toLowerCase();
  if (s.includes("load"))     return "loading";
  if (s.includes("discharg")) return "discharging";
  if (s.includes("bunker"))   return "bunkering";
  return "transit";
}

// ── Main calculation ──────────────────────────────────────────────────────────
export async function calculateBenchmarks() {
  console.log("[benchmarks] Starting calculation...");
  try {
    // Pull data from proformas — line_items stored as JSONB array
    const { rows: proformaRows } = await pool.query(`
      SELECT
        p.port_id,
        p.purpose_of_call,
        v.grt,
        p.total_usd,
        COALESCE((
          SELECT SUM((item->>'amountUsd')::real)
          FROM jsonb_array_elements(p.line_items) AS item
          WHERE item->>'description' ILIKE '%agency%'
        ), 0) AS agency_fee,
        COALESCE((
          SELECT SUM((item->>'amountUsd')::real)
          FROM jsonb_array_elements(p.line_items) AS item
          WHERE item->>'description' ILIKE '%pilot%'
        ), 0) AS pilotage,
        COALESCE((
          SELECT SUM((item->>'amountUsd')::real)
          FROM jsonb_array_elements(p.line_items) AS item
          WHERE item->>'description' ILIKE '%tugboat%'
        ), 0) AS tugboat,
        COALESCE((
          SELECT SUM((item->>'amountUsd')::real)
          FROM jsonb_array_elements(p.line_items) AS item
          WHERE item->>'description' ILIKE '%berth%'
             OR item->>'description' ILIKE '%mooring%'
        ), 0) AS berthing,
        COALESCE((
          SELECT SUM((item->>'amountUsd')::real)
          FROM jsonb_array_elements(p.line_items) AS item
          WHERE item->>'description' ILIKE '%port due%'
             OR item->>'description' ILIKE '%harbour%'
             OR item->>'description' ILIKE '%lighthouse%'
        ), 0) AS port_dues
      FROM proformas p
      LEFT JOIN vessels v ON v.id = p.vessel_id
      WHERE p.port_id IS NOT NULL
        AND p.total_usd IS NOT NULL
        AND p.total_usd > 0
        AND p.status IN ('submitted', 'draft')
    `);

    // Also pull from final disbursements if table exists
    let fdRows: any[] = [];
    try {
      const { rows } = await pool.query(`
        SELECT
          fd.port_id,
          fd.purpose_of_call,
          v.grt,
          fd.total_amount_usd AS usd_total,
          0 AS agency_fee, 0 AS pilotage, 0 AS tugboat, 0 AS berthing, 0 AS port_dues
        FROM final_disbursements fd
        LEFT JOIN voyages vo ON vo.id = fd.voyage_id
        LEFT JOIN vessels v ON v.id = vo.vessel_id
        WHERE fd.port_id IS NOT NULL
          AND fd.total_amount_usd IS NOT NULL
          AND fd.total_amount_usd > 0
      `);
      fdRows = rows;
    } catch { /* table may not exist */ }

    const allRows = [...proformaRows, ...fdRows];

    // Group by port + vesselSizeCategory + purpose
    type GroupKey = string;
    const groups: Record<GroupKey, {
      portId: number;
      sizeCategory: string;
      purpose: string;
      totals: number[];
      agencyFees: number[];
      pilotages: number[];
      tugboats: number[];
      berthings: number[];
      portDues: number[];
    }> = {};

    for (const row of allRows) {
      const portId = row.port_id;
      if (!portId) continue;
      const grt = parseFloat(row.grt) || 10000;
      const sizeCategory = grtToCategory(grt);
      const purpose = normalizePurpose(row.purpose_of_call || "");
      const key: GroupKey = `${portId}-${sizeCategory}-${purpose}`;

      if (!groups[key]) {
        groups[key] = { portId, sizeCategory, purpose, totals: [], agencyFees: [], pilotages: [], tugboats: [], berthings: [], portDues: [] };
      }

      const g = groups[key];
      const total = parseFloat(row.total_usd);
      if (total > 0) g.totals.push(total);
      if (parseFloat(row.agency_fee) > 0) g.agencyFees.push(parseFloat(row.agency_fee));
      if (parseFloat(row.pilotage) > 0) g.pilotages.push(parseFloat(row.pilotage));
      if (parseFloat(row.tugboat) > 0) g.tugboats.push(parseFloat(row.tugboat));
      if (parseFloat(row.berthing) > 0) g.berthings.push(parseFloat(row.berthing));
      if (parseFloat(row.port_dues) > 0) g.portDues.push(parseFloat(row.port_dues));
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const min = (arr: number[]) => arr.length ? Math.min(...arr) : null;
    const max = (arr: number[]) => arr.length ? Math.max(...arr) : null;

    let written = 0;
    for (const [, g] of Object.entries(groups)) {
      if (g.totals.length === 0) continue;
      await pool.query(`
        INSERT INTO port_cost_benchmarks
          (port_id, vessel_size_category, purpose_of_call, avg_total_cost, min_total_cost, max_total_cost,
           avg_agency_fee, avg_pilotage, avg_tugboat, avg_berthing, avg_port_dues, sample_count, last_updated)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
        ON CONFLICT (port_id, vessel_size_category, purpose_of_call) DO UPDATE SET
          avg_total_cost = EXCLUDED.avg_total_cost,
          min_total_cost = EXCLUDED.min_total_cost,
          max_total_cost = EXCLUDED.max_total_cost,
          avg_agency_fee = EXCLUDED.avg_agency_fee,
          avg_pilotage = EXCLUDED.avg_pilotage,
          avg_tugboat = EXCLUDED.avg_tugboat,
          avg_berthing = EXCLUDED.avg_berthing,
          avg_port_dues = EXCLUDED.avg_port_dues,
          sample_count = EXCLUDED.sample_count,
          last_updated = NOW()
      `, [
        g.portId, g.sizeCategory, g.purpose,
        avg(g.totals), min(g.totals), max(g.totals),
        avg(g.agencyFees), avg(g.pilotages), avg(g.tugboats),
        avg(g.berthings), avg(g.portDues),
        g.totals.length,
      ]);
      written++;
    }
    console.log(`[benchmarks] ✓ Wrote ${written} benchmark groups from ${allRows.length} DA records.`);
  } catch (err: any) {
    console.error("[benchmarks] Calculation error:", err?.message);
  }
}
