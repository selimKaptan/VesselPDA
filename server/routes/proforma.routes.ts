import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin, calculateLimiter } from "./shared";
import { insertProformaSchema } from "@shared/schema";
import type { ProformaLineItem } from "@shared/schema";
import { calculateProforma, type CalculationInput } from "../proforma-calculator";
import { lookupPilotageFee, lookupTugboatFee, lookupMooringFee, lookupBerthingFee, lookupAgencyFee, lookupMarpolFee, lookupLcbFee, lookupSanitaryDuesFee, lookupChamberFreightShareFee, lookupChamberShippingFee, lookupLightDuesFee, lookupMiscExpenses, lookupSupervisionFee, lookupVtsFee, lookupHarbourMasterDues, type VesselCategory, type VesselSubCat } from "../tariff-lookup";

import { pool } from "../db";
import { sendProformaEmail, sendApprovalRequestEmail } from "../email";
import { logAction, getClientIp } from "../audit";
import { generateProformaPdf } from "../proforma-pdf";
import { getOrFetchRates } from "../exchange-rates";
import { randomBytes } from "node:crypto";

const router = Router();

// ─── VESSEL SUB-CATEGORY HELPER ───────────────────────────────────────────────
function getVesselSubCat(vesselType?: string): VesselSubCat {
  const t = (vesselType || "").toLowerCase().replace(/[-_ ]/g, "");
  if (t === "container" || t === "containership") return "container";
  if (["passenger", "roro", "ropax", "ferry", "carcarrier", "ropaxferry"].some(k => t.includes(k))) return "passenger_ropax";
  return "cargo";
}

// ─── GROUPED BREAKDOWN HELPER ─────────────────────────────────────────────────
const CATEGORY_ORDER = ["Port Navigation", "Port Dues", "Regulatory", "Chamber & Official", "Disbursement", "Supervision", "Agency"];

function buildGroupedBreakdown(lineItems: { description: string; amountUsd: number; amountEur: number; notes?: string; category?: string }[], totalUsd: number) {
  const map = new Map<string, { items: typeof lineItems; subtotalUsd: number; subtotalEur: number }>();
  for (const item of lineItems) {
    const cat = item.category || "Other";
    if (!map.has(cat)) map.set(cat, { items: [], subtotalUsd: 0, subtotalEur: 0 });
    const g = map.get(cat)!;
    g.items.push(item);
    g.subtotalUsd += item.amountUsd;
    g.subtotalEur += item.amountEur ?? 0;
  }
  const result = [];
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) {
      const g = map.get(cat)!;
      result.push({
        category: cat,
        items: g.items,
        subtotalUsd: Math.round(g.subtotalUsd * 100) / 100,
        subtotalEur: Math.round(g.subtotalEur * 100) / 100,
        pct: totalUsd > 0 ? Math.round((g.subtotalUsd / totalUsd) * 1000) / 10 : 0,
      });
      map.delete(cat);
    }
  }
  for (const [cat, g] of map.entries()) {
    result.push({
      category: cat,
      items: g.items,
      subtotalUsd: Math.round(g.subtotalUsd * 100) / 100,
      subtotalEur: Math.round(g.subtotalEur * 100) / 100,
      pct: totalUsd > 0 ? Math.round((g.subtotalUsd / totalUsd) * 1000) / 10 : 0,
    });
  }
  return result;
}

router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : null;

    if (voyageId) {
      const result = await storage.getProformasByVoyage(voyageId);
      return res.json(result);
    }
    if (await isAdmin(req)) {
      const allProformas = await storage.getAllProformas();
      const enrichedProformas = await Promise.all(allProformas.map(async (p: any) => {
        const logs = await storage.getProformaApprovalLogs(p.id);
        return { ...p, revisionCount: logs.filter((l: any) => l.action === "request_revision").length };
      }));
      return res.json(enrichedProformas);
    }
    const proformas = await storage.getProformasByUser(userId);
    const enrichedProformas = await Promise.all(proformas.map(async (p: any) => {
      const logs = await storage.getProformaApprovalLogs(p.id);
      return { ...p, revisionCount: logs.filter((l: any) => l.action === "request_revision").length };
    }));
    res.json(enrichedProformas);
  } catch (error) {
    console.error("[proformas:GET] fetch failed:", error);
    next(error);
  }
});


