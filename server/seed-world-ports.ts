import { db } from "./db";
import { ports } from "@shared/schema";
import { eq, count } from "drizzle-orm";

const COUNTRY_CURRENCY: Record<string, string> = {
  AD: "EUR", AE: "AED", AF: "AFN", AG: "XCD", AL: "ALL", AM: "AMD", AO: "AOA",
  AR: "ARS", AT: "EUR", AU: "AUD", AZ: "AZN", BA: "BAM", BB: "BBD", BD: "BDT",
  BE: "EUR", BF: "XOF", BG: "BGN", BH: "BHD", BI: "BIF", BJ: "XOF", BN: "BND",
  BO: "BOB", BR: "BRL", BS: "BSD", BT: "BTN", BW: "BWP", BY: "BYN", BZ: "BZD",
  CA: "CAD", CD: "CDF", CF: "XAF", CG: "XAF", CH: "CHF", CI: "XOF", CL: "CLP",
  CM: "XAF", CN: "CNY", CO: "COP", CR: "CRC", CU: "CUP", CV: "CVE", CY: "EUR",
  CZ: "CZK", DE: "EUR", DJ: "DJF", DK: "DKK", DM: "XCD", DO: "DOP", DZ: "DZD",
  EC: "USD", EE: "EUR", EG: "EGP", ER: "ERN", ES: "EUR", ET: "ETB", FI: "EUR",
  FJ: "FJD", FM: "USD", FR: "EUR", GA: "XAF", GB: "GBP", GD: "XCD", GE: "GEL",
  GH: "GHS", GM: "GMD", GN: "GNF", GQ: "XAF", GR: "EUR", GT: "GTQ", GW: "XOF",
  GY: "GYD", HN: "HNL", HR: "EUR", HT: "HTG", HU: "HUF", ID: "IDR", IE: "EUR",
  IL: "ILS", IN: "INR", IQ: "IQD", IR: "IRR", IS: "ISK", IT: "EUR", JM: "JMD",
  JO: "JOD", JP: "JPY", KE: "KES", KG: "KGS", KH: "KHR", KI: "AUD", KM: "KMF",
  KN: "XCD", KP: "KPW", KR: "KRW", KW: "KWD", KZ: "KZT", LA: "LAK", LB: "LBP",
  LC: "XCD", LK: "LKR", LR: "LRD", LS: "LSL", LT: "EUR", LU: "EUR", LV: "EUR",
  LY: "LYD", MA: "MAD", MD: "MDL", ME: "EUR", MG: "MGA", MH: "USD", MK: "MKD",
  ML: "XOF", MM: "MMK", MN: "MNT", MR: "MRU", MT: "EUR", MU: "MUR", MV: "MVR",
  MW: "MWK", MX: "MXN", MY: "MYR", MZ: "MZN", NA: "NAD", NE: "XOF", NG: "NGN",
  NI: "NIO", NL: "EUR", NO: "NOK", NP: "NPR", NR: "AUD", NZ: "NZD", OM: "OMR",
  PA: "PAB", PE: "PEN", PG: "PGK", PH: "PHP", PK: "PKR", PL: "PLN", PT: "EUR",
  PW: "USD", PY: "PYG", QA: "QAR", RO: "RON", RS: "RSD", RU: "RUB", RW: "RWF",
  SA: "SAR", SB: "SBD", SC: "SCR", SD: "SDG", SE: "SEK", SG: "SGD", SI: "EUR",
  SK: "EUR", SL: "SLL", SM: "EUR", SN: "XOF", SO: "SOS", SR: "SRD", SS: "SSP",
  ST: "STN", SV: "USD", SX: "ANG", SY: "SYP", SZ: "SZL", TD: "XAF", TG: "XOF",
  TH: "THB", TJ: "TJS", TL: "USD", TM: "TMT", TN: "TND", TO: "TOP", TP: "USD",
  TT: "TTD", TV: "AUD", TZ: "TZS", UA: "UAH", UG: "UGX", US: "USD", UY: "UYU",
  UZ: "UZS", VA: "EUR", VC: "XCD", VE: "VES", VG: "USD", VN: "VND", VU: "VUV",
  WS: "WST", YE: "YER", ZA: "ZAR", ZM: "ZMW", ZW: "ZWL",
};

