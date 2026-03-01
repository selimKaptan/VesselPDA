export interface CalculationInput {
  nrt: number;
  grt: number;
  cargoQuantity: number;
  cargoType?: string;
  berthStayDays: number;
  anchorageDays: number;
  isDangerousCargo: boolean;
  customsType: "import" | "export" | "transit" | "none";
  flagCategory: "turkish" | "foreign" | "cabotage";
  dtoCategory: "turkish" | "foreign";
  lighthouseCategory: "turkish" | "foreign" | "cabotage";
  vtsCategory: "turkish" | "foreign" | "cabotage";
  wharfageCategory: "foreign" | "turkish" | "cabotage" | "izmir_tcdd";
  usdTryRate: number;
  eurTryRate: number;
  eurUsdParity: number;
  dbPilotageFee?: number;
  dbTugboatFee?: number;
  dbMooringFee?: number;
  dbBerthingFee?: number;
  dbAgencyFee?: number;
  dbMarpolFee?: number;
  dbLcbFee?: number;
}

export interface CalculatedLineItem {
  description: string;
  amountUsd: number;
  amountEur: number;
  notes?: string;
}

export interface CalculationResult {
  lineItems: CalculatedLineItem[];
  totalUsd: number;
  totalEur: number;
}

const PILOTAGE_BASE = 202.27;
const PILOTAGE_PER_1000 = 83.17;

const TUGBOAT_BASE = 382.99;
const TUGBOAT_PER_1000 = 71.87;

const MOORING_BASE = 22.58;
const MOORING_PER_1000 = 11.29;

const GARBAGE_TABLE = [
  { minGrt: 0, rate: 80 },
  { minGrt: 1001, rate: 140 },
  { minGrt: 5001, rate: 210 },
  { minGrt: 10001, rate: 250 },
  { minGrt: 15001, rate: 300 },
  { minGrt: 20001, rate: 350 },
  { minGrt: 25001, rate: 400 },
  { minGrt: 35001, rate: 540 },
  { minGrt: 60001, rate: 720 },
];

const SANITARY_LCB_TABLE = [
  { minNrt: 0, rateTL: 1283.9 },
  { minNrt: 501, rateTL: 3424.0 },
  { minNrt: 2001, rateTL: 6848.1 },
  { minNrt: 4001, rateTL: 10272.2 },
  { minNrt: 8001, rateTL: 17120.2 },
  { minNrt: 10001, rateTL: 34240.9 },
  { minNrt: 30001, rateTL: 51361.4 },
  { minNrt: 50001, rateTL: 85602.3 },
];

const OVERTIME_LCB_TABLE = [
  { minNrt: 0, rateTL: 251.0 },
  { minNrt: 501, rateTL: 628.0 },
  { minNrt: 2001, rateTL: 1506.0 },
  { minNrt: 4001, rateTL: 2259.0 },
  { minNrt: 8001, rateTL: 3012.0 },
  { minNrt: 10001, rateTL: 6024.0 },
  { minNrt: 30001, rateTL: 9036.0 },
  { minNrt: 50001, rateTL: 15059.0 },
];

const DTO_TABLE_TURK = [
  { minGrt: 0, rateTL: 670 },
  { minGrt: 501, rateTL: 1120 },
  { minGrt: 1501, rateTL: 2050 },
  { minGrt: 2501, rateTL: 2800 },
  { minGrt: 5001, rateTL: 3400 },
  { minGrt: 10001, rateTL: 4000 },
  { minGrt: 25001, rateTL: 4500 },
  { minGrt: 35001, rateTL: 5000 },
  { minGrt: 50001, rateTL: 5300 },
];

const DTO_TABLE_FOREIGN = [
  { minGrt: 0, rateTL: 1400 },
  { minGrt: 501, rateTL: 2800 },
  { minGrt: 1501, rateTL: 4200 },
  { minGrt: 2501, rateTL: 4900 },
  { minGrt: 5001, rateTL: 5600 },
  { minGrt: 10001, rateTL: 6300 },
  { minGrt: 25001, rateTL: 7000 },
  { minGrt: 35001, rateTL: 7500 },
  { minGrt: 50001, rateTL: 8000 },
];

