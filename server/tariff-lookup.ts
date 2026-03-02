import { Pool } from "pg";

export type VesselCategory = "foreign_intl" | "turkish_intl" | "turkish_cabotage";

interface LookupResult {
  fee: number;
  source: "database" | "fallback";
}

function getPilotageServiceType(vesselCategory: VesselCategory): string {
  if (vesselCategory === "turkish_cabotage") return "kabotaj";
  return "uluslararasi";
}

function getTugboatServiceType(vesselCategory: VesselCategory): string {
  if (vesselCategory === "turkish_cabotage") return "romorkör_kabotaj";
  return "romorkör_uluslararasi";
}

function getBerthingColumn(vesselCategory: VesselCategory): string {
  if (vesselCategory === "foreign_intl") return "intl_foreign_flag";
  if (vesselCategory === "turkish_intl") return "intl_turkish_flag";
  return "cabotage_turkish";
}

export async function lookupPilotageFee(
  pool: Pool,
  portId: number,
  grt: number,
  vesselCategory: VesselCategory,
  isDangerous: boolean
): Promise<LookupResult> {
  try {
    const serviceType = getPilotageServiceType(vesselCategory);
    const result = await pool.query(
      `SELECT base_fee, per_1000_grt FROM pilotage_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND service_type = $2 AND vessel_category = 'diger_yuk'
       AND grt_min <= $3
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), grt_min DESC LIMIT 1`,
      [portId, serviceType, grt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const baseFee = parseFloat(result.rows[0].base_fee);
    const perUnit = parseFloat(result.rows[0].per_1000_grt || "0");
    let perVoyage = grt <= 1000
      ? baseFee
      : baseFee + Math.ceil((grt - 1000) / 1000) * perUnit;
    if (isDangerous) perVoyage *= 1.3;
    return { fee: Math.round(perVoyage * 2 * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupTugboatFee(
  pool: Pool,
  portId: number,
  grt: number,
  vesselCategory: VesselCategory,
  isDangerous: boolean
): Promise<LookupResult> {
  try {
    const serviceType = getTugboatServiceType(vesselCategory);
    const result = await pool.query(
      `SELECT base_fee, per_1000_grt FROM pilotage_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND service_type = $2 AND vessel_category = 'diger_yuk'
       AND grt_min <= $3
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), grt_min DESC LIMIT 1`,
      [portId, serviceType, grt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const baseFee = parseFloat(result.rows[0].base_fee);
    const perUnit = parseFloat(result.rows[0].per_1000_grt || "0");
    const tugCount = grt > 5000 ? 4 : 2;
    let perTug = grt <= 1000
      ? baseFee
      : baseFee + Math.ceil((grt - 1000) / 1000) * perUnit;
    if (isDangerous) perTug *= 1.3;
    return { fee: Math.round(tugCount * perTug * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupMooringFee(
  pool: Pool,
  portId: number,
  grt: number,
  isDangerous: boolean
): Promise<LookupResult> {
  try {
    const result = await pool.query(
      `SELECT base_fee, per_1000_grt FROM pilotage_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND service_type = 'palamar_kabotaj_yeni' AND vessel_category = 'diger_tum'
       AND grt_min <= $2
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), grt_min DESC LIMIT 1`,
      [portId, grt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const baseFee = parseFloat(result.rows[0].base_fee);
    const perUnit = parseFloat(result.rows[0].per_1000_grt || "0");
    let perOp = grt <= 1000
      ? baseFee
      : baseFee + Math.ceil((grt - 1000) / 1000) * perUnit;
    if (isDangerous) perOp *= 1.3;
    return { fee: Math.round(perOp * 2 * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupBerthingFee(
  pool: Pool,
  portId: number,
  gt: number,
  vesselCategory: VesselCategory,
  berthDays: number
): Promise<LookupResult> {
  try {
    const column = getBerthingColumn(vesselCategory);
    const result = await pool.query(
      `SELECT ${column} as daily_rate FROM berthing_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND gt_min <= $2
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), gt_min DESC LIMIT 1`,
      [portId, gt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const dailyRate = parseFloat(result.rows[0].daily_rate || "0");
    if (!dailyRate) return { fee: 0, source: "fallback" };
    return { fee: Math.round(dailyRate * berthDays * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupAgencyFee(
  pool: Pool,
  portId: number,
  nrt: number,
  eurUsdParity: number,
  berthDays: number
): Promise<LookupResult> {
  try {
    const result = await pool.query(
      `SELECT nt_min, fee, per_1000_nt, currency FROM agency_fees
       WHERE (port_id = $1 OR port_id IS NULL) AND service_type = 'acentelik'
       AND nt_min <= $2
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), nt_min DESC LIMIT 1`,
      [portId, nrt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const row = result.rows[0];
    const baseFee = parseFloat(row.fee);
    const per1000Nt = row.per_1000_nt ? parseFloat(row.per_1000_nt) : 0;
    const ntMin = parseInt(row.nt_min);
    const currency = row.currency;
    let feeEur: number;
    if (per1000Nt > 0) {
      feeEur = baseFee + Math.ceil((nrt - ntMin) / 1000) * per1000Nt;
    } else {
      feeEur = baseFee;
    }
    let feeUsd = currency === "EUR" ? feeEur * eurUsdParity : feeEur;
    if (berthDays > 7) {
      const extraPeriods = Math.ceil((berthDays - 7) / 5);
      feeUsd = feeUsd * (1 + 0.2 * extraPeriods);
    }
    return { fee: Math.round(feeUsd * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupMarpolFee(
  pool: Pool,
  portId: number,
  grt: number,
  eurUsdParity: number
): Promise<LookupResult> {
  try {
    const result = await pool.query(
      `SELECT fixed_fee, currency FROM marpol_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND grt_min <= $2
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), grt_min DESC LIMIT 1`,
      [portId, grt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const fee = parseFloat(result.rows[0].fixed_fee);
    const currency = result.rows[0].currency;
    const feeUsd = currency === "EUR" ? fee * eurUsdParity : fee;
    return { fee: Math.round(feeUsd * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupLcbFee(
  pool: Pool,
  portId: number,
  nrt: number,
  usdTryRate: number
): Promise<LookupResult> {
  try {
    const result = await pool.query(
      `SELECT amount, currency FROM lcb_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND nrt_min <= $2
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), nrt_min DESC LIMIT 1`,
      [portId, nrt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const amount = parseFloat(result.rows[0].amount);
    const currency = result.rows[0].currency;
    const feeUsd = currency === "TRY" ? amount / usdTryRate : amount;
    return { fee: Math.round(feeUsd * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupSanitaryDuesFee(
  pool: Pool,
  portId: number,
  nrt: number,
  usdTryRate: number
): Promise<LookupResult> {
  try {
    const result = await pool.query(
      `SELECT nrt_rate, currency FROM sanitary_dues
       WHERE (port_id = $1 OR port_id IS NULL)
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END) LIMIT 1`,
      [portId]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const nrtRate = parseFloat(result.rows[0].nrt_rate || "0");
    if (!nrtRate) return { fee: 0, source: "fallback" };
    const feeTry = nrt * nrtRate;
    return { fee: Math.round((feeTry / usdTryRate) * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}
