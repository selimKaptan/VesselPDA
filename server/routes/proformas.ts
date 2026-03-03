import { calculateProforma, type CalculationInput } from "../proforma-calculator";
import { lookupPilotageFee, lookupTugboatFee, lookupMooringFee, lookupBerthingFee, lookupAgencyFee, lookupMarpolFee, lookupLcbFee, lookupSanitaryDuesFee, lookupChamberFreightShareFee, lookupChamberShippingFee, lookupLightDuesFee, lookupMiscExpenses, lookupSupervisionFee, type VesselCategory } from "../tariff-lookup";
import { sendProformaEmail } from "../email";
import { getOrFetchRates } from "../exchange-rates";
import type { ProformaLineItem } from "@shared/schema";
import { parsePaginationParams, paginateArray } from "../utils/pagination";
import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

router.get("/proformas", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { page, limit } = parsePaginationParams(req.query);
    const search = (req.query.search as string || "").toLowerCase();
    const status = req.query.status as string | undefined;
    let proformas = await isAdmin(req)
      ? await storage.getAllProformas()
      : await storage.getProformasByUser(userId);
    if (search) {
      proformas = proformas.filter((p: any) =>
        p.portName?.toLowerCase().includes(search) ||
        p.vesselName?.toLowerCase().includes(search) ||
        p.purpose?.toLowerCase().includes(search)
      );
    }
    if (status && status !== "all") {
      proformas = proformas.filter((p: any) => p.status === status);
    }
    res.json(paginateArray(proformas, page, limit));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch proformas" });
  }
});

router.get("/proformas/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    if (await isAdmin(req)) {
      const proforma = await storage.getProformaById(id);
      if (!proforma) return res.status(404).json({ message: "Proforma not found" });
      return res.json(proforma);
    }
    const proforma = await storage.getProforma(id, userId);
    if (!proforma) return res.status(404).json({ message: "Proforma not found" });
    res.json(proforma);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch proforma" });
  }
});