const DTO_FREIGHT_TABLE = [
  { minCargo: 0, rate: 580 },
  { minCargo: 20001, rate: 870 },
  { minCargo: 40001, rate: 1130 },
  { minCargo: 60001, rate: 1400 },
  { minCargo: 100001, rate: 1780 },
];

const CUSTOMS_IMPORT_TABLE = [
  { minCargo: 0, rateTL: 20100 },
  { minCargo: 3001, rateTL: 26350 },
  { minCargo: 6001, rateTL: 32700 },
  { minCargo: 9001, rateTL: 38840 },
  { minCargo: 12001, rateTL: 45305 },
  { minCargo: 15001, rateTL: 51585 },
  { minCargo: 18001, rateTL: 57935 },
  { minCargo: 21001, rateTL: 62210 },
  { minCargo: 25001, rateTL: 68525 },
  { minCargo: 30001, rateTL: 77205 },
  { minCargo: 35001, rateTL: 106105 },
];

const CUSTOMS_EXPORT_TABLE = [
  { minCargo: 0, rateTL: 8615 },
  { minCargo: 3001, rateTL: 11230 },
  { minCargo: 6001, rateTL: 13750 },
  { minCargo: 9001, rateTL: 16465 },
  { minCargo: 12001, rateTL: 18505 },
  { minCargo: 15001, rateTL: 21345 },
  { minCargo: 18001, rateTL: 24915 },
  { minCargo: 21001, rateTL: 28395 },
  { minCargo: 25001, rateTL: 35830 },
  { minCargo: 30001, rateTL: 42335 },
  { minCargo: 35001, rateTL: 46770 },
];

const VTS_TABLE = [
  { minNrt: 0, foreign: 0, turkish: 0, cabotage: 0 },
  { minNrt: 300, foreign: 92.4, turkish: 23.1, cabotage: 8.4 },
  { minNrt: 2001, foreign: 184.8, turkish: 46.2, cabotage: 16.8 },
  { minNrt: 5001, foreign: 346.5, turkish: 86.625, cabotage: 31.5 },
  { minNrt: 10001, foreign: 519.75, turkish: 129.9375, cabotage: 47.25 },
  { minNrt: 20001, foreign: 693, turkish: 173.25, cabotage: 63 },
  { minNrt: 50001, foreign: 1039.5, turkish: 259.875, cabotage: 94.5 },
];

const AGENCY_FEE_TABLE = [
  { minNrt: 0, baseEur: 600, perExtra1000Eur: 0 },
  { minNrt: 501, baseEur: 1000, perExtra1000Eur: 0 },
  { minNrt: 1001, baseEur: 1500, perExtra1000Eur: 0 },
  { minNrt: 2001, baseEur: 1850, perExtra1000Eur: 0 },
  { minNrt: 3001, baseEur: 2300, perExtra1000Eur: 0 },
  { minNrt: 4001, baseEur: 2750, perExtra1000Eur: 0 },
  { minNrt: 5001, baseEur: 3200, perExtra1000Eur: 0 },
  { minNrt: 7501, baseEur: 4000, perExtra1000Eur: 0 },
  { minNrt: 10001, baseEur: 4000, perExtra1000Eur: 75 },
  { minNrt: 20001, baseEur: 4750, perExtra1000Eur: 65 },
  { minNrt: 30001, baseEur: 5400, perExtra1000Eur: 55 },
  { minNrt: 40001, baseEur: 5950, perExtra1000Eur: 40 },
  { minNrt: 50001, baseEur: 6350, perExtra1000Eur: 25 },
];

function vlookup<T extends Record<string, number>>(value: number, table: T[], minKey: keyof T): T {
  let result = table[0];
  for (const row of table) {
    if (value >= (row[minKey] as number)) {
      result = row;
    } else {
      break;
    }
  }
  return result;
}

