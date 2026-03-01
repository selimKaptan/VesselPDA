import { db } from "./db";
import { ports, tariffCategories, tariffRates, forumCategories } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import turkishPorts from "./turkish-ports.json";
import { seedWorldPorts } from "./seed-world-ports";

async function seedTariffs(port: { id: number; name: string }, portMultiplier: number) {
  const pilotage = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Pilotage",
    description: "50% overtime applicable on National/Religious holidays & Sundays",
    calculationType: "grt_based",
    overtimeRate: 0.5,
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: pilotage[0].id, minGrt: 0, maxGrt: 3000, rate: Math.round(800 * portMultiplier) },
    { categoryId: pilotage[0].id, minGrt: 3001, maxGrt: 6000, rate: Math.round(1000 * portMultiplier) },
    { categoryId: pilotage[0].id, minGrt: 6001, maxGrt: 10000, rate: Math.round(1200 * portMultiplier) },
    { categoryId: pilotage[0].id, minGrt: 10001, maxGrt: 20000, rate: Math.round(1500 * portMultiplier) },
    { categoryId: pilotage[0].id, minGrt: 20001, maxGrt: null, rate: Math.round(2000 * portMultiplier) },
  ]);

  const tugboats = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Tugboats",
    description: "50% overtime applicable on National/Religious holidays & Sundays",
    calculationType: "grt_based",
    overtimeRate: 0.5,
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: tugboats[0].id, minGrt: 0, maxGrt: 3000, rate: Math.round(1800 * portMultiplier) },
    { categoryId: tugboats[0].id, minGrt: 3001, maxGrt: 6000, rate: Math.round(2500 * portMultiplier) },
    { categoryId: tugboats[0].id, minGrt: 6001, maxGrt: 10000, rate: Math.round(3200 * portMultiplier) },
    { categoryId: tugboats[0].id, minGrt: 10001, maxGrt: 20000, rate: Math.round(4000 * portMultiplier) },
    { categoryId: tugboats[0].id, minGrt: 20001, maxGrt: null, rate: Math.round(5500 * portMultiplier) },
  ]);

  const wharfage = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Wharfage / Quay Dues",
    calculationType: "per_day",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: wharfage[0].id, minGrt: 0, maxGrt: null, rate: Math.round(150 * portMultiplier) },
  ]);

  const mooring = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Mooring Boat",
    description: "50% overtime applicable on National/Religious holidays & Sundays",
    calculationType: "grt_based",
    overtimeRate: 0.5,
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: mooring[0].id, minGrt: 0, maxGrt: 5000, rate: Math.round(180 * portMultiplier) },
    { categoryId: mooring[0].id, minGrt: 5001, maxGrt: 15000, rate: Math.round(250 * portMultiplier) },
    { categoryId: mooring[0].id, minGrt: 15001, maxGrt: null, rate: Math.round(350 * portMultiplier) },
  ]);

  const garbage = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Garbage",
    description: "Compulsory charge",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: garbage[0].id, minGrt: 0, maxGrt: null, rate: Math.round(243 * portMultiplier) },
  ]);

  const harbourMaster = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Harbour Master Dues",
    calculationType: "grt_based",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: harbourMaster[0].id, minGrt: 0, maxGrt: 3000, rate: Math.round(130 * portMultiplier) },
    { categoryId: harbourMaster[0].id, minGrt: 3001, maxGrt: 10000, rate: Math.round(196 * portMultiplier) },
    { categoryId: harbourMaster[0].id, minGrt: 10001, maxGrt: null, rate: Math.round(280 * portMultiplier) },
  ]);

  const sanitary = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Sanitary Dues",
    calculationType: "grt_based",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: sanitary[0].id, minGrt: 0, maxGrt: 3000, rate: Math.round(800 * portMultiplier) },
    { categoryId: sanitary[0].id, minGrt: 3001, maxGrt: 10000, rate: Math.round(1202 * portMultiplier) },
    { categoryId: sanitary[0].id, minGrt: 10001, maxGrt: null, rate: Math.round(1600 * portMultiplier) },
  ]);

  const lightDues = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Light Dues",
    calculationType: "grt_based",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: lightDues[0].id, minGrt: 0, maxGrt: 3000, rate: Math.round(550 * portMultiplier) },
    { categoryId: lightDues[0].id, minGrt: 3001, maxGrt: 10000, rate: Math.round(822 * portMultiplier) },
    { categoryId: lightDues[0].id, minGrt: 10001, maxGrt: null, rate: Math.round(1100 * portMultiplier) },
  ]);

  const customOvertime = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Custom Overtime",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: customOvertime[0].id, minGrt: 0, maxGrt: null, rate: Math.round(580 * portMultiplier) },
  ]);

  const chamberShipping = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Chamber of Shipping Fee",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: chamberShipping[0].id, minGrt: 0, maxGrt: null, rate: Math.round(134 * portMultiplier) },
  ]);

  const chamberFreight = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Chamber of Shipping Share on Freight",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: chamberFreight[0].id, minGrt: 0, maxGrt: null, rate: Math.round(650 * portMultiplier) },
  ]);

  const maritime = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Contr. to Maritime Association Fee",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: maritime[0].id, minGrt: 0, maxGrt: null, rate: Math.round(47 * portMultiplier) },
  ]);

  const motorboat = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Motorboat Expenses",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: motorboat[0].id, minGrt: 0, maxGrt: null, rate: Math.round(500 * portMultiplier) },
  ]);

  const facilities = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Facilities & Other Expenses",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: facilities[0].id, minGrt: 0, maxGrt: null, rate: Math.round(500 * portMultiplier) },
  ]);

  const transportation = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Transportation Expenses",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: transportation[0].id, minGrt: 0, maxGrt: null, rate: Math.round(450 * portMultiplier) },
  ]);

  const fiscal = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Fiscal & Notary Expenses",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: fiscal[0].id, minGrt: 0, maxGrt: null, rate: Math.round(200 * portMultiplier) },
  ]);

  const communication = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Communication & Copy & Stamp Expenses",
    calculationType: "fixed",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: communication[0].id, minGrt: 0, maxGrt: null, rate: Math.round(200 * portMultiplier) },
  ]);

  const supervision = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Supervision Fee",
    description: "As per official tariff",
    calculationType: "grt_based",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: supervision[0].id, minGrt: 0, maxGrt: 3000, rate: Math.round(500 * portMultiplier) },
    { categoryId: supervision[0].id, minGrt: 3001, maxGrt: 7000, rate: Math.round(700 * portMultiplier) },
    { categoryId: supervision[0].id, minGrt: 7001, maxGrt: null, rate: Math.round(900 * portMultiplier) },
  ]);

  const agencyFee = await db.insert(tariffCategories).values({
    portId: port.id,
    name: "Agency Fee",
    description: "As per official tariff. Basic fee covers up to 5 days. +25% for each additional 3 days.",
    calculationType: "nrt_based",
    currency: "USD",
  }).returning();

  await db.insert(tariffRates).values([
    { categoryId: agencyFee[0].id, minGrt: 0, maxGrt: 500, rate: Math.round(600 * portMultiplier) },
    { categoryId: agencyFee[0].id, minGrt: 501, maxGrt: 1000, rate: Math.round(1000 * portMultiplier) },
    { categoryId: agencyFee[0].id, minGrt: 1001, maxGrt: 2000, rate: Math.round(1500 * portMultiplier) },
    { categoryId: agencyFee[0].id, minGrt: 2001, maxGrt: 3000, rate: Math.round(1850 * portMultiplier) },
    { categoryId: agencyFee[0].id, minGrt: 3001, maxGrt: 5000, rate: Math.round(2500 * portMultiplier) },
    { categoryId: agencyFee[0].id, minGrt: 5001, maxGrt: 10000, rate: Math.round(3200 * portMultiplier) },
    { categoryId: agencyFee[0].id, minGrt: 10001, maxGrt: null, rate: Math.round(4000 * portMultiplier) },
  ]);
}