router.post("/proformas/calculate", isAuthenticated, async (req: any, res) => {
  try {
    const {
      vesselId, portId, berthStayDays = 5, cargoQuantity,
      anchorageDays = 0, isDangerousCargo = false,
      customsType = "import", flagCategory = "turkish",
      dtoCategory = "turkish", lighthouseCategory = "turkish",
      vtsCategory = "turkish", wharfageCategory = "foreign",
      usdTryRate = 43.86, eurTryRate = 51.73,
      cargoType: cargoTypeRaw = "",
    } = req.body;
    const userId = req.user.claims.sub;

    if (!vesselId || !portId) {
      return res.status(400).json({ message: "vesselId and portId are required" });
    }

    const vessel = await storage.getVessel(Number(vesselId), userId);
    if (!vessel) return res.status(404).json({ message: "Vessel not found" });

    const port = await storage.getPort(Number(portId));
    if (!port) return res.status(404).json({ message: "Port not found" });

    const usdRate = Number(usdTryRate) || 43.86;
    const eurRate = Number(eurTryRate) || 51.73;
    const eurUsdParity = eurRate / usdRate;

    const berthDaysNum = Number(berthStayDays) || 5;
    const dangerous = isDangerousCargo === true || isDangerousCargo === "true";
    const portIdNum = Number(portId);
    const nrt = vessel.nrt || 1000;
    const grt = vessel.grt || 2000;
    const cargoQtyNum = cargoQuantity ? Number(cargoQuantity) : 0;

    const flagCat = (flagCategory || "turkish") as "turkish" | "foreign" | "cabotage";
    let vesselCat: VesselCategory;
    if (flagCat === "foreign") vesselCat = "foreign_intl";
    else if (flagCat === "cabotage") vesselCat = "turkish_cabotage";
    else vesselCat = "turkish_intl";

    const [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, chamberShipping, lightDues, misc, supervision] = await Promise.all([
      lookupPilotageFee(pool, portIdNum, grt, vesselCat, dangerous),
      lookupTugboatFee(pool, portIdNum, grt, vesselCat, dangerous),
      lookupMooringFee(pool, portIdNum, grt, dangerous),
      lookupBerthingFee(pool, portIdNum, grt, vesselCat, berthDaysNum),
      lookupAgencyFee(pool, portIdNum, nrt, eurUsdParity),
      lookupMarpolFee(pool, portIdNum, grt, eurUsdParity),
      lookupLcbFee(pool, portIdNum, nrt, usdRate),
      lookupSanitaryDuesFee(pool, portIdNum, nrt, usdRate),
      lookupChamberFreightShareFee(pool, portIdNum, cargoQtyNum, vesselCat),
      lookupChamberShippingFee(pool, portIdNum, grt, vesselCat, usdRate),
      lookupLightDuesFee(pool, portIdNum, nrt, vesselCat),
      lookupMiscExpenses(pool, portIdNum),
      lookupSupervisionFee(pool, portIdNum, cargoTypeRaw || "", cargoQtyNum, vesselCat, eurUsdParity),
    ]);

    const calcInput: CalculationInput = {
      nrt,
      grt,
      cargoQuantity: cargoQtyNum,
      cargoType: cargoTypeRaw || undefined,
      berthStayDays: berthDaysNum,
      anchorageDays: Number(anchorageDays) || 0,
      isDangerousCargo: dangerous,
      customsType: customsType || "import",
      flagCategory: flagCat,
      dtoCategory: dtoCategory || "turkish",
      lighthouseCategory: lighthouseCategory || "turkish",
      vtsCategory: vtsCategory || "turkish",
      wharfageCategory: wharfageCategory || "foreign",
      usdTryRate: usdRate,
      eurTryRate: eurRate,
      eurUsdParity,
      dbPilotageFee: pilotage.fee || undefined,
      dbTugboatFee: tugboat.fee || undefined,
      dbMooringFee: mooring.fee || undefined,
      dbBerthingFee: berthing.fee || undefined,
      dbAgencyFee: agency.fee || undefined,
      dbMarpolFee: marpol.fee || undefined,
      dbLcbFee: lcb.fee || undefined,
      dbSanitaryFee: sanitaryDues.fee || undefined,
      dbChamberFreightShareFee: chamberFreightShare.fee || undefined,
      dbLightDuesFee: lightDues.fee || undefined,
      dbMotorboatFee: misc['motorboat'],
      dbFacilitiesFee: misc['facilities'],
      dbTransportationFee: misc['transportation'],
      dbFiscalFee: misc['fiscal'],
      dbCommunicationFee: misc['communication'],
      dbVtsFee: misc['vts'],
      dbCustomsFee: misc['customs'],
      dbChamberDtoFee: chamberShipping.fee || misc['chamber_dto'],
      dbAnchoragePerDay: misc['anchorage'],
      dbSupervisionFee: supervision.fee,
    };

    const result = calculateProforma(calcInput);
    const dbSources = [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, lightDues, supervision];
    const tariffSource = dbSources.some(r => r.source === "database") ? "database" : "estimate";

    res.json({
      lineItems: result.lineItems,
      totalUsd: result.totalUsd,
      totalEur: result.totalEur,
      eurUsdParity: Math.round(eurUsdParity * 1000000) / 1000000,
      tariffSource,
    });
  } catch (error) {
    console.error("Calculate error:", error);
    res.status(500).json({ message: "Failed to calculate expenses" });
  }
});

