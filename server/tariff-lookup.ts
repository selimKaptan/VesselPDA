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

export type VesselSubCat = "container" | "passenger_ropax" | "cargo";

function getTariffVesselCategory(vesselCategory: VesselCategory, vesselSubCat?: VesselSubCat): string {
  if (vesselCategory === "turkish_cabotage") return "calisan_gemiler";
  if (vesselSubCat === "container") return "konteyner";
  if (vesselSubCat === "passenger_ropax") return "yolcu_feribot_roro_car_carrier";
  return "diger_yuk";
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
  isDangerous: boolean,
  vesselSubCat?: VesselSubCat
): Promise<LookupResult> {
  try {
    const serviceType = getPilotageServiceType(vesselCategory);
    const tariffVesselCat = getTariffVesselCategory(vesselCategory, vesselSubCat);
    const result = await pool.query(
      `SELECT base_fee, per_1000_grt FROM pilotage_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND service_type = $2 AND vessel_category = $3
       AND grt_min <= $4
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), grt_min DESC LIMIT 1`,
      [portId, serviceType, tariffVesselCat, grt]
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
  isDangerous: boolean,
  vesselSubCat?: VesselSubCat
): Promise<LookupResult> {
  try {
    const serviceType = getTugboatServiceType(vesselCategory);
    const tariffVesselCat = getTariffVesselCategory(vesselCategory, vesselSubCat);
    const result = await pool.query(
      `SELECT base_fee, per_1000_grt FROM pilotage_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND service_type = $2 AND vessel_category = $3
       AND grt_min <= $4
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), grt_min DESC LIMIT 1`,
      [portId, serviceType, tariffVesselCat, grt]
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
  isDangerous: boolean,
  isCabotage?: boolean
): Promise<LookupResult> {
  try {
    const serviceType = isCabotage ? "palamar_kabotaj" : "palamar_uluslararasi";
    const vesselCat = isCabotage ? "calisan_gemiler" : "diger_tum";
    const result = await pool.query(
      `SELECT base_fee, per_1000_grt FROM pilotage_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND service_type = $2 AND vessel_category = $3
       AND grt_min <= $4
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), grt_min DESC LIMIT 1`,
      [portId, serviceType, vesselCat, grt]
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
    const result = await pool.query(
      `SELECT intl_foreign_flag, intl_turkish_flag, cabotage_turkish, per_1000_gt, gt_threshold
       FROM berthing_tariffs
       WHERE (port_id = $1 OR port_id IS NULL) AND (gt_min IS NULL OR gt_min <= $2)
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), gt_min DESC LIMIT 1`,
      [portId, gt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const row = result.rows[0];

    let dailyRate: number;

    if (row.per_1000_gt != null) {
      const threshold = row.gt_threshold ?? 500;
      const flatFee = parseFloat(row.intl_foreign_flag ?? 10);
      const per1000Rate = parseFloat(row.per_1000_gt);
      const foreignDaily = gt <= threshold
        ? flatFee
        : Math.ceil(gt / 1000) * per1000Rate;
      const turkishDaily = Math.ceil(foreignDaily * 0.75);
      const cabotageDaily = Math.ceil(foreignDaily * 0.50);

      if (vesselCategory === "turkish_intl") dailyRate = turkishDaily;
      else if (vesselCategory === "turkish_cabotage") dailyRate = cabotageDaily;
      else dailyRate = foreignDaily;
    } else {
      const column = getBerthingColumn(vesselCategory);
      dailyRate = parseFloat((row as any)[column] || "0");
      if (!dailyRate) return { fee: 0, source: "fallback" };
    }

    return { fee: Math.round(dailyRate * berthDays * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupAgencyFee(
  pool: Pool,
  portId: number,
  nrt: number,
  eurUsdParity: number
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
    const feeUsd = currency === "EUR" ? feeEur * eurUsdParity : feeEur;
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

export async function lookupChamberFreightShareFee(
  pool: Pool,
  portId: number,
  cargoQty: number,
  flagCategory: VesselCategory
): Promise<LookupResult> {
  // Turkish and cabotage vessels are exempt — return 0 immediately
  if (flagCategory === "turkish_intl" || flagCategory === "turkish_cabotage") {
    return { fee: 0, source: "database" };
  }
  if (cargoQty <= 0) return { fee: 0, source: "database" };
  try {
    const result = await pool.query(
      `SELECT fee, currency FROM chamber_freight_share
       WHERE (port_id = $1 OR port_id IS NULL)
         AND flag_category IN ('foreign', 'all')
         AND cargo_min <= $2
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), cargo_min DESC LIMIT 1`,
      [portId, cargoQty]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const fee = parseFloat(result.rows[0].fee || "0");
    return { fee: Math.round(fee * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupChamberShippingFee(
  pool: Pool,
  portId: number,
  grt: number,
  vesselCat: VesselCategory,
  usdTryRate: number
): Promise<LookupResult> {
  const flagCat = vesselCat === "turkish_intl" || vesselCat === "turkish_cabotage" ? "turkish" : "foreign";
  try {
    const result = await pool.query(
      `SELECT fee, currency FROM chamber_of_shipping_fees
       WHERE (port_id = $1 OR port_id IS NULL)
         AND (flag_category = $2 OR flag_category = 'all')
         AND gt_min <= $3
       ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), gt_min DESC LIMIT 1`,
      [portId, flagCat, grt]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const fee = parseFloat(result.rows[0].fee || "0");
    const currency = result.rows[0].currency || "USD";
    const feeUsd = currency === "TRY" ? fee / usdTryRate : fee;
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

export async function lookupLightDuesFee(
  pool: Pool,
  portId: number,
  nrt: number,
  vesselCategory: VesselCategory
): Promise<LookupResult> {
  try {
    const categoryMap: Record<VesselCategory, string> = {
      foreign_intl: "Foreign Flagged Commercial",
      turkish_intl: "Turkish Flagged International",
      turkish_cabotage: "Turkish Cabotage",
    };
    const dbCategory = categoryMap[vesselCategory];
    const result = await pool.query(
      `SELECT rate_up_to_800, rate_above_800 FROM light_dues
       WHERE service_type = 'Lighthouse Fee'
         AND service_desc = 'Port Entry'
         AND vessel_category = $1
         AND (port_id = $2 OR port_id IS NULL)
       ORDER BY (CASE WHEN port_id = $2 THEN 0 ELSE 1 END) LIMIT 1`,
      [dbCategory, portId]
    );
    if (result.rows.length === 0) return { fee: 0, source: "fallback" };
    const rateUp = parseFloat(result.rows[0].rate_up_to_800 || "0");
    const rateAbove = parseFloat(result.rows[0].rate_above_800 || "0");
    if (!rateUp) return { fee: 0, source: "fallback" };
    const fee = (Math.min(nrt, 800) * rateUp + Math.max(0, nrt - 800) * rateAbove) * 2;
    return { fee: Math.round(fee * 100) / 100, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

function getSupervisionCargoKeyword(cargoType: string): { keyword: string; unit: string } {
  const t = (cargoType || "").toLowerCase().trim();
  if (/lpg|lng|gaz|propane|propan|butane/.test(t) || (t.includes("gas") && !t.includes("gasoil")))
    return { keyword: "LPG ve LNG", unit: "MT" };
  if (/crude|ham petrol|akaryakit|slop|naphtha|naptha|gasoil|diesel|fuel oil|mazot|bitumen|asphalt/.test(t))
    return { keyword: "Ham Petrol", unit: "MT" };
  if (/chemical|kimyasal|methanol|solvent|acid|asit|caustic|vegetable oil|palm|molasses|melas|zeytinyagi|olive oil|lube|lubricant|glycerin/.test(t))
    return { keyword: "Kimyevi maddeler", unit: "MT" };
  if (/container|konteyner|teu|box/.test(t))
    return { keyword: "Dolu konteyner", unit: "Adet" };
  if (/ro.?ro|roro|vehicle|araç|otomobil|car\b|truck|kamyon|jeep|minibus|pickup|panelvan/.test(t))
    return { keyword: "Otomobil", unit: "Adet" };
  if (/steel|çelik|coil|pipe|boru|sac|kangal|profil|paper|breakbulk|break.?bulk|timber|kereste|lumber|bag|çuval/.test(t))
    return { keyword: "Demir-celik", unit: "MT" };
  if (/grain|tahıl|tahil|wheat|buğday|bugday|barley|arpa|corn|mısır|misir|soya|pirinç|rice|sunflower|aycicek/.test(t))
    return { keyword: "Tahil ve Tohumlar", unit: "MT" };
  return { keyword: "Kati Esya", unit: "MT" };
}

function parseQuantityRange(range: string): { min: number; max: number } {
  if (!range || range === "--" || range.toLowerCase().includes("tum")) return { min: 0, max: Infinity };
  const cleaned = range.replace(/\./g, "").replace(/,/g, "");
  const nums = cleaned.match(/\d+/g);
  if (!nums || nums.length === 0) return { min: 0, max: Infinity };
  const isUzeri = /uzeri|ve uzeri/i.test(range);
  if (nums.length === 1 || isUzeri) return { min: parseInt(nums[0]), max: Infinity };
  return { min: parseInt(nums[0]), max: parseInt(nums[1]) };
}

export async function lookupSupervisionFee(
  pool: Pool,
  portId: number,
  cargoType: string,
  cargoQuantity: number,
  vesselCategory: VesselCategory,
  eurUsdParity: number
): Promise<LookupResult> {
  if (cargoQuantity <= 0) return { fee: 0, source: "database" };
  if (vesselCategory === "turkish_cabotage") return { fee: 0, source: "database" };
  try {
    const { keyword, unit } = getSupervisionCargoKeyword(cargoType);
    const [cargoRows, ruleRows] = await Promise.all([
      pool.query(
        `SELECT rate, unit, quantity_range, port_id FROM supervision_fees
         WHERE cargo_type ILIKE $1
           AND (port_id = $2 OR port_id IS NULL)
         ORDER BY (CASE WHEN port_id = $2 THEN 0 ELSE 1 END), id`,
        [`%${keyword}%`, portId]
      ),
      pool.query(
        `SELECT cargo_type, rate FROM supervision_fees
         WHERE category = 'Genel Kural'
           AND (port_id = $1 OR port_id IS NULL)
         ORDER BY (CASE WHEN port_id = $1 THEN 0 ELSE 1 END), id`,
        [portId]
      ),
    ]);

    if (cargoRows.rows.length === 0) return { fee: 0, source: "fallback" };

    const portSpecificRows = cargoRows.rows.filter((r: any) => r.port_id !== null);
    const globalTariffRows = cargoRows.rows.filter((r: any) => r.port_id === null);
    const tieredRows = portSpecificRows.length > 0 ? portSpecificRows : globalTariffRows;

    const sortedTiers = tieredRows
      .map((row: any) => ({ ...row, ...parseQuantityRange(row.quantity_range) }))
      .sort((a: any, b: any) => a.min - b.min);

    let feeEur = 0;
    let processedQty = 0;
    for (const tier of sortedTiers) {
      if (processedQty >= cargoQuantity) break;
      const tierEnd = tier.max === Infinity ? cargoQuantity : Math.min(cargoQuantity, tier.max);
      const tierQty = tierEnd - processedQty;
      if (tierQty > 0) {
        feeEur += tierQty * parseFloat(tier.rate || "0");
        processedQty = tierEnd;
      }
    }

    let minFeeEur = 300;
    let maxFeeEur = 10000;
    for (const rule of ruleRows.rows) {
      const ct = (rule.cargo_type || "").toLowerCase();
      if (ct.includes("asgari") || ct.includes("minimum")) {
        const v = parseFloat(rule.rate);
        if (!isNaN(v)) minFeeEur = v;
      }
      if (ct.includes("azami") || ct.includes("maksimum") || ct.includes("maximum")) {
        const v = parseFloat(rule.rate);
        if (!isNaN(v)) maxFeeEur = v;
      }
    }

    feeEur = Math.min(maxFeeEur, Math.max(minFeeEur, feeEur));

    if (vesselCategory === "turkish_intl") feeEur *= 0.5;

    const feeUsd = Math.round(feeEur * eurUsdParity * 100) / 100;
    return { fee: feeUsd, source: "database" };
  } catch {
    return { fee: 0, source: "fallback" };
  }
}

export async function lookupMiscExpenses(
  pool: Pool,
  portId: number
): Promise<Record<string, number>> {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (expense_type) expense_type, fee_usd
       FROM misc_expenses
       WHERE port_id = $1 OR port_id IS NULL
       ORDER BY expense_type, (CASE WHEN port_id = $1 THEN 0 ELSE 1 END)`,
      [portId]
    );
    const map: Record<string, number> = {};
    for (const row of result.rows) {
      map[row.expense_type] = parseFloat(row.fee_usd);
    }
    return map;
  } catch {
    return {};
  }
}