function calcPilotage(input: CalculationInput): number {
  if (input.dbPilotageFee != null && input.dbPilotageFee > 0) return input.dbPilotageFee;
  const { grt, isDangerousCargo } = input;
  const base = grt <= 1000 ? PILOTAGE_BASE : PILOTAGE_BASE + Math.ceil((grt - 1000) / 1000) * PILOTAGE_PER_1000;
  const dangerousMultiplier = isDangerousCargo ? 1.3 : 1;
  return 2 * base * dangerousMultiplier;
}

function calcTugboat(input: CalculationInput): number {
  if (input.dbTugboatFee != null && input.dbTugboatFee > 0) return input.dbTugboatFee;
  const { grt, isDangerousCargo } = input;
  const tugCount = grt > 5000 ? 4 : 2;
  const base = grt <= 1000 ? TUGBOAT_BASE : TUGBOAT_BASE + Math.ceil((grt - 1000) / 1000) * TUGBOAT_PER_1000;
  const dangerousMultiplier = isDangerousCargo ? 1.3 : 1;
  return tugCount * base * dangerousMultiplier;
}

function calcMooring(input: CalculationInput): number {
  if (input.dbMooringFee != null && input.dbMooringFee > 0) return input.dbMooringFee;
  const { grt, isDangerousCargo } = input;
  const base = grt <= 1000 ? MOORING_BASE : MOORING_BASE + Math.ceil((grt - 1000) / 1000) * MOORING_PER_1000;
  const dangerousMultiplier = isDangerousCargo ? 1.3 : 1;
  return 2 * base * dangerousMultiplier;
}

function calcWharfage(input: CalculationInput): number {
  if (input.dbBerthingFee != null && input.dbBerthingFee > 0) return input.dbBerthingFee;
  const { grt, berthStayDays, wharfageCategory } = input;
  if (wharfageCategory === "izmir_tcdd") {
    return Math.ceil(grt / 1000) * berthStayDays * 10;
  }
  const baseRate = grt <= 500 ? 10 : Math.ceil(grt / 1000) * 25;
  let multiplier = 1;
  if (wharfageCategory === "cabotage") multiplier = 0.5;
  else if (wharfageCategory === "turkish") multiplier = 0.75;
  return Math.ceil(baseRate * multiplier) * berthStayDays;
}

function calcGarbage(input: CalculationInput): number {
  if (input.dbMarpolFee != null && input.dbMarpolFee > 0) return input.dbMarpolFee;
  const { grt, eurUsdParity } = input;
  const row = vlookup(grt, GARBAGE_TABLE, "minGrt");
  return row.rate * eurUsdParity;
}

function calcAnchorageDues(input: CalculationInput): number {
  const { grt, anchorageDays } = input;
  if (anchorageDays <= 0) return 0;
  if (anchorageDays <= 7) {
    return grt * 0.004 * anchorageDays;
  }
  return (grt * 0.004 * 7) + (grt * 0.006 * (anchorageDays - 7));
}

function calcSanitary(input: CalculationInput): number {
  const { nrt, usdTryRate } = input;
  return (nrt * 21.67) / usdTryRate;
}

function calcHarbourMaster(input: CalculationInput): number {
  if (input.dbLcbFee != null && input.dbLcbFee > 0) return input.dbLcbFee;
  const { nrt, usdTryRate } = input;
  const lcbRow = vlookup(nrt, SANITARY_LCB_TABLE, "minNrt");
  const lcb = lcbRow.rateTL / usdTryRate;
  const overtimeRow = vlookup(nrt, OVERTIME_LCB_TABLE, "minNrt");
  const overtimeLcb = overtimeRow.rateTL / usdTryRate;
  const ordino = (overtimeLcb / 2) + (5.71 / usdTryRate);
  return lcb + overtimeLcb + 2 * ordino;
}

function calcOtoService(input: CalculationInput): number {
  return input.grt * 0.01;
}