function isValidTurkishPort(name: string): boolean {
  // Normalize Turkish characters before comparison (İ→i, Ş→s, etc.)
  const normalized = name
    .replace(/[İI]/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Üü]/g, "u")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c")
    .replace(/[Iı]/g, "i")
    .toLowerCase();
  const excluded = [
    "demir saha", "demirleme saha", "samandira",
    " boya", "nolu demir", "nolu demirleme",
  ];
  return !excluded.some(kw => normalized.includes(kw));
}

export async function seedDatabase() {
  const existingPorts = await db.select().from(ports);
  if (existingPorts.length > 0) {
    console.log(`Database already has ${existingPorts.length} ports, checking for new ports to add...`);

    const existingCodes = new Set(existingPorts.map(p => p.code));
    const newPorts = (turkishPorts as Array<{ name: string; code: string; country: string; currency: string }>)
      .filter(p => !existingCodes.has(p.code) && isValidTurkishPort(p.name));

    if (newPorts.length > 0) {
      console.log(`Adding ${newPorts.length} new Turkish ports...`);
      const batchSize = 50;
      for (let i = 0; i < newPorts.length; i += batchSize) {
        const batch = newPorts.slice(i, i + batchSize);
        const inserted = await db.insert(ports).values(batch).returning();
        for (const port of inserted) {
          await seedTariffs(port, 1.0);
        }
      }
      console.log(`Successfully added ${newPorts.length} new Turkish ports with tariff data.`);
    } else {
      console.log("All ports already loaded.");
    }
    await seedWorldPorts();
    return;
  }

  console.log("Seeding database with all Turkish port data...");

  const allPorts = turkishPorts as Array<{ name: string; code: string; country: string; currency: string }>;
  const batchSize = 50;
  let totalInserted = 0;

  for (let i = 0; i < allPorts.length; i += batchSize) {
    const batch = allPorts.slice(i, i + batchSize);
    const inserted = await db.insert(ports).values(batch).returning();
    for (const port of inserted) {
      const code = port.code || "";
      let portMultiplier = 1.0;
      if (code.startsWith("TRIST") || code.startsWith("TR092")) portMultiplier = 1.15;
      else if (code.startsWith("TRIZM") || code.startsWith("TRIZT")) portMultiplier = 1.05;
      else if (code.startsWith("TRMER")) portMultiplier = 0.95;
      await seedTariffs(port, portMultiplier);
    }
    totalInserted += inserted.length;
    console.log(`  Seeded ${totalInserted}/${allPorts.length} ports...`);
  }

  console.log(`Database seeded successfully with ${totalInserted} Turkish ports and tariff data.`);
  await seedWorldPorts();
}