router.post("/proformas/quick-estimate", isAuthenticated, async (req: any, res) => {
  try {
    const {
      vesselId, portId,
      berthStayDays = 3, anchorageDays = 0,
      cargoQuantity = 5000, isDangerousCargo = false,
      purposeOfCall = "Discharging",
      cargoType = "",
      voyageType = "international",
      externalGrt, externalNrt, externalFlag, externalVesselName,
    } = req.body;

    const customsType: "import" | "export" | "transit" | "none" = (() => {
      const p = (purposeOfCall || "").toLowerCase();
      if (p.includes("load")) return "export";
      if (p.includes("discharg") || p.includes("unload")) return "import";
      if (p.includes("transit")) return "transit";
      if (p.includes("bunker") || p.includes("repair") || p.includes("survey")) return "none";
      return "import";
    })();

    const isExternalVessel = !vesselId && externalGrt;

    if (!isExternalVessel && !vesselId) {
      return res.status(400).json({ message: "vesselId (or external vessel data) and portId are required" });
    }
    if (!portId) {
      return res.status(400).json({ message: "portId is required" });
    }

    const userId = req.user?.claims?.sub || req.user?.id;

    let vessel: any;
    if (isExternalVessel) {
      vessel = {
        name: externalVesselName || "Unknown Vessel",
        flag: externalFlag || "Unknown",
        grt: Number(externalGrt) || 2000,
        nrt: Number(externalNrt) || 1000,
      };
    } else {
      vessel = await storage.getVessel(Number(vesselId), userId);
      if (!vessel) {
        const allVessels = await storage.getAllVessels();
        vessel = (allVessels as any[]).find((v: any) => v.id === Number(vesselId)) || null;
      }
      if (!vessel) return res.status(404).json({ message: "Vessel not found" });
    }

    const port = await storage.getPort(Number(portId));
    if (!port) return res.status(404).json({ message: "Port not found" });

    const cachedRates = await getOrFetchRates();
    let usdTryRate = cachedRates.usdTry;
    let eurTryRate = cachedRates.eurTry;

    const eurUsdParity = cachedRates.eurUsd;

    const isTurkishFlag = (flag: string) => {
      const f = (flag || "").toLowerCase().trim();
      return ["turkey", "turkish", "türk", "türkiye", "tr", "turk"].includes(f);
    };
    const turkish = isTurkishFlag(vessel.flag || "");
    const isCabotage = voyageType === "cabotage" && turkish;

    let vesselCat: VesselCategory;
    if (!turkish) vesselCat = "foreign_intl";
    else if (isCabotage) vesselCat = "turkish_cabotage";
    else vesselCat = "turkish_intl";

    const flagCat = turkish ? (isCabotage ? "cabotage" : "turkish") : "foreign" as "turkish" | "foreign" | "cabotage";

    const nrt = (vessel as any).nrt || 1000;
    const grt = (vessel as any).grt || 2000;
    const berthDays = Number(berthStayDays) || 3;
    const dangerous = isDangerousCargo === true || isDangerousCargo === "true";
    const portIdNum = Number(portId);

    const cargoQtyQuick = Number(cargoQuantity) || 5000;
    const [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, chamberShippingQuick, lightDues, misc, supervision] = await Promise.all([
      lookupPilotageFee(pool, portIdNum, grt, vesselCat, dangerous),
      lookupTugboatFee(pool, portIdNum, grt, vesselCat, dangerous),
      lookupMooringFee(pool, portIdNum, grt, dangerous),
      lookupBerthingFee(pool, portIdNum, grt, vesselCat, berthDays),
      lookupAgencyFee(pool, portIdNum, nrt, eurUsdParity),
      lookupMarpolFee(pool, portIdNum, grt, eurUsdParity),
      lookupLcbFee(pool, portIdNum, nrt, usdTryRate),
      lookupSanitaryDuesFee(pool, portIdNum, nrt, usdTryRate),
      lookupChamberFreightShareFee(pool, portIdNum, cargoQtyQuick, vesselCat),
      lookupChamberShippingFee(pool, portIdNum, grt, vesselCat, usdTryRate),
      lookupLightDuesFee(pool, portIdNum, nrt, vesselCat),
      lookupMiscExpenses(pool, portIdNum),
      lookupSupervisionFee(pool, portIdNum, cargoType || "", cargoQtyQuick, vesselCat, eurUsdParity),
    ]);

    const dbSources = [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, chamberShippingQuick, lightDues, supervision];
    const anyFromDb = dbSources.some(r => r.source === "database");
    const tariffSource = anyFromDb ? "database" : "estimate";

    const PORT_TARIFF_NAMES: Record<number, string> = {
      1: "Tekirdağ",
      2: "İstanbul",
      3: "İzmir",
    };
    const portTariffName = anyFromDb ? (PORT_TARIFF_NAMES[portIdNum] || port.name) : null;

    const calcInput: CalculationInput = {
      nrt,
      grt,
      cargoQuantity: cargoQtyQuick,
      cargoType: cargoType || "",
      berthStayDays: berthDays,
      anchorageDays: Number(anchorageDays) || 0,
      isDangerousCargo: dangerous,
      customsType,
      flagCategory: flagCat as "turkish" | "foreign" | "cabotage",
      dtoCategory: turkish ? "turkish" : "foreign",
      lighthouseCategory: flagCat as "turkish" | "foreign" | "cabotage",
      vtsCategory: flagCat as "turkish" | "foreign" | "cabotage",
      wharfageCategory: turkish ? (isCabotage ? "cabotage" : "turkish") : "foreign",
      usdTryRate,
      eurTryRate,
      eurUsdParity,
      dbPilotageFee: pilotage.fee || undefined,
      dbTugboatFee: tugboat.fee || undefined,
      dbMooringFee: mooring.fee || undefined,
      dbBerthingFee: berthing.fee || undefined,
      dbAgencyFee: agency.fee || undefined,
      dbMarpolFee: marpol.fee || undefined,
      dbLcbFee: lcb.fee || undefined,
      dbSanitaryFee: sanitaryDues.fee || undefined,
      dbChamberFreightShareFee: chamberFreightShare.fee || undefined,
      dbLightDuesFee: lightDues.fee || undefined,
      dbMotorboatFee: misc['motorboat'],
      dbFacilitiesFee: misc['facilities'],
      dbTransportationFee: misc['transportation'],
      dbFiscalFee: misc['fiscal'],
      dbCommunicationFee: misc['communication'],
      dbVtsFee: misc['vts'],
      dbCustomsFee: misc['customs'],
      dbChamberDtoFee: chamberShippingQuick.fee || misc['chamber_dto'],
      dbAnchoragePerDay: misc['anchorage'],
      dbSupervisionFee: supervision.fee,
    };

    const result = calculateProforma(calcInput);
    res.json({
      lineItems: result.lineItems,
      totalUsd: result.totalUsd,
      totalEur: result.totalEur,
      vesselName: (vessel as any).name,
      portName: port.name,
      exchangeRates: { usdTry: usdTryRate, eurTry: eurTryRate, eurUsd: eurUsdParity },
      calculatedAt: new Date().toISOString(),
      isEstimate: true,
      cargoType: cargoType || null,
      purposeOfCall: purposeOfCall || null,
      tariffSource,
      portTariffName,
      vesselCategory: vesselCat,
      tariffDetails: {
        pilotage: pilotage.source,
        tugboat: tugboat.source,
        mooring: mooring.source,
        berthing: berthing.source,
        agency: agency.source,
        marpol: marpol.source,
        lcb: lcb.source,
        sanitaryDues: sanitaryDues.source,
        chamberFreightShare: chamberFreightShare.source,
        lightDues: lightDues.source,
      },
    });
  } catch (error) {
    console.error("Quick estimate error:", error);
    res.status(500).json({ message: "Failed to calculate estimate" });
  }
});

