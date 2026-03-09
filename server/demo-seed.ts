import { db } from "./db";
import { eq } from "drizzle-orm";
import { users } from "../shared/models/auth";
import {
  vessels,
  ports,
  proformas,
  voyages,
  voyageChecklists,
  statementOfFacts,
  sofLineItems,
  fdaAccounts,
  invoices,
  fixtures,
  cargoPositions,
  noticeOfReadiness,
  notifications,
  laytimeSheets,
  daAdvances,
  portExpenses,
  brokerCommissions,
  brokerContacts,
  serviceRequests,
  serviceOffers,
  noonReports,
  ciiRecords,
  euEtsRecords,
} from "../shared/schema";

export async function seedDemoData(userId: string, userRole: string) {
  const summary: Record<string, number> = {
    vessels: 0, proformas: 0, voyages: 0, sofs: 0, sofEvents: 0,
    fdas: 0, invoices: 0, fixtures: 0, cargoPositions: 0, nors: 0,
    notifications: 0, checklists: 0, laytimeSheets: 0, daAdvances: 0,
    portExpenses: 0,
  };

  let portRows: { id: number; name: string }[] = [];
  try {
    portRows = await db.select({ id: ports.id, name: ports.name }).from(ports).limit(5);
    if (portRows.length === 0) throw new Error("No ports found in database");
  } catch (err: any) {
    console.error("[demo-seed] Could not fetch ports:", err?.message);
    return summary;
  }

  while (portRows.length < 5) {
    portRows.push(portRows[portRows.length - 1]);
  }

  const vesselRows: { id: number; name: string }[] = [];

  try {
    const vesselData = [
      { userId, name: "MV AEGEAN STAR", flag: "Malta", vesselType: "bulk_carrier", grt: 28500, nrt: 14200, dwt: 45000, loa: 189.5, imoNumber: "9123456", callSign: "9H-DEMO1", fleetStatus: "active" as const },
      { userId, name: "MV BARBAROS", flag: "Turkey", vesselType: "general_cargo", grt: 12300, nrt: 6100, dwt: 18500, loa: 142.0, imoNumber: "9234567", callSign: "TC-DEMO2", fleetStatus: "active" as const },
      { userId, name: "MV BLACK SEA TRADER", flag: "Greece", vesselType: "bulk_carrier", grt: 35600, nrt: 17800, dwt: 58000, loa: 210.0, imoNumber: "9345678", callSign: "SV-DEMO3", fleetStatus: "idle" as const },
      { userId, name: "MV MEDITERRANEAN GLORY", flag: "Liberia", vesselType: "tanker", grt: 42100, nrt: 21050, dwt: 75000, loa: 228.5, imoNumber: "9456789", callSign: "A8-DEMO4", fleetStatus: "active" as const },
      { userId, name: "MV IZMIR EXPRESS", flag: "Turkey", vesselType: "container", grt: 21800, nrt: 10900, dwt: 31000, loa: 175.0, imoNumber: "9567890", callSign: "TC-DEMO5", fleetStatus: "idle" as const },
    ];

    for (const v of vesselData) {
      const [inserted] = await db.insert(vessels).values(v).returning({ id: vessels.id, name: vessels.name });
      vesselRows.push(inserted);
      summary.vessels++;
    }
  } catch (err: any) {
    console.error("[demo-seed] Vessels failed:", err?.message);
  }

  if (vesselRows.length === 0) {
    console.error("[demo-seed] No vessels created, skipping dependent entities");
    await db.update(users).set({ demoSeeded: true, isDemoAccount: true, emailVerified: true }).where(eq(users.id, userId));
    return summary;
  }

  const proformaRows: { id: number }[] = [];

  try {
    const lineItemSets = [
      [
        { description: "Port Dues (per GRT)", amountUsd: 3420 },
        { description: "Pilotage (Inward + Outward)", amountUsd: 2100 },
        { description: "Towage (2 tugs × 2 moves)", amountUsd: 3200 },
        { description: "Agency Fee", amountUsd: 1800 },
        { description: "Berth Hire (5 days)", amountUsd: 1930 },
      ],
      [
        { description: "Port Dues", amountUsd: 1850 },
        { description: "Pilotage", amountUsd: 1400 },
        { description: "Towage (1 tug)", amountUsd: 1600 },
        { description: "Agency Fee", amountUsd: 1500 },
        { description: "Miscellaneous", amountUsd: 570 },
      ],
      [
        { description: "Port Dues (per GRT)", amountUsd: 4200 },
        { description: "Pilotage (Inward + Outward)", amountUsd: 2600 },
        { description: "Towage (3 tugs × 2 moves)", amountUsd: 4800 },
        { description: "Agency Fee", amountUsd: 2400 },
        { description: "Berth Hire (7 days)", amountUsd: 1800 },
      ],
      [
        { description: "Port Dues", amountUsd: 5500 },
        { description: "Pilotage", amountUsd: 3200 },
        { description: "Towage", amountUsd: 5600 },
        { description: "Agency Fee", amountUsd: 2800 },
        { description: "Customs & Documentation", amountUsd: 5000 },
      ],
      [
        { description: "Port Dues", amountUsd: 2200 },
        { description: "Pilotage", amountUsd: 1600 },
        { description: "Towage", amountUsd: 2400 },
        { description: "Agency Fee", amountUsd: 1800 },
        { description: "Berth Hire", amountUsd: 1800 },
      ],
    ];

    const proformaData = [
      { userId, vesselId: vesselRows[0].id, portId: portRows[0].id, referenceNumber: "PDA-DEMO-001", purposeOfCall: "Loading", cargoType: "Wheat", cargoQuantity: 25000, berthStayDays: 5, lineItems: lineItemSets[0], totalUsd: 12450, status: "approved", approvalStatus: "approved", exchangeRate: 32 },
      { userId, vesselId: vesselRows[1].id, portId: portRows[1].id, referenceNumber: "PDA-DEMO-002", purposeOfCall: "Loading", cargoType: "Iron Ore", cargoQuantity: 18000, berthStayDays: 4, lineItems: lineItemSets[1], totalUsd: 6920, status: "sent", approvalStatus: "pending", exchangeRate: 32 },
      { userId, vesselId: vesselRows[2].id, portId: portRows[2].id, referenceNumber: "PDA-DEMO-003", purposeOfCall: "Discharging", cargoType: "Bulk Cargo", cargoQuantity: 45000, berthStayDays: 7, lineItems: lineItemSets[2], totalUsd: 15800, status: "draft", approvalStatus: "draft", exchangeRate: 32 },
      { userId, vesselId: vesselRows[3].id, portId: portRows[3].id, referenceNumber: "PDA-DEMO-004", purposeOfCall: "Loading", cargoType: "Crude Oil", cargoQuantity: 60000, berthStayDays: 3, lineItems: lineItemSets[3], totalUsd: 22100, status: "completed", approvalStatus: "approved", exchangeRate: 32 },
      { userId, vesselId: vesselRows[4].id, portId: portRows[4].id, referenceNumber: "PDA-DEMO-005", purposeOfCall: "Loading", cargoType: "Containers", cargoQuantity: 200, cargoUnit: "TEU", berthStayDays: 2, lineItems: lineItemSets[4], totalUsd: 9800, status: "draft", approvalStatus: "revision_requested", exchangeRate: 32 },
    ];

    for (const p of proformaData) {
      const [inserted] = await db.insert(proformas).values(p).returning({ id: proformas.id });
      proformaRows.push(inserted);
      summary.proformas++;
    }
  } catch (err: any) {
    console.error("[demo-seed] Proformas failed:", err?.message);
  }

  const voyageRows: { id: number }[] = [];

  try {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
    const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);

    // Historical voyages
    const historicalVoyages = Array.from({ length: 10 }, (_, i) => ({
      userId, 
      vesselId: vesselRows[i % vesselRows.length].id, 
      portId: portRows[i % portRows.length].id,
      vesselName: vesselRows[i % vesselRows.length].name,
      imoNumber: "9123456",
      flag: "Malta",
      vesselType: "bulk_carrier",
      grt: 28500,
      status: "completed",
      purposeOfCall: i % 2 === 0 ? "Loading" : "Discharging",
      eta: daysAgo(40 + i * 30),
      etd: daysAgo(35 + i * 30),
      notes: `Historical voyage ${10-i} completed successfully.`,
    }));
    
    for (const v of historicalVoyages) {
      const [inserted] = await db.insert(voyages).values(v).returning({ id: voyages.id });
      voyageRows.push(inserted);
      summary.voyages++;
    }

    const voyageData = [
      {
        userId, vesselId: vesselRows[0].id, portId: portRows[0].id,
        vesselName: vesselRows[0].name, imoNumber: "9123456", flag: "Malta",
        vesselType: "bulk_carrier", grt: 28500,
        status: "completed", purposeOfCall: "Loading",
        eta: daysAgo(15), etd: daysAgo(10),
        notes: "Wheat cargo — 25,000 MT. Completed successfully.",
      },
      {
        userId, vesselId: vesselRows[1].id, portId: portRows[1].id,
        vesselName: vesselRows[1].name, imoNumber: "9234567", flag: "Turkey",
        vesselType: "general_cargo", grt: 12300,
        status: "in_progress", purposeOfCall: "Loading",
        eta: daysAgo(2), etd: daysFromNow(3),
        notes: "Iron ore loading in progress.",
      },
      {
        userId, vesselId: vesselRows[2].id, portId: portRows[2].id,
        vesselName: vesselRows[2].name, imoNumber: "9345678", flag: "Greece",
        vesselType: "bulk_carrier", grt: 35600,
        status: "planned", purposeOfCall: "Discharging",
        eta: daysFromNow(7), etd: daysFromNow(14),
        notes: "Bulk cargo discharge — awaiting berth allocation.",
      },
      {
        userId, vesselId: vesselRows[3].id, portId: portRows[3].id,
        vesselName: vesselRows[3].name, imoNumber: "9456789", flag: "Liberia",
        vesselType: "tanker", grt: 42100,
        status: "completed", purposeOfCall: "Loading",
        eta: daysAgo(30), etd: daysAgo(27),
        notes: "Crude oil loading completed.",
      },
      {
        userId, vesselId: vesselRows[4].id, portId: portRows[4].id,
        vesselName: vesselRows[4].name, imoNumber: "9567890", flag: "Turkey",
        vesselType: "container", grt: 21800,
        status: "planned", purposeOfCall: "Loading",
        eta: daysFromNow(21), etd: daysFromNow(23),
        notes: "Container voyage — 200 TEU.",
      },
    ];

    for (const v of voyageData) {
      const [inserted] = await db.insert(voyages).values(v).returning({ id: voyages.id });
      voyageRows.push(inserted);
      summary.voyages++;
    }
  } catch (err: any) {
    console.error("[demo-seed] Voyages failed:", err?.message);
  }

  if (voyageRows.length >= 3) {
    try {
      const now = new Date();
      const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000);

      const sofData = [
        {
          voyageId: voyageRows[0].id, vesselId: vesselRows[0].id, portId: portRows[0].id,
          userId, vesselName: vesselRows[0].name, portName: portRows[0].name,
          operation: "Loading", cargoType: "Wheat", cargoQuantity: "25,000 MT",
          masterName: "Capt. A. Hansen", agentName: "Demo Agent",
          status: "finalized", berthName: "Berth No. 3",
        },
        {
          voyageId: voyageRows[1].id, vesselId: vesselRows[1].id, portId: portRows[1].id,
          userId, vesselName: vesselRows[1].name, portName: portRows[1].name,
          operation: "Loading", cargoType: "Iron Ore", cargoQuantity: "18,000 MT",
          masterName: "Capt. M. Yılmaz", agentName: "Demo Agent",
          status: "draft", berthName: "Berth No. 1",
        },
        {
          voyageId: voyageRows[3].id, vesselId: vesselRows[3].id, portId: portRows[3].id,
          userId, vesselName: vesselRows[3].name, portName: portRows[3].name,
          operation: "Loading", cargoType: "Crude Oil", cargoQuantity: "60,000 MT",
          masterName: "Capt. J. Petrov", agentName: "Demo Agent",
          status: "finalized", berthName: "Oil Terminal Berth 2",
        },
      ];

      for (let i = 0; i < sofData.length; i++) {
        const [sof] = await db.insert(statementOfFacts).values(sofData[i]).returning({ id: statementOfFacts.id });
        summary.sofs++;

        const baseTime = i === 1 ? now : new Date(now.getTime() - (15 - i * 12) * 86400000);
        const events = [
          { sofId: sof.id, eventType: "arrival", eventName: "Vessel Arrived at Anchorage", eventDate: new Date(baseTime.getTime() - 48 * 3600000), sortOrder: 1 },
          { sofId: sof.id, eventType: "nor", eventName: "Notice of Readiness Tendered", eventDate: new Date(baseTime.getTime() - 46 * 3600000), sortOrder: 2 },
          { sofId: sof.id, eventType: "nor_accepted", eventName: "Notice of Readiness Accepted", eventDate: new Date(baseTime.getTime() - 44 * 3600000), sortOrder: 3 },
          { sofId: sof.id, eventType: "berthing", eventName: "Vessel Shifted to Berth", eventDate: new Date(baseTime.getTime() - 40 * 3600000), sortOrder: 4 },
          { sofId: sof.id, eventType: "all_fast", eventName: "All Fast — Gangway Down", eventDate: new Date(baseTime.getTime() - 38 * 3600000), sortOrder: 5 },
          { sofId: sof.id, eventType: "cargo_commenced", eventName: "Loading Commenced", eventDate: new Date(baseTime.getTime() - 36 * 3600000), sortOrder: 6 },
          { sofId: sof.id, eventType: "cargo_completed", eventName: "Loading Completed", eventDate: new Date(baseTime.getTime() - 10 * 3600000), sortOrder: 7 },
          { sofId: sof.id, eventType: "departure", eventName: "Vessel Sailed", eventDate: new Date(baseTime.getTime() - 8 * 3600000), sortOrder: 8 },
        ];

        await db.insert(sofLineItems).values(events);
        summary.sofEvents += events.length;
      }
    } catch (err: any) {
      console.error("[demo-seed] SOFs failed:", err?.message);
    }
  }

  if (voyageRows.length >= 4 && proformaRows.length >= 4) {
    try {
      const fdaData = [
        {
          userId, voyageId: voyageRows[0].id, proformaId: proformaRows[0].id,
          vesselId: vesselRows[0].id, portId: portRows[0].id,
          referenceNumber: "FDA-DEMO-001",
          vesselName: vesselRows[0].name, portName: portRows[0].name,
          lineItems: [
            { description: "Port Dues", estimatedUsd: 3420, actualUsd: 3250 },
            { description: "Pilotage", estimatedUsd: 2100, actualUsd: 2100 },
            { description: "Towage", estimatedUsd: 3200, actualUsd: 3400 },
            { description: "Agency Fee", estimatedUsd: 1800, actualUsd: 1800 },
            { description: "Berth Hire", estimatedUsd: 1930, actualUsd: 1340 },
          ],
          totalEstimatedUsd: 12450, totalActualUsd: 11890,
          varianceUsd: -560, variancePercent: -4.5,
          status: "approved",
        },
        {
          userId, voyageId: voyageRows[3].id, proformaId: proformaRows[3].id,
          vesselId: vesselRows[3].id, portId: portRows[3].id,
          referenceNumber: "FDA-DEMO-002",
          vesselName: vesselRows[3].name, portName: portRows[3].name,
          lineItems: [
            { description: "Port Dues", estimatedUsd: 5500, actualUsd: 5800 },
            { description: "Pilotage", estimatedUsd: 3200, actualUsd: 3200 },
            { description: "Towage", estimatedUsd: 5600, actualUsd: 6100 },
            { description: "Agency Fee", estimatedUsd: 2800, actualUsd: 2800 },
            { description: "Customs & Documentation", estimatedUsd: 5000, actualUsd: 5550 },
          ],
          totalEstimatedUsd: 22100, totalActualUsd: 23450,
          varianceUsd: 1350, variancePercent: 6.1,
          status: "draft",
        },
      ];

      await db.insert(fdaAccounts).values(fdaData);
      summary.fdas += fdaData.length;
    } catch (err: any) {
      console.error("[demo-seed] FDAs failed:", err?.message);
    }
  }

  try {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
    const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);

    const invoiceData = [
      // 12 months of historical invoices
      ...Array.from({ length: 24 }, (_, i) => {
        const monthsAgo = Math.floor(i / 2);
        const status = i % 4 === 0 ? "overdue" : i % 3 === 0 ? "pending" : "paid";
        return {
          createdByUserId: userId,
          title: `Historical Invoice ${24-i}`,
          amount: 2500 + Math.random() * 5000,
          currency: "USD",
          dueDate: daysAgo(monthsAgo * 30 + 5),
          paidAt: status === "paid" ? daysAgo(monthsAgo * 30 + 2) : null,
          status,
          invoiceType: "invoice",
          recipientName: i % 2 === 0 ? "Demo Shipowner Ltd." : "Mediterranean Oil Corp.",
        };
      }),
      {
        createdByUserId: userId,
        voyageId: voyageRows[0]?.id, proformaId: proformaRows[0]?.id,
        title: "Invoice — PDA-DEMO-001 Final Settlement",
        amount: 11890, currency: "USD",
        dueDate: daysAgo(5), paidAt: daysAgo(3),
        status: "paid", invoiceType: "invoice",
        recipientName: "Demo Shipowner Ltd.",
      },
      {
        createdByUserId: userId,
        voyageId: voyageRows[1]?.id, proformaId: proformaRows[1]?.id,
        title: "Invoice — PDA-DEMO-002 Agency Services",
        amount: 6920, currency: "USD",
        dueDate: daysFromNow(10),
        status: "pending", invoiceType: "invoice",
        recipientName: "Demo Shipping Co.",
      },
      {
        createdByUserId: userId,
        voyageId: voyageRows[3]?.id, proformaId: proformaRows[3]?.id,
        title: "Invoice — PDA-DEMO-004 Tanker Operations",
        amount: 23450, currency: "USD",
        dueDate: daysAgo(15), paidAt: daysAgo(12),
        status: "paid", invoiceType: "invoice",
        recipientName: "Mediterranean Oil Corp.",
      },
      {
        createdByUserId: userId,
        title: "Invoice — Port Disbursement Advance",
        amount: 5000, currency: "USD",
        dueDate: daysAgo(30),
        status: "overdue", invoiceType: "invoice",
        recipientName: "Demo Client",
        notes: "Follow-up required — overdue 30 days.",
      },
      {
        createdByUserId: userId,
        voyageId: voyageRows[2]?.id,
        title: "Invoice — PDA-DEMO-003 Pre-Arrival Estimate",
        amount: 15800, currency: "USD",
        dueDate: daysFromNow(30),
        status: "pending", invoiceType: "proforma_invoice",
        recipientName: "Black Sea Shipping Ltd.",
      },
    ];

    await db.insert(invoices).values(invoiceData);
    summary.invoices += invoiceData.length;
  } catch (err: any) {
    console.error("[demo-seed] Invoices failed:", err?.message);
  }

  try {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
    const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);

    const fixtureData = [
      {
        userId, status: "completed",
        vesselName: vesselRows[0].name, imoNumber: "9123456",
        cargoType: "Wheat", cargoQuantity: 25000, quantityUnit: "MT",
        loadingPort: portRows[0].name, dischargePort: portRows[2].name,
        laycanFrom: daysAgo(20), laycanTo: daysAgo(15),
        freightRate: 18.50, freightCurrency: "USD",
        charterer: "Mediterranean Grain Trading Co.", shipowner: "Demo Shipowner Ltd.",
        brokerCommission: 1.25,
        notes: "Fixture completed successfully. Demurrage: NIL.",
      },
      {
        userId, status: "active",
        vesselName: vesselRows[2].name, imoNumber: "9345678",
        cargoType: "Iron Ore", cargoQuantity: 45000, quantityUnit: "MT",
        loadingPort: portRows[2].name, dischargePort: portRows[4].name,
        laycanFrom: daysFromNow(5), laycanTo: daysFromNow(10),
        freightRate: 12.00, freightCurrency: "USD",
        charterer: "Black Sea Steel Corp.", shipowner: "Hellas Shipping SA",
        brokerCommission: 1.00,
        notes: "Laytime terms: SHEX. Demurrage: $5,000/day.",
      },
      {
        userId, status: "negotiating",
        vesselName: vesselRows[4].name, imoNumber: "9567890",
        cargoType: "General Cargo / Containers", cargoQuantity: 200, quantityUnit: "TEU",
        loadingPort: portRows[4].name, dischargePort: portRows[1].name,
        laycanFrom: daysFromNow(18), laycanTo: daysFromNow(25),
        freightRate: 450, freightCurrency: "USD",
        charterer: "Aegean Container Lines",
        brokerCommission: 2.50,
        notes: "Under negotiation — awaiting fixture confirmation.",
      },
    ];

    await db.insert(fixtures).values(fixtureData);
    summary.fixtures += fixtureData.length;
  } catch (err: any) {
    console.error("[demo-seed] Fixtures failed:", err?.message);
  }

  try {
    const now = new Date();
    const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);

    const cargoData = [
      {
        userId, positionType: "cargo", title: "25,000 MT Wheat — Turkish Straits",
        description: "Clean / Fair Average quality wheat. 2024 crop. Inspected & certified.",
        cargoType: "Wheat", quantity: 25000, quantityUnit: "MT",
        loadingPort: portRows[0].name, dischargePort: portRows[2].name,
        laycanFrom: daysFromNow(10), laycanTo: daysFromNow(20),
        contactName: "Demo Charterer", contactEmail: "charter@demo.com",
        expiresAt: daysFromNow(30),
      },
      {
        userId, positionType: "cargo", title: "Steel Coils — Black Sea Origin",
        description: "Steel coils, various grades. Conventional or bulk vessel.",
        cargoType: "Steel Coils", quantity: 12000, quantityUnit: "MT",
        loadingPort: portRows[3].name, dischargePort: portRows[1].name,
        laycanFrom: daysFromNow(15), laycanTo: daysFromNow(25),
        contactName: "Demo Steel Corp", contactEmail: "freight@demo.com",
        expiresAt: daysFromNow(45),
      },
      {
        userId, positionType: "vessel", title: "Bulk Carrier 45,000 DWT — Open Gemlik",
        description: "Open for cargo after discharging. Good condition, all gears.",
        vesselType: "bulk_carrier",
        loadingPort: portRows[1].name, dischargePort: "Worldwide",
        laycanFrom: daysFromNow(5), laycanTo: daysFromNow(15),
        contactName: "Operations Desk",
        expiresAt: daysFromNow(20),
      },
      {
        userId, positionType: "vessel", title: "General Cargo Vessel — Open Mediterranean",
        description: "Multi-purpose vessel. 18,500 DWT. Open for fixtures.",
        vesselType: "general_cargo",
        loadingPort: "Mediterranean",dischargePort: "Worldwide",
        laycanFrom: daysFromNow(8), laycanTo: daysFromNow(18),
        contactName: "Commercial Dept.",
        expiresAt: daysFromNow(25),
      },
    ];

    await db.insert(cargoPositions).values(cargoData);
    summary.cargoPositions += cargoData.length;
  } catch (err: any) {
    console.error("[demo-seed] Cargo positions failed:", err?.message);
  }

  if (voyageRows.length >= 4) {
    try {
      const now = new Date();
      const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000);
      const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

      const norData = [
        {
          userId, voyageId: voyageRows[0].id, vesselId: vesselRows[0].id, portId: portRows[0].id,
          vesselName: vesselRows[0].name, portName: portRows[0].name,
          masterName: "Capt. A. Hansen", agentName: "Demo Maritime Agency",
          chartererName: "Mediterranean Grain Trading Co.",
          cargoType: "Wheat", cargoQuantity: "25,000 MT", operation: "Loading",
          anchorageArrival: daysAgo(17),
          norTenderedAt: daysAgo(17),
          norTenderedTo: "Mediterranean Grain Trading Co.",
          norAcceptedAt: daysAgo(16),
          norAcceptedBy: "Charterer's Representative",
          berthArrival: daysAgo(16),
          laytimeStartsAt: daysAgo(16),
          berthName: "Berth No. 3",
          status: "accepted",
          readyTo: ["load"],
          conditions: ["free_pratique", "customs_cleared"],
        },
        {
          userId, voyageId: voyageRows[3].id, vesselId: vesselRows[3].id, portId: portRows[3].id,
          vesselName: vesselRows[3].name, portName: portRows[3].name,
          masterName: "Capt. J. Petrov", agentName: "Demo Maritime Agency",
          chartererName: "Mediterranean Oil Corp.",
          cargoType: "Crude Oil", cargoQuantity: "60,000 MT", operation: "Loading",
          anchorageArrival: daysAgo(32),
          norTenderedAt: daysAgo(32),
          norAcceptedAt: daysAgo(31),
          berthArrival: daysAgo(31),
          laytimeStartsAt: daysAgo(31),
          berthName: "Oil Terminal Berth 2",
          status: "accepted",
          readyTo: ["load"],
          conditions: ["free_pratique", "customs_cleared", "isg_compliant"],
        },
      ];

      await db.insert(noticeOfReadiness).values(norData);
      summary.nors += norData.length;
    } catch (err: any) {
      console.error("[demo-seed] NORs failed:", err?.message);
    }
  }

  try {
    const notifData = [
      {
        userId, type: "pda_approved",
        title: "Proforma Approved",
        message: "Your proforma PDA-DEMO-001 for MV AEGEAN STAR has been approved by the shipowner.",
        link: "/proformas",
      },
      {
        userId, type: "voyage_update",
        title: "Voyage Status Updated",
        message: "Voyage for MV BARBAROS is now In Progress. Vessel berthed and loading commenced.",
        link: "/voyages",
      },
      {
        userId, type: "invoice_overdue",
        title: "Invoice Overdue",
        message: "Invoice for Port Disbursement Advance is 30 days overdue. Please follow up with the client.",
        link: "/invoices",
      },
      {
        userId, type: "bid_received",
        title: "New Tender Bid Received",
        message: "A new bid has been submitted for your port tender. Review and compare offers.",
        link: "/tenders",
      },
      {
        userId, type: "system",
        title: "Welcome to VesselPDA Demo!",
        message: "Your demo account has been set up with sample data. Explore vessels, proformas, voyages, and more to see the full platform in action.",
        link: "/dashboard",
      },
    ];

    await db.insert(notifications).values(notifData);
    summary.notifications += notifData.length;
  } catch (err: any) {
    console.error("[demo-seed] Notifications failed:", err?.message);
  }

  if (voyageRows.length >= 2) {
    try {
      const checklistItems = [
        { voyageId: voyageRows[0].id, title: "Verify all vessel documents (valid certificates)", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[0].id, title: "Confirm berth availability with port authority", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[0].id, title: "Pre-arrival notification sent to port", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[0].id, title: "Agency appointment confirmed", isCompleted: true, assignedTo: "both" as const },
        { voyageId: voyageRows[0].id, title: "Customs clearance arranged", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[0].id, title: "Port health clearance obtained", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[0].id, title: "Cargo manifests submitted to customs", isCompleted: true, assignedTo: "both" as const },
        { voyageId: voyageRows[0].id, title: "Post-voyage report prepared and filed", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[1].id, title: "Pre-arrival notification sent to port", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[1].id, title: "NOR tendered upon arrival", isCompleted: true, assignedTo: "agent" as const },
        { voyageId: voyageRows[1].id, title: "Cargo documents verified", isCompleted: false, assignedTo: "both" as const },
        { voyageId: voyageRows[1].id, title: "Loading supervisor on standby", isCompleted: false, assignedTo: "shipowner" as const },
      ];

      await db.insert(voyageChecklists).values(checklistItems);
      summary.checklists += checklistItems.length;
    } catch (err: any) {
      console.error("[demo-seed] Checklists failed:", err?.message);
    }
  }

  // ─── NEW: LAYTIME SHEETS ──────────────────────────────────────────────────
  if (voyageRows.length >= 2) {
    try {
      const laytimeData = [
        {
          userId,
          voyageId: voyageRows[0].id,
          title: "Laytime - Wheat Cargo",
          vesselName: vesselRows[0].name,
          portName: portRows[0].name,
          terms: {
            laytimeAllowed: "3 days 12 hours",
            laytimeType: "SHINC",
            demurrageRate: 15000,
            despatchRate: 7500,
          },
          events: [
            { date: new Date(Date.now() - 15 * 86400000).toISOString(), event: "NOR Tendered", duration: "0", remarks: "" },
            { date: new Date(Date.now() - 14 * 86400000).toISOString(), event: "Commenced Loading", duration: "24h", remarks: "All holds" },
            { date: new Date(Date.now() - 13 * 86400000).toISOString(), event: "Loading", duration: "24h", remarks: "" },
            { date: new Date(Date.now() - 12 * 86400000).toISOString(), event: "Completed Loading", duration: "12h", remarks: "" },
          ],
          result: {
            allowed: 84, // hours
            used: 60,
            balance: 24,
            status: "despatch",
            amount: 7500,
          },
        },
        {
          userId,
          voyageId: voyageRows[1].id,
          title: "Laytime - Iron Ore",
          vesselName: vesselRows[1].name,
          portName: portRows[1].name,
          terms: {
            laytimeAllowed: "2 days",
            laytimeType: "SHEX",
            demurrageRate: 12000,
            despatchRate: 6000,
          },
          events: [
            { date: new Date(Date.now() - 3 * 86400000).toISOString(), event: "NOR Tendered", duration: "0", remarks: "" },
            { date: new Date(Date.now() - 2 * 86400000).toISOString(), event: "Commenced Loading", duration: "24h", remarks: "" },
            { date: new Date(Date.now() - 1 * 86400000).toISOString(), event: "Loading", duration: "24h", remarks: "Rain delay 4h" },
            { date: new Date().toISOString(), event: "Still Loading", duration: "12h", remarks: "" },
          ],
          result: {
            allowed: 48,
            used: 60,
            balance: -12,
            status: "demurrage",
            amount: 6000,
          },
        }
      ];
      await db.insert(laytimeSheets).values(laytimeData);
      summary.laytimeSheets += laytimeData.length;
    } catch (err: any) {
      console.error("[demo-seed] LaytimeSheets failed:", err?.message);
    }
  }

  // ─── NEW: DA ADVANCES ─────────────────────────────────────────────────────
  if (voyageRows.length >= 2 && proformaRows.length >= 2) {
    try {
      const daAdvanceData = [
        {
          userId,
          voyageId: voyageRows[0].id,
          proformaId: proformaRows[0].id,
          title: "Initial Advance Request",
          requestedAmount: 12450,
          receivedAmount: 12450,
          currency: "USD",
          status: "fully_received",
          dueDate: new Date(Date.now() - 10 * 86400000),
          principalName: "Demo Shipowner Ltd.",
          bankDetails: "Standard Demo Bank - Swift: DEMO123",
          notes: "Received in full on time.",
        },
        {
          userId,
          voyageId: voyageRows[1].id,
          proformaId: proformaRows[1].id,
          title: "Emergency Funds - Port Dues",
          requestedAmount: 5000,
          receivedAmount: 2500,
          currency: "USD",
          status: "partially_received",
          dueDate: new Date(Date.now() + 2 * 86400000),
          principalName: "Demo Shipping Co.",
          bankDetails: "Standard Demo Bank - Swift: DEMO123",
          notes: "Partial payment received, awaiting balance.",
        }
      ];
      await db.insert(daAdvances).values(daAdvanceData);
      summary.daAdvances += daAdvanceData.length;
    } catch (err: any) {
      console.error("[demo-seed] DAAdvances failed:", err?.message);
    }
  }

  // ─── NEW: PORT EXPENSES ───────────────────────────────────────────────────
  if (voyageRows.length >= 2) {
    try {
      const expenseCategories = ["port_dues", "pilotage", "towage", "agency_fee", "mooring", "anchorage", "launch_hire", "garbage", "fresh_water", "bunker", "survey", "customs", "other"];
      const portExpenseData = [];
      
      // Voyage 0 expenses
      for (let i = 0; i < 6; i++) {
        portExpenseData.push({
          userId,
          voyageId: voyageRows[0].id,
          category: expenseCategories[i % expenseCategories.length],
          description: `Expense for ${expenseCategories[i % expenseCategories.length]}`,
          amount: 500 + Math.random() * 1500,
          currency: "USD",
          amountUsd: 500 + Math.random() * 1500,
          vendor: "Port Services Co.",
          expenseDate: new Date(Date.now() - (12 + i) * 86400000),
          isPaid: true,
          receiptNumber: `RCPT-00${i}`,
        });
      }

      // Voyage 1 expenses
      for (let i = 0; i < 4; i++) {
        portExpenseData.push({
          userId,
          voyageId: voyageRows[1].id,
          category: expenseCategories[(i + 5) % expenseCategories.length],
          description: `Active expense ${i}`,
          amount: 300 + Math.random() * 800,
          currency: "USD",
          amountUsd: 300 + Math.random() * 800,
          vendor: "Local Agency Ltd.",
          expenseDate: new Date(Date.now() - i * 86400000),
          isPaid: i % 2 === 0,
          receiptNumber: i % 2 === 0 ? `RCPT-B-00${i}` : null,
        });
      }

      await db.insert(portExpenses).values(portExpenseData);
      summary.portExpenses += portExpenseData.length;
    } catch (err: any) {
      console.error("[demo-seed] PortExpenses failed:", err?.message);
    }
  }

  // ─── NEW: BROKER SEED ──────────────────────────────────────────────────
  try {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    const contactsData = [
      { userId, contactType: "shipowner", companyName: "Aegean Shipping SA", contactName: "George P.", email: "ops@aegean.gr", pastDealCount: 12, rating: 5, tags: "reliable,fast" },
      { userId, contactType: "charterer", companyName: "Global Grain Ltd", contactName: "Sarah M.", email: "chartering@globalgrain.com", pastDealCount: 8, rating: 4, tags: "bulk,large-volume" },
      { userId, contactType: "broker", companyName: "Maritime Links", contactName: "Selim Y.", email: "selim@mlinks.com", pastDealCount: 5, rating: 5, tags: "straits-expert" },
      { userId, contactType: "operator", companyName: "Black Sea Ops", contactName: "Ivan D.", email: "ops@blacksea.com", pastDealCount: 3, rating: 3, tags: "regional" },
      { userId, contactType: "shipowner", companyName: "Hellas Bulkers", contactName: "Nikos K.", email: "chartering@hellas.gr", pastDealCount: 15, rating: 5, tags: "capesize" },
    ];
    await db.insert(brokerContacts).values(contactsData);

    const commsData = [
      { userId, counterparty: "Aegean Shipping SA", grossCommission: 1250, netCommission: 1250, commissionRate: 1.25, currency: "USD", status: "paid", fixtureDate: daysAgo(45) },
      { userId, counterparty: "Global Grain Ltd", grossCommission: 800, netCommission: 800, commissionRate: 1.0, currency: "USD", status: "pending", fixtureDate: daysAgo(10) },
      { userId, counterparty: "Maritime Links", grossCommission: 2100, netCommission: 2100, commissionRate: 2.5, currency: "USD", status: "overdue", fixtureDate: daysAgo(65) },
    ];
    await db.insert(brokerCommissions).values(commsData);
  } catch (err: any) {
    console.error("[demo-seed] Broker seed failed:", err?.message);
  }

  // ─── NEW: PROVIDER SEED ──────────────────────────────────────────────────
  try {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    const srData = [
      { requesterId: userId, portId: portRows[0].id, vesselName: "MV AEGEAN STAR", serviceType: "provision", description: "Fresh water and provisions for 20 crew.", status: "completed", createdAt: daysAgo(15) },
      { requesterId: userId, portId: portRows[1].id, vesselName: "MV BARBAROS", serviceType: "bunker", description: "500 MT VLSFO", status: "open", createdAt: daysAgo(2) },
      { requesterId: userId, portId: portRows[2].id, vesselName: "MV BLACK SEA TRADER", serviceType: "repair", description: "Engine room pump maintenance", status: "pending", createdAt: daysAgo(5) },
    ];
    for (const sr of srData) {
      const [inserted] = await db.insert(serviceRequests).values(sr as any).returning({ id: serviceRequests.id });
      await db.insert(serviceOffers).values({
        serviceRequestId: inserted.id,
        providerUserId: userId,
        price: 1500 + Math.random() * 2000,
        currency: "USD",
        notes: "Best price guaranteed.",
        status: sr.status === "completed" ? "selected" : "pending"
      });
    }
  } catch (err: any) {
    console.error("[demo-seed] Provider seed failed:", err?.message);
  }

  // ─── NEW: MASTER SEED (NOON REPORTS) ───────────────────────────────────
  try {
    if (vesselRows.length > 0) {
      const noonData = [
        {
          userId,
          vesselId: vesselRows[0].id,
          reportDate: new Date(Date.now() - 86400000),
          latitude: 35.12,
          longitude: 24.45,
          speedOverGround: 14.5,
          distanceLastNoon: 348,
          distanceToGo: 1250,
          windForce: 4,
          seaState: 3,
          hfoRob: 450.5,
          mgoRob: 85.2,
        },
        {
          userId,
          vesselId: vesselRows[0].id,
          reportDate: new Date(Date.now() - 2 * 86400000),
          latitude: 34.55,
          longitude: 28.10,
          speedOverGround: 14.2,
          distanceLastNoon: 340,
          distanceToGo: 1598,
          windForce: 3,
          seaState: 2,
          hfoRob: 475.2,
          mgoRob: 88.5,
        }
      ];
      await db.insert(noonReports).values(noonData);
    }
  } catch (err: any) {
    console.error("[demo-seed] Noon reports failed:", err?.message);
  }

  // ─── NEW: ENVIRONMENTAL SEED (CII / EU ETS) ─────────────────────────────
  try {
    if (vesselRows.length > 0) {
      await db.insert(ciiRecords).values({
        vesselId: vesselRows[0].id,
        reportingYear: 2023,
        ciiAttained: 4.85,
        ciiRequired: 5.12,
        ciiRating: "B",
        totalCo2Mt: 12500.5,
        distanceNm: 45000,
        status: "finalized"
      });

      await db.insert(euEtsRecords).values({
        vesselId: vesselRows[0].id,
        co2Emissions: 8500.2,
        etsLiableCo2: 3400.08,
        status: "reported"
      });
    }
  } catch (err: any) {
    console.error("[demo-seed] Environmental seed failed:", err?.message);
  }

  try {
    await db.update(users)
      .set({ demoSeeded: true, isDemoAccount: true, emailVerified: true })
      .where(eq(users.id, userId));
  } catch (err: any) {
    console.error("[demo-seed] User update failed:", err?.message);
  }

  console.log(`[demo-seed] Completed for user ${userId}:`, summary);
  return summary;
}