function calcLightDues(input: CalculationInput): number {
  const { nrt, lighthouseCategory } = input;
  let rate1: number, rate2: number;
  if (lighthouseCategory === "foreign") {
    rate1 = 0.22176;
    rate2 = 0.11088;
  } else if (lighthouseCategory === "cabotage") {
    rate1 = 0.03528;
    rate2 = 0.01764;
  } else {
    rate1 = 0.1241856;
    rate2 = 0.0620928;
  }
  return (Math.min(nrt, 800) * rate1 + Math.max(0, nrt - 800) * rate2) * 2;
}

function calcVts(input: CalculationInput): number {
  const { nrt, vtsCategory } = input;
  if (nrt < 300) return 0;
  const row = vlookup(nrt, VTS_TABLE, "minNrt");
  const rate = vtsCategory === "foreign" ? row.foreign : vtsCategory === "cabotage" ? row.cabotage : row.turkish;
  return rate * 2;
}

function calcCustomsOvertime(input: CalculationInput): number {
  const { cargoQuantity, customsType, usdTryRate } = input;
  if (customsType === "transit" || customsType === "none") return 0;
  if (cargoQuantity <= 0) return 0;
  const table = customsType === "import" ? CUSTOMS_IMPORT_TABLE : CUSTOMS_EXPORT_TABLE;
  const row = vlookup(cargoQuantity, table, "minCargo");
  const baseFee = row.rateTL / usdTryRate;
  const additionalStampFee = 3865 / usdTryRate;
  return baseFee + additionalStampFee;
}

function calcChamberOfShipping(input: CalculationInput): number {
  const { grt, dtoCategory, usdTryRate } = input;
  const table = dtoCategory === "turkish" ? DTO_TABLE_TURK : DTO_TABLE_FOREIGN;
  const row = vlookup(grt, table, "minGrt");
  return row.rateTL / usdTryRate;
}

function calcChamberFreightShare(input: CalculationInput): number {
  const { cargoQuantity } = input;
  if (cargoQuantity <= 0) return 0;
  const row = vlookup(cargoQuantity, DTO_FREIGHT_TABLE, "minCargo");
  return row.rate;
}

function calcVda(input: CalculationInput): number {
  const { grt, eurUsdParity } = input;
  const base = grt <= 5000 ? 20 : 40;
  return base * eurUsdParity;
}

export function getCargoCategory(cargoType?: string): "bulk_dry" | "general" | "container" | "roro" | "liquid" | "chemical" | "gas" {
  const t = (cargoType || "").toLowerCase().trim();
  if (!t) return "bulk_dry";

  if (/lpg|lng|gas|gaz|ammon|propane|propan|butane/.test(t)) return "gas";
  if (/chemical|kimyasal|acid|asit|methanol|solvent|caustic|etanol|ethanol/.test(t)) return "chemical";
  if (/crude|fuel oil|mazot|petrol|vegetable oil|palm|molasses|pekmez|bitumen|asphalt|liquid|sıvı|slop|naphtha|naptha|gasoil|diesel|bunker|lube|lubricant/.test(t)) return "liquid";
  if (/container|konteyner|teu|box/.test(t)) return "container";
  if (/ro.?ro|roro|vehicle|araç|car\b|otomobil|truck|kamyon/.test(t)) return "roro";
  if (/general|genel|steel|çelik|coil|bobine|timber|kereste|lumber|bag|çuval|project|breakbulk|break.?bulk|pipes|boru|machinery|makine/.test(t)) return "general";
  if (/grain|tahıl|wheat|buğday|barley|arpa|corn|mısır|coal|kömür|ore|maden|iron|demir|fertilizer|gübre|scrap|hurda|clinker|cement|çimento|salt|tuz|soya|aggregate|granit|gypsum|alçı|bauxite|boksit|pet.?coke|sulphur|kükürt|sand|kum/.test(t)) return "bulk_dry";

  return "bulk_dry";
}