function parseCoordinates(coordStr: string): { lat: number | null; lon: number | null } {
  if (!coordStr || coordStr.trim() === "") return { lat: null, lon: null };
  const parts = coordStr.trim().split(" ");
  if (parts.length !== 2) return { lat: null, lon: null };

  const [latStr, lonStr] = parts;
  if (!latStr || !lonStr) return { lat: null, lon: null };

  const latDir = latStr.slice(-1);
  const lonDir = lonStr.slice(-1);
  if (!["N", "S"].includes(latDir) || !["E", "W"].includes(lonDir)) return { lat: null, lon: null };

  const latNum = latStr.slice(0, -1);
  const lonNum = lonStr.slice(0, -1);

  if (latNum.length < 4 || lonNum.length < 4) return { lat: null, lon: null };

  const latDeg = parseInt(latNum.slice(0, -2), 10);
  const latMin = parseInt(latNum.slice(-2), 10);
  const lonDeg = parseInt(lonNum.slice(0, -2), 10);
  const lonMin = parseInt(lonNum.slice(-2), 10);

  if (isNaN(latDeg) || isNaN(latMin) || isNaN(lonDeg) || isNaN(lonMin)) return { lat: null, lon: null };

  const lat = (latDeg + latMin / 60) * (latDir === "S" ? -1 : 1);
  const lon = (lonDeg + lonMin / 60) * (lonDir === "W" ? -1 : 1);
  return { lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)) };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function seedWorldPorts(): Promise<void> {
  const [{ value: portCount }] = await db.select({ value: count() }).from(ports);
  if (portCount >= 2000) {
    console.log(`World ports already loaded (${portCount} total ports).`);
    return;
  }

  console.log("Fetching UN/LOCODE seaport data...");

  let csvText: string;
  try {
    const res = await fetch("https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
  } catch (err) {
    console.error("Failed to fetch UN/LOCODE data:", err);
    return;
  }

  const lines = csvText.split("\n");
  const seaports: Array<{ name: string; code: string; country: string; currency: string; latitude?: number; longitude?: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 8) continue;

    const country = cols[1]?.trim();
    const location = cols[2]?.trim();
    const nameWoDiacritics = cols[4]?.trim() || cols[3]?.trim();
    const functionCode = cols[7]?.trim() || "";
    const coordStr = cols[10]?.trim() || "";

    if (!country || !location || !nameWoDiacritics) continue;
    if (country === "TR") continue;
    if (functionCode[0] !== "1") continue;

    const locode = country + location;
    const currency = COUNTRY_CURRENCY[country] || "USD";
    const { lat, lon } = parseCoordinates(coordStr);

    const entry: { name: string; code: string; country: string; currency: string; latitude?: number; longitude?: number } = {
      name: nameWoDiacritics,
      code: locode,
      country,
      currency,
    };
    if (lat !== null) entry.latitude = lat;
    if (lon !== null) entry.longitude = lon;

    seaports.push(entry);
  }

  console.log(`Parsed ${seaports.length} world seaports. Inserting in batches...`);

  const BATCH_SIZE = 300;
  let inserted = 0;
  for (let i = 0; i < seaports.length; i += BATCH_SIZE) {
    const batch = seaports.slice(i, i + BATCH_SIZE);
    await db.insert(ports).values(batch).onConflictDoNothing();
    inserted += batch.length;
    if (inserted % 3000 === 0 || inserted >= seaports.length) {
      console.log(`  Inserted ${inserted}/${seaports.length} world ports...`);
    }
  }

  console.log(`✓ World ports loaded: ${seaports.length} seaports added.`);
}