router.post("/proformas", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;

    const user = await storage.getUser(userId);
    if (user) {
      const limit = user.proformaLimit ?? 1;
      const count = user.proformaCount ?? 0;
      if (user.userRole !== "admin" && user.subscriptionPlan !== "unlimited" && count >= limit) {
        return res.status(403).json({
          message: "Proforma limit reached. Please upgrade your plan to generate more proformas.",
          code: "LIMIT_REACHED",
          currentPlan: user.subscriptionPlan,
          proformaCount: count,
          proformaLimit: limit,
        });
      }
    }

    const { vesselId, portId, lineItems, totalUsd } = req.body;
    if (!vesselId || !portId || !lineItems || totalUsd === undefined) {
      return res.status(400).json({ message: "vesselId, portId, lineItems, and totalUsd are required" });
    }
    const refNum = `PDA-${Date.now().toString(36).toUpperCase()}`;
    const exchangeRate = req.body.exchangeRate ? Number(req.body.exchangeRate) : 1.1593;
    const proforma = await storage.createProforma({
      userId,
      vesselId: Number(vesselId),
      portId: Number(portId),
      referenceNumber: req.body.referenceNumber || refNum,
      toCompany: req.body.toCompany || null,
      toCountry: req.body.toCountry || null,
      purposeOfCall: req.body.purposeOfCall || "Loading",
      cargoType: req.body.cargoType || null,
      cargoQuantity: req.body.cargoQuantity ? Number(req.body.cargoQuantity) : null,
      cargoUnit: req.body.cargoUnit || "MT",
      berthStayDays: Number(req.body.berthStayDays) || 5,
      exchangeRate,
      lineItems: lineItems as any,
      totalUsd: Number(totalUsd),
      totalEur: req.body.totalEur ? Number(req.body.totalEur) : Math.round(Number(totalUsd) / exchangeRate),
      notes: req.body.notes || null,
      status: req.body.status || "draft",
    });

    await storage.incrementProformaCount(userId);
    logAction(userId, "create", "proforma", proforma.id, { referenceNumber: proforma.referenceNumber, portId: Number(portId), vesselId: Number(vesselId), totalUsd: Number(totalUsd) }, getClientIp(req));

    res.json(proforma);
  } catch (error) {
    console.error("Create proforma error:", error);
    res.status(500).json({ message: "Failed to create proforma" });
  }
});

