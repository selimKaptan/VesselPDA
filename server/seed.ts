import { db } from "./db";
import { ports, tariffCategories, tariffRates } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existingPorts = await db.select().from(ports);
  if (existingPorts.length > 0) return;

  console.log("Seeding database with port and tariff data...");

  const tekirdagPort = await db.insert(ports).values({
    name: "Tekirdag",
    country: "Turkey",
    code: "TRTEK",
    currency: "USD",
  }).returning();

  const istanbulPort = await db.insert(ports).values({
    name: "Istanbul",
    country: "Turkey",
    code: "TRIST",
    currency: "USD",
  }).returning();

  const izmirPort = await db.insert(ports).values({
    name: "Izmir",
    country: "Turkey",
    code: "TRIZM",
    currency: "USD",
  }).returning();

  const mersinPort = await db.insert(ports).values({
    name: "Mersin",
    country: "Turkey",
    code: "TRMER",
    currency: "USD",
  }).returning();

  const aliagaPort = await db.insert(ports).values({
    name: "Aliaga",
    country: "Turkey",
    code: "TRALI",
    currency: "USD",
  }).returning();

  for (const port of [tekirdagPort[0], istanbulPort[0], izmirPort[0], mersinPort[0], aliagaPort[0]]) {
    const portMultiplier = port.name === "Istanbul" ? 1.15 : port.name === "Izmir" ? 1.05 : port.name === "Mersin" ? 0.95 : port.name === "Aliaga" ? 1.0 : 1.0;

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

  console.log("Database seeded successfully with 5 Turkish ports and tariff data.");
}