router.get("/pending-approval", isAuthenticated, async (req: any, res) => {
  try {
    const proformas = await storage.getProformasByApprovalStatus("sent");
    res.json(proformas);
  } catch (error) {
    res.status(500).json({ message: "Failed to get pending approval proformas" });
  }
});


router.get("/approve-link", async (req: any, res) => {
  try {
    const { token, action, note } = req.query as Record<string, string>;
    if (!token) return res.redirect("/?error=missing_token");

    const proforma = await storage.findProformaByToken(token);
    if (!proforma) return res.redirect("/?error=invalid_token");

    const prevStatus = proforma.approvalStatus;
    const newStatus = action === "approve" ? "approved" : "revision_requested";
    const nowDate = new Date();

    await storage.updateProforma(proforma.id, {
      approvalStatus: newStatus,
      reviewedAt: nowDate,
      ...(action === "approve" ? { approvalNote: note || "Approved via email link" } : { revisionNote: note || "Revision requested via email link" }),
    });

    await storage.createProformaApprovalLog({
      proformaId: proforma.id,
      userId: proforma.userId,
      action: action === "approve" ? "approve" : "request_revision",
      note: note || (action === "approve" ? "Approved via email link" : "Revision requested via email link"),
      previousStatus: prevStatus,
      newStatus,
    });

    await storage.createNotification({
      userId: proforma.userId,
      type: action === "approve" ? "pda_approved" : "pda_revision_requested",
      title: action === "approve" ? "PDA Approved" : "PDA Revision Requested",
      message: action === "approve"
        ? `PDA ${proforma.referenceNumber} has been approved via email link.`
        : `A revision has been requested for PDA ${proforma.referenceNumber} via email link.`,
      link: `/proformas/${proforma.id}`,

    });

    res.redirect(`/proformas/${proforma.id}?approval=${action === "approve" ? "success" : "revision"}`);
  } catch (error) {
    console.error("[proformas:approve-link] error:", error);
    res.redirect("/?error=server_error");
  }
});


