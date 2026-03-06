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
  dbSanitaryFee?: number;
  dbChamberFreightShareFee?: number;
  dbLightDuesFee?: number;
  dbMotorboatFee?: number;
  dbFacilitiesFee?: number;
  dbTransportationFee?: number;
  dbFiscalFee?: number;
  dbCommunicationFee?: number;
  dbVtsFee?: number;
  dbHarbourMasterFee?: number;
  dbCustomsFee?: number;
  dbChamberDtoFee?: number;
  dbAnchoragePerDay?: number;
  dbSupervisionFee?: number;
}

export interface CalculatedLineItem {
  description: string;
  amountUsd: number;
  amountEur: number;
  notes?: string;
  category?: string;
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


const DTO_FREIGHT_TABLE = [
  { minCargo: 0, rate: 580 },
  { minCargo: 20001, rate: 870 },
  { minCargo: 40001, rate: 1130 },
  { minCargo: 60001, rate: 1400 },
  { minCargo: 100001, rate: 1780 },
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
  { minNrt: 10001, baseEur: 4000, perExtra1000Eur: 125 },
  { minNrt: 20001, baseEur: 5250, perExtra1000Eur: 100 },
  { minNrt: 30001, baseEur: 6250, perExtra1000Eur: 75 },
  { minNrt: 40001, baseEur: 7000, perExtra1000Eur: 75 },
  { minNrt: 50001, baseEur: 7750, perExtra1000Eur: 75 },
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
  return (input.dbAnchoragePerDay ?? 0) * input.anchorageDays;
}

function calcSanitary(input: CalculationInput): number {
  if (input.dbSanitaryFee != null && input.dbSanitaryFee > 0) return input.dbSanitaryFee;
  const { nrt, usdTryRate } = input;
  return (nrt * 21.67) / usdTryRate;
}

function calcHarbourMaster(input: CalculationInput): number {
  if (input.dbHarbourMasterFee != null && input.dbHarbourMasterFee > 0) return input.dbHarbourMasterFee;
  const { nrt, usdTryRate } = input;
  const lcbRow = vlookup(nrt, SANITARY_LCB_TABLE, "minNrt");
  const lcb = lcbRow.rateTL / usdTryRate;
  const overtimeRow = vlookup(nrt, OVERTIME_LCB_TABLE, "minNrt");
  const overtimeLcb = overtimeRow.rateTL / usdTryRate;
  return lcb + overtimeLcb;
}


function calcLightDues(input: CalculationInput): number {
  if (input.dbLightDuesFee != null && input.dbLightDuesFee > 0) return input.dbLightDuesFee;
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
  return input.dbVtsFee ?? 0;
}

function calcCustomsOvertime(input: CalculationInput): number {
  return input.dbCustomsFee ?? 0;
}

function calcChamberOfShipping(input: CalculationInput): number {
  return input.dbChamberDtoFee ?? 0;
}

function calcChamberFreightShare(input: CalculationInput): number {
  const { cargoQuantity, flagCategory } = input;
  if (cargoQuantity <= 0) return 0;
  // Only charged to foreign-flagged vessels
  if (flagCategory === "turkish" || flagCategory === "cabotage") return 0;
  if (input.dbChamberFreightShareFee != null && input.dbChamberFreightShareFee > 0) return input.dbChamberFreightShareFee;
  const row = vlookup(cargoQuantity, DTO_FREIGHT_TABLE, "minCargo");
  return row.rate;
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
  if (input.flagCategory === "cabotage") return 0;
  const { cargoQuantity, cargoType, eurUsdParity } = input;
  if (cargoQuantity <= 0) return 0;

  if (input.dbSupervisionFee != null && input.dbSupervisionFee >= 0) {
    return input.dbSupervisionFee;
  }

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
  let fee: number;
  if (input.dbAgencyFee != null && input.dbAgencyFee > 0) {
    fee = input.dbAgencyFee;
  } else {
    const { nrt, eurUsdParity } = input;
    const row = vlookup(nrt, AGENCY_FEE_TABLE, "minNrt");
    const extra = row.perExtra1000Eur > 0 ? Math.ceil(Math.max(0, nrt - row.minNrt) / 1000) * row.perExtra1000Eur : 0;
    fee = (row.baseEur + extra) * eurUsdParity;
  }
  if (input.flagCategory === "cabotage") fee *= 0.5;
  return fee;
}

export function calculateProforma(input: CalculationInput): CalculationResult {
  const { eurUsdParity } = input;
  const lineItems: CalculatedLineItem[] = [];

  function addItem(description: string, amountUsd: number, notesOrCategory?: string, category?: string) {
    if (amountUsd > 0) {
      lineItems.push({
        description,
        amountUsd: Math.round(amountUsd * 100) / 100,
        amountEur: Math.round((amountUsd / eurUsdParity) * 100) / 100,
        notes: category ? notesOrCategory : undefined,
        category: category ?? notesOrCategory,
      });
    }
  }

  addItem(
    "Pilotage",
    calcPilotage(input),
    "50% overtime will applicable on National/Religious holidays & Sundays",
    "Port Navigation"
  );

  addItem(
    input.grt > 5000 ? "Tugboats ×2 (GRT > 5,000 — mandatory 2nd tug)" : "Tugboats",
    calcTugboat(input),
    "50% overtime will applicable on National/Religious holidays & Sundays",
    "Port Navigation"
  );

  addItem(
    "Mooring Boat",
    calcMooring(input),
    "50% overtime will applicable on National/Religious holidays & Sundays",
    "Port Navigation"
  );

  addItem("Wharfage / Quay Dues", calcWharfage(input), undefined, "Port Dues");

  addItem("Garbage", calcGarbage(input), "Compulsory charge", "Port Dues");

  addItem("Harbour Master Dues", calcHarbourMaster(input), undefined, "Port Dues");

  addItem("Sanitary Dues", calcSanitary(input), undefined, "Port Dues");

  addItem("Light Dues", calcLightDues(input), undefined, "Regulatory");

  addItem("VTS Fee", calcVts(input), undefined, "Regulatory");

  addItem("Customs Overtime", calcCustomsOvertime(input), undefined, "Regulatory");

  addItem(
    `Anchorage Dues${input.anchorageDays > 0 ? ` (${input.anchorageDays} days)` : ""}`,
    calcAnchorageDues(input),
    undefined,
    "Regulatory"
  );

  addItem("Chamber of Shipping Fee", calcChamberOfShipping(input), undefined, "Chamber & Official");

  addItem("Chamber of Shipping Share on Freight", calcChamberFreightShare(input), undefined, "Chamber & Official");

  addItem("Motorboat Exp.", input.dbMotorboatFee ?? 500, undefined, "Disbursement");
  addItem("Facilities & Other Exp.", input.dbFacilitiesFee ?? 550, undefined, "Disbursement");
  addItem("Transportation Exp.", input.dbTransportationFee ?? 500, undefined, "Disbursement");
  addItem("Fiscal & Notary Exp.", input.dbFiscalFee ?? 250, undefined, "Disbursement");
  addItem("Communication & Copy & Stamp Exp.", input.dbCommunicationFee ?? 250, undefined, "Disbursement");

  addItem(
    "Supervision Fee",
    calcSupervision(input),
    input.flagCategory === "cabotage" ? "Not applicable for cabotage voyages." : "As per official tariff.",
    "Supervision"
  );

  addItem(
    "Agency Fee",
    calcAgencyFee(input),
    input.flagCategory === "cabotage"
      ? "As per official tariff. Basic fee covers up to 7 days. +20% for each additional 5 days. 50% discount applied for cabotage voyages."
      : "As per official tariff. Basic fee covers up to 7 days. +20% for each additional 5 days.",
    "Agency"
  );

  const totalUsd = Math.round(lineItems.reduce((sum, item) => sum + item.amountUsd, 0) * 100) / 100;
  const totalEur = Math.round(lineItems.reduce((sum, item) => sum + item.amountEur, 0) * 100) / 100;

  return { lineItems, totalUsd, totalEur };
}