function calcSupervision(input: CalculationInput): number {
  const { cargoQuantity, cargoType, eurUsdParity } = input;
  if (cargoQuantity <= 0) return 0;

  const category = getCargoCategory(cargoType);
  let amountUsd: number;

  switch (category) {
    case "gas":
      amountUsd = 2500;
      break;
    case "chemical":
      amountUsd = 1800;
      break;
    case "liquid":
      amountUsd = 1200;
      break;
    case "container":
      amountUsd = cargoQuantity * 25;
      break;
    case "roro":
      amountUsd = cargoQuantity * 20;
      break;
    case "general":
      amountUsd = cargoQuantity * 0.35 * eurUsdParity;
      break;
    case "bulk_dry":
    default:
      amountUsd = cargoQuantity * 0.20 * eurUsdParity;
      break;
  }

  return Math.round(amountUsd * 100) / 100;
}

function calcAgencyFee(input: CalculationInput): number {
  if (input.dbAgencyFee != null && input.dbAgencyFee > 0) return input.dbAgencyFee;
  const { nrt, eurUsdParity, berthStayDays } = input;
  const row = vlookup(nrt, AGENCY_FEE_TABLE, "minNrt");
  const extra = row.perExtra1000Eur > 0 ? Math.ceil(Math.max(0, nrt - row.minNrt) / 1000) * row.perExtra1000Eur : 0;
  let baseFee = (row.baseEur + extra) * eurUsdParity;
  if (berthStayDays > 7) {
    const extraPeriods = Math.ceil((berthStayDays - 7) / 5);
    baseFee = baseFee * (1 + 0.2 * extraPeriods);
  }
  return baseFee;
}

export function calculateProforma(input: CalculationInput): CalculationResult {
  const { eurUsdParity } = input;
  const lineItems: CalculatedLineItem[] = [];

  function addItem(description: string, amountUsd: number, notes?: string) {
    if (amountUsd > 0) {
      lineItems.push({
        description,
        amountUsd: Math.round(amountUsd * 100) / 100,
        amountEur: Math.round((amountUsd / eurUsdParity) * 100) / 100,
        notes,
      });
    }
  }

  addItem(
    "Pilotage",
    calcPilotage(input),
    "50% overtime will applicable on National/Religious holidays & Sundays"
  );

  addItem(
    "Tugboats",
    calcTugboat(input),
    "50% overtime will applicable on National/Religious holidays & Sundays"
  );

  addItem("Wharfage / Quay Dues", calcWharfage(input));

  addItem(
    "Mooring Boat",
    calcMooring(input),
    "50% overtime will applicable on National/Religious holidays & Sundays"
  );

  addItem("Garbage", calcGarbage(input), "Compulsory charge");

  addItem("Oto Service", calcOtoService(input));

  addItem("Harbour Master Dues", calcHarbourMaster(input));

  addItem("Sanitary Dues", calcSanitary(input));

  addItem("Light Dues", calcLightDues(input));

  addItem("VTS Fee", calcVts(input));

  addItem("Customs Overtime", calcCustomsOvertime(input));

  const anchorage = calcAnchorageDues(input);
  lineItems.push({
    description: `Anchorage Dues${input.anchorageDays > 0 ? ` for (${input.anchorageDays})` : ""}`,
    amountUsd: Math.round(anchorage * 100) / 100,
    amountEur: Math.round((anchorage / eurUsdParity) * 100) / 100,
  });

  addItem("Chamber of Shipping Fee", calcChamberOfShipping(input));

  addItem("Chamber of Shipping Share on Freight", calcChamberFreightShare(input));

  addItem("Contr. to Maritime Association Fee", calcVda(input));

  addItem("Motorboat Exp.", 500);
  addItem("Facilities & Other Exp.", 550);
  addItem("Transportation Exp.", 500);
  addItem("Fiscal & Notary Exp.", 250);
  addItem("Communication & Copy & Stamp Exp.", 250);

  addItem("Supervision Fee", calcSupervision(input), "As per official tariff");

  addItem(
    "Agency Fee",
    calcAgencyFee(input),
    "As per official tariff. Basic fee covers up to 7 days. +20% for each additional 5 days."
  );

  const totalUsd = Math.round(lineItems.reduce((sum, item) => sum + item.amountUsd, 0) * 100) / 100;
  const totalEur = Math.round(lineItems.reduce((sum, item) => sum + item.amountEur, 0) * 100) / 100;

  return { lineItems, totalUsd, totalEur };
}