const LOCODE_COORDS: Record<string, [number, number]> = {
  "TRALA": [36.5444, 32.0011],
  "TRALI": [38.8235, 26.9312],
  "TRAMB": [40.9667, 28.6667],
  "TRANT": [36.8969, 30.7133],
  "TRBAN": [40.3556, 27.9772],
  "TRBOD": [37.0344, 27.4305],
  "TRCAN": [40.1500, 26.4167],
  "TRCES": [38.3235, 26.3065],
  "TRCNK": [40.1500, 26.4167],
  "TRDER": [40.7483, 29.8283],
  "TRDID": [37.3726, 27.2693],
  "TREGT": [41.2800, 31.4200],
  "TRERE": [41.2800, 31.4200],
  "TRFET": [36.6224, 29.1151],
  "TRFIN": [36.2963, 30.1553],
  "TRGEB": [40.8031, 29.4308],
  "TRGEM": [40.4274, 29.1155],
  "TRGIR": [40.9128, 38.3895],
  "TRHAY": [41.0020, 29.0148],
  "TRISK": [36.5967, 36.1833],
  "TRIST": [41.0082, 28.9784],
  "TRIZM": [38.4192, 27.1287],
  "TRIZT": [40.7594, 29.7608],
  "TRKAR": [41.0800, 36.9000],
  "TRKOC": [40.7600, 29.9200],
  "TRKRG": [40.7833, 29.9167],
  "TRKUS": [37.8577, 27.2594],
  "TRMAR": [36.8553, 28.2635],
  "TRMAM": [36.8553, 28.2635],
  "TRMER": [36.7952, 34.6425],
  "TRMRS": [36.7952, 34.6425],
  "TRMUD": [40.3758, 28.8833],
  "TRMUR": [37.2153, 28.3636],
  "TRORD": [40.9841, 37.8772],
  "TROTS": [41.0200, 37.8773],
  "TRPEN": [40.8760, 29.2305],
  "TRRZE": [41.0201, 40.5234],
  "TRSAM": [41.2867, 36.3300],
  "TRSSX": [41.3106, 36.3394],
  "TRSIN": [42.0269, 35.1553],
  "TRTEK": [40.9781, 27.5107],
  "TRTZX": [41.0028, 39.7364],
  "TRTUZ": [40.8400, 29.2800],
  "TRTRD": [40.9667, 28.6667],
  "TRUNS": [41.1333, 37.2667],
  "TRZNG": [41.4500, 31.7900],
  "TR092": [40.8400, 29.2800],
  "TRADB": [40.7833, 30.4000],
  "TRACN": [37.0622, 35.7689],
  "TRANM": [37.0622, 35.7689],
  "TRALP": [36.5444, 32.0011],
  "TRBAR": [40.3556, 27.9772],
  "TRBUR": [40.1885, 29.0610],
  "TRDAT": [36.7200, 28.1300],
  "TRIKM": [40.7600, 29.9200],
  "TRIKZ": [40.7594, 29.7608],
  "TRIKD": [40.7483, 29.8283],
  "TRMEN": [38.5833, 28.0000],
  "TRROE": [40.9667, 28.6667],
  "TRSAR": [41.2000, 31.4500],
  "TRSIL": [36.3789, 36.2011],
  "TRYAV": [38.3578, 26.2342],
  "TRYAL": [40.6503, 29.2697],
  "TRMRA": [40.6300, 27.5900],
  "TRMRM": [40.6000, 27.5500],
  "TRTAS": [36.3167, 33.9000],
  "TRKRB": [38.6333, 26.5167],
  "TRCKZ": [40.9500, 28.5800],
  "TRGCK": [36.7441, 28.9397],
  "TRTIR": [40.9778, 38.8153],
  "TRAYT": [36.8969, 30.7133],
  "TR01M": [40.9000, 28.8500],
  "TRSUR": [40.9167, 40.1167],
  "TRBXN": [41.0208, 28.5800],
  "TRGUL": [37.2500, 27.6000],
  "TRBDM": [37.0344, 27.4305],
  "TRZON": [41.4500, 31.7900],
  "TRUNY": [41.1333, 37.2667],
  "TRKAS": [36.2014, 29.6406],
  "TREDO": [40.4033, 27.7944],
  "TRRIZ": [41.0201, 40.5234],
  "TRBZC": [39.8333, 26.0500],
  "TRKMR": [40.6908, 29.6208],
  "TRAMA": [41.7506, 32.3827],
  "TRIGN": [41.8833, 28.0167],
  "TRFAS": [41.0333, 37.5000],
  "TRHOP": [41.4117, 41.4147],
  "TRERK": [41.2784, 31.4201],
  "TRSIC": [42.0269, 35.1553],
  "TRKRT": [40.6833, 29.6667],
  "TRFOC": [38.6667, 26.7500],
  "TRBTN": [41.6358, 32.3375],
  "TRINE": [41.9836, 33.7650],
  "TRDIK": [39.0719, 26.8881],
  "TRENE": [40.7167, 26.5333],
  "TRGEL": [40.7167, 26.5333],
  "TR027": [41.8700, 33.0100],
  "TRAYV": [39.3125, 26.6883],
  "TRGCA": [40.2000, 26.1500],
  "TRGOR": [40.9881, 39.2978],
  "TRANA": [36.5444, 31.9952],
  "TR002": [41.6358, 32.3375],
  "TR003": [40.9000, 28.8500],
  "TR039": [41.0082, 28.9784],
};