router.get("/:id", isAuthenticated, async (req: any, res) => {
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


async function buildProformaPdfResponse(req: any, res: any, next: any, inline: boolean) {
  try {
    const proformaId = parseInt(req.params.id);
    const userId = req.user.claims.sub;

    const proforma = await (await isAdmin(req)
      ? storage.getProformaById(proformaId)
      : storage.getProforma(proformaId, userId));
    if (!proforma) return res.status(404).json({ error: "Proforma not found" });

    const companyProfile = await storage.getCompanyProfileByUser(proforma.userId || userId);

    const pdfBuffer = await generateProformaPdf({
      proforma,
      companyProfile: companyProfile ?? null,
      port: proforma.port ?? null,
      vessel: proforma.vessel ?? null,
    });

    const disposition = inline ? "inline" : "attachment";
    const filename = `PDA-${proforma.referenceNumber || proformaId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[proformas/pdf] generation failed:", error);
    next(error);
  }
}


router.get("/:id/pdf", isAuthenticated, (req: any, res: any, next: any) =>
  buildProformaPdfResponse(req, res, next, false)
);

router.get("/:id/pdf/preview", isAuthenticated, (req: any, res: any, next: any) =>
  buildProformaPdfResponse(req, res, next, true)
);

router.post("/calculate", isAuthenticated, calculateLimiter, async (req: any, res) => {
  try {
    const {
      vesselId, portId, berthStayDays = 5, cargoQuantity,
      anchorageDays = 0, isDangerousCargo = false,
      customsType = "import", flagCategory = "turkish",
      dtoCategory = "turkish", lighthouseCategory = "turkish",
      vtsCategory = "turkish", wharfageCategory = "foreign",
      usdTryRate = 43.86, eurTryRate = 51.73,
      cargoType: cargoTypeRaw = "",
      externalGrt, externalNrt, externalFlag, externalVesselName,
    } = req.body;
    const userId = req.user.claims.sub;

    const isExternalVessel = !vesselId && externalGrt;

    if (!isExternalVessel && !vesselId) {
      return res.status(400).json({ message: "vesselId (or manual vessel data) and portId are required" });
    }
    if (!portId) {
      return res.status(400).json({ message: "portId is required" });
    }

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

    const vesselSubCat = getVesselSubCat((vessel as any).vesselType || req.body.vesselSubType);

    const [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, chamberShipping, lightDues, misc, supervision, vts, harbourMaster] = await Promise.all([
      lookupPilotageFee(pool, portIdNum, grt, vesselCat, dangerous, vesselSubCat),
      lookupTugboatFee(pool, portIdNum, grt, vesselCat, dangerous, vesselSubCat),
      lookupMooringFee(pool, portIdNum, grt, dangerous, flagCat === "cabotage"),
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
      lookupVtsFee(pool, portIdNum, nrt, vesselCat),
      lookupHarbourMasterDues(pool, portIdNum, nrt, usdRate),
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
      dbVtsFee: vts.fee || misc['vts'],
      dbHarbourMasterFee: harbourMaster.fee || undefined,
      dbCustomsFee: misc['customs'],
      dbChamberDtoFee: chamberShipping.fee || misc['chamber_dto'],
      dbAnchoragePerDay: misc['anchorage'],
      dbSupervisionFee: supervision.fee,
    };

    const result = calculateProforma(calcInput);
    const dbSources = [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, lightDues, supervision, vts, harbourMaster];
    const tariffSource = dbSources.some(r => r.source === "database") ? "database" : "estimate";

    res.json({
      lineItems: result.lineItems,
      totalUsd: result.totalUsd,
      totalEur: result.totalEur,
      eurUsdParity: Math.round(eurUsdParity * 1000000) / 1000000,
      tariffSource,
      groupedBreakdown: buildGroupedBreakdown(result.lineItems, result.totalUsd),
    });
  } catch (error) {
    console.error("Calculate error:", error);
    res.status(500).json({ message: "Failed to calculate expenses" });
  }
});


router.post("/quick-estimate", isAuthenticated, calculateLimiter, async (req: any, res) => {
  try {
    const {
      vesselId, portId,
      berthStayDays = 1, anchorageDays = 0,
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

    const vesselSubCat = getVesselSubCat((vessel as any).vesselType);

    const cargoQtyQuick = Number(cargoQuantity) || 5000;
    const [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, chamberShippingQuick, lightDues, misc, supervision, vts, harbourMaster] = await Promise.all([
      lookupPilotageFee(pool, portIdNum, grt, vesselCat, dangerous, vesselSubCat),
      lookupTugboatFee(pool, portIdNum, grt, vesselCat, dangerous, vesselSubCat),
      lookupMooringFee(pool, portIdNum, grt, dangerous, isCabotage),
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
      lookupVtsFee(pool, portIdNum, nrt, vesselCat),
      lookupHarbourMasterDues(pool, portIdNum, nrt, usdTryRate),
    ]);

    const dbSources = [pilotage, tugboat, mooring, berthing, agency, marpol, lcb, sanitaryDues, chamberFreightShare, chamberShippingQuick, lightDues, supervision, vts, harbourMaster];
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
      dbVtsFee: vts.fee || misc['vts'],
      dbHarbourMasterFee: harbourMaster.fee || undefined,
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
      groupedBreakdown: buildGroupedBreakdown(result.lineItems, result.totalUsd),
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


router.post("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const proformaParsed = insertProformaSchema.partial().safeParse(req.body);
    if (!proformaParsed.success) return res.status(400).json({ error: "Invalid input", details: proformaParsed.error.errors });

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

    let bankDetails = req.body.bankDetails || null;
    if (!bankDetails) {
      try {
        const cp = await storage.getCompanyProfileByUser(userId);
        if (cp && ((cp as any).bankName || (cp as any).bankIban)) {
          bankDetails = {
            bankName: (cp as any).bankName || "",
            beneficiary: (cp as any).bankAccountName || cp.companyName || "",
            usdIban: (cp as any).bankIban || "",
            eurIban: (cp as any).bankIban || "",
            swiftCode: (cp as any).bankSwift || "",
            branch: (cp as any).bankBranchName || "",
          };
        }
      } catch { /* ignore bank auto-fill error */ }
    }

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
      bankDetails: bankDetails || null,
      voyageId: req.body.voyageId ? Number(req.body.voyageId) : null,
    } as any);

    await storage.incrementProformaCount(userId);
    logAction(userId, "create", "proforma", proforma.id, { referenceNumber: proforma.referenceNumber, portId: Number(portId), vesselId: Number(vesselId), totalUsd: Number(totalUsd) }, getClientIp(req));

    res.json(proforma);
  } catch (error) {
    console.error("[proformas:POST] create failed:", error);
    next(error);
  }
});


router.delete("/:id", isAuthenticated, async (req: any, res) => {
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


router.post("/:id/duplicate", isAuthenticated, async (req: any, res) => {
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


router.post("/:id/send-email", isAuthenticated, async (req: any, res) => {
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


router.post("/:id/send", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const { recipientEmail, subject, message } = req.body;

    const proforma = await storage.getProformaById(id);
    if (!proforma) return res.status(404).json({ message: "Proforma not found" });
    if (proforma.userId !== userId && !(await isAdmin(req))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const token = randomBytes(24).toString("hex");
    const prevStatus = proforma.approvalStatus;

    const updated = await storage.updateProforma(id, {
      approvalStatus: "sent",
      sentAt: new Date(),
      recipientEmail: recipientEmail || null,
      approvalToken: token,
    });

    await storage.createProformaApprovalLog({
      proformaId: id,
      userId,
      action: "sent",
      note: message || "Sent for approval",
      previousStatus: prevStatus,
      newStatus: "sent",
    });

    await storage.createNotification({
      userId,
      type: "pda_sent",
      title: "PDA Sent for Approval",
      message: `PDA ${proforma.referenceNumber} has been sent for approval.`,
      link: `/proformas/${id}`,

    });

    if (recipientEmail) {
      const vessel = proforma.vesselId ? await storage.getVessel(proforma.vesselId, userId) : null;
      const port = proforma.portId ? await storage.getPort(proforma.portId) : null;
      await sendApprovalRequestEmail({
        toEmail: recipientEmail,
        subject: subject || `PDA for Review: ${proforma.referenceNumber}`,
        message: message || "Please review the attached Proforma Disbursement Account.",
        referenceNumber: proforma.referenceNumber || `#${id}`,
        vesselName: vessel?.name || `Vessel #${proforma.vesselId}`,
        portName: port?.name || `Port #${proforma.portId}`,
        totalUsd: proforma.totalUsd || 0,
        approvalToken: token,
        lineItems: (proforma.lineItems as any[]) || [],
      });
    }

    logAction(userId, "update", "proforma", id, { action: "sent_for_approval", recipientEmail }, getClientIp(req));
    res.json(updated);
  } catch (error) {
    console.error("[proformas:send] error:", error);
    res.status(500).json({ message: "Failed to send proforma for approval" });
  }
});