router.post("/subscription/upgrade", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { plan } = req.body;

    const planLimits: Record<string, number> = {
      free: 1,
      standard: 10,
      unlimited: 999999,
    };

    if (!plan || !planLimits[plan]) {
      return res.status(400).json({ message: "Invalid plan. Choose: free, standard, or unlimited" });
    }

    const updated = await storage.updateSubscription(userId, plan, planLimits[plan]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to upgrade subscription" });
  }
});

router.delete("/proformas/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteProforma(id, userId);
    if (!deleted) return res.status(404).json({ message: "Proforma not found" });
    logAction(userId, "delete", "proforma", id, null, getClientIp(req));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete proforma" });
  }
});

router.post("/proformas/:id/duplicate", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const duplicated = await storage.duplicateProforma(id, userId);
    if (!duplicated) return res.status(404).json({ message: "Proforma not found" });
    logAction(userId, "create", "proforma", duplicated.id, { duplicatedFrom: id }, getClientIp(req));
    res.json(duplicated);
  } catch (error) {
    res.status(500).json({ message: "Failed to duplicate proforma" });
  }
});

router.post("/proformas/:id/send-email", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const { toEmail, subject, message } = req.body;
    if (!toEmail || !subject) return res.status(400).json({ message: "toEmail and subject are required" });

    const proforma = await storage.getProformaById(id);
    if (!proforma || proforma.userId !== userId) return res.status(404).json({ message: "Proforma not found" });

    const vessel = proforma.vesselId ? await storage.getVessel(proforma.vesselId, userId) : null;
    const port = proforma.portId ? await storage.getPort(proforma.portId) : null;
    const exchangeRate = proforma.exchangeRate || 1.1593;

    const ok = await sendProformaEmail({
      toEmail,
      subject,
      message,
      referenceNumber: proforma.referenceNumber || `#${id}`,
      vesselName: vessel?.name || `Vessel #${proforma.vesselId}`,
      portName: port?.name || `Port #${proforma.portId}`,
      purposeOfCall: proforma.purposeOfCall || "-",
      totalUsd: proforma.totalUsd || 0,
      totalEur: proforma.totalEur || (proforma.totalUsd || 0) / exchangeRate,
      exchangeRate,
      lineItems: (proforma.lineItems as any[]) || [],
      bankDetails: proforma.bankDetails as any,
      createdAt: proforma.createdAt?.toString() || new Date().toISOString(),
      toCompany: proforma.toCompany || undefined,
    });

    if (!ok) return res.status(500).json({ message: "Failed to send email" });
    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Send proforma email error:", error);
    res.status(500).json({ message: "Failed to send proforma email" });
  }
});


export default router;