export async function seedPortCoordinates() {
  const allPorts = await db.select().from(ports);
  let updated = 0;
  for (const port of allPorts) {
    if (port.latitude && port.longitude) continue;
    if (!port.code) continue;
    const prefix = port.code.substring(0, 5).toUpperCase();
    const coords = LOCODE_COORDS[prefix];
    if (coords) {
      await db.update(ports).set({ latitude: coords[0], longitude: coords[1] }).where(eq(ports.id, port.id));
      updated++;
    }
  }
  if (updated > 0) console.log(`[ports] ${updated} liman koordinatı güncellendi.`);
}

export async function seedForumCategories() {
  const [{ value: catCount }] = await db.select({ value: count() }).from(forumCategories);
  if (catCount > 0) return;

  console.log("Seeding forum categories...");
  await db.insert(forumCategories).values([
    { name: "General Discussions", slug: "general", color: "#2563EB", description: "General maritime industry discussions and conversations" },
    { name: "Market & Freight", slug: "market-freight", color: "#D97706", description: "Freight rates, market trends, and commercial discussions" },
    { name: "Port Operations", slug: "port-operations", color: "#16A34A", description: "Port procedures, operations, and berth management" },
    { name: "Regulations & Compliance", slug: "regulations", color: "#DC2626", description: "Maritime laws, regulations, and compliance topics" },
    { name: "Technology & Software", slug: "technology", color: "#0891B2", description: "Maritime software, digital tools, and technology solutions" },
    { name: "Vessel Intelligence", slug: "vessel-intelligence", color: "#7C3AED", description: "Vessel tracking, specifications, and fleet intelligence" },
  ]);
  console.log("Forum categories seeded.");
}