router.post("/:id/review", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const { action, note } = req.body;

    if (!action || !["approve", "request_revision", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Must be approve, request_revision, or reject" });
    }

    const proforma = await storage.getProformaById(id);
    if (!proforma) return res.status(404).json({ message: "Proforma not found" });

    const statusMap: Record<string, string> = {
      approve: "approved",
      request_revision: "revision_requested",
      reject: "rejected",
    };
    const newStatus = statusMap[action];
    const prevStatus = proforma.approvalStatus;

    const updated = await storage.updateProforma(id, {
      approvalStatus: newStatus,
      reviewedAt: new Date(),
      reviewedBy: userId,
      ...(action === "request_revision" ? { revisionNote: note || null } : {}),
      ...(action === "approve" ? { approvalNote: note || null } : {}),
    });

    await storage.createProformaApprovalLog({
      proformaId: id,
      userId,
      action,
      note: note || null,
      previousStatus: prevStatus,
      newStatus,
    });

    const actionLabel: Record<string, string> = {
      approve: "approved",
      request_revision: "revision requested",
      reject: "rejected",
    };
    await storage.createNotification({
      userId: proforma.userId,
      type: `pda_${action}`,
      title: `PDA ${actionLabel[action]}`,
      message: `PDA ${proforma.referenceNumber} has been ${actionLabel[action]}.${note ? ` Note: ${note}` : ""}`,
      link: `/proformas/${id}`,

    });

    logAction(userId, action === "approve" ? "approve" : "update", "proforma", id, { action, newStatus }, getClientIp(req));
    res.json(updated);
  } catch (error) {
    console.error("[proformas:review] error:", error);
    res.status(500).json({ message: "Failed to review proforma" });
  }
});


router.get("/:id/approval-history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);

    const proforma = await storage.getProformaById(id);
    if (!proforma) return res.status(404).json({ message: "Proforma not found" });
    if (proforma.userId !== userId && !(await isAdmin(req))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const logs = await storage.getProformaApprovalLogs(id);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Failed to get approval history" });
  }
});


export default router;
