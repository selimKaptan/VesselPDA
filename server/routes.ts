import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import { sendNominationEmail, sendNominationResponseEmail, sendContactEmail, sendBidReceivedEmail, sendBidSelectedEmail, sendNewTenderEmail, sendForumReplyEmail, sendProformaEmail } from "./email";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes, authStorage } from "./replit_integrations/auth";
import type { ProformaLineItem } from "@shared/schema";
import { calculateProforma, type CalculationInput } from "./proforma-calculator";
import { startAISStream, getPositions, searchVessels, isConnected, getCacheSize } from "./ais-stream";
import { geocodeStats } from "./geocode-ports";
import { checkSanctions, getSanctionsStatus, loadSanctionsList } from "./sanctions";
import { db } from "./db";
import { sql as drizzleSql } from "drizzle-orm";
import { handleAiChat } from "./anthropic";

const uploadsDir = path.join(process.cwd(), "uploads", "logos");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPG, WEBP, SVG files are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  startAISStream();

  authStorage.markExistingUsersVerified().catch((err) =>
    console.error("[auth] Failed to mark existing users verified:", err)
  );

  app.use("/uploads", (await import("express")).default.static(path.join(process.cwd(), "uploads")));

  async function isAdmin(req: any): Promise<boolean> {
    const userId = req.user?.claims?.sub;
    if (!userId) return false;
    const user = await storage.getUser(userId);
    return user?.userRole === "admin";
  }

  app.get("/api/vessels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (await isAdmin(req)) {
        const vessels = await storage.getAllVessels();
        return res.json(vessels);
      }
      const vessels = await storage.getVesselsByUser(userId);
      res.json(vessels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vessels" });
    }
  });

  app.post("/api/vessels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, flag, vesselType, grt, nrt } = req.body;
      if (!name || !flag || !vesselType || !grt || !nrt) {
        return res.status(400).json({ message: "name, flag, vesselType, grt, and nrt are required" });
      }
      const vessel = await storage.createVessel({
        ...req.body,
        userId,
        grt: Number(grt),
        nrt: Number(nrt),
        dwt: req.body.dwt ? Number(req.body.dwt) : null,
        loa: req.body.loa ? Number(req.body.loa) : null,
        beam: req.body.beam ? Number(req.body.beam) : null,
      });
      res.json(vessel);
    } catch (error) {
      res.status(500).json({ message: "Failed to create vessel" });
    }
  });

  app.patch("/api/vessels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const admin = await isAdmin(req);
      const vessel = admin
        ? await storage.updateVesselById(id, req.body)
        : await storage.updateVessel(id, userId, req.body);
      if (!vessel) return res.status(404).json({ message: "Vessel not found" });
      res.json(vessel);
    } catch (error) {
      res.status(500).json({ message: "Failed to update vessel" });
    }
  });

  app.delete("/api/vessels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const admin = await isAdmin(req);
      const deleted = admin
        ? await storage.deleteVesselById(id)
        : await storage.deleteVessel(id, userId);
      if (!deleted) return res.status(404).json({ message: "Vessel not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete vessel error:", error?.message || error);
      res.status(500).json({ message: "Failed to delete vessel" });
    }
  });

  app.get("/api/ports", async (req, res) => {
    try {
      const q = req.query.q as string | undefined;
      const country = req.query.country as string | undefined;
      if (q && q.trim().length > 0) {
        const results = await storage.searchPorts(q.trim(), country);
        return res.json(results);
      }
      if (country) {
        const results = await storage.getPorts(undefined, country);
        return res.json(results);
      }
      const portList = await storage.getPorts(100);
      res.json(portList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ports" });
    }
  });

  app.get("/api/ports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const port = await storage.getPort(id);
      if (!port) return res.status(404).json({ message: "Port not found" });
      res.json(port);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch port" });
    }
  });

  app.get("/api/port-info/:locode", async (req, res) => {
    try {
      const locode = req.params.locode.toUpperCase();
      const dbPort = await storage.getPortByCode(locode);

      let extended: any = null;
      const apiKey = process.env.VESSEL_API_KEY;
      if (apiKey) {
        try {
          const response = await fetch(
            `https://port-info.p.rapidapi.com/port?code=${locode}`,
            {
              headers: {
                "X-RapidAPI-Key": apiKey,
                "X-RapidAPI-Host": "port-info.p.rapidapi.com",
              },
              signal: AbortSignal.timeout(6000),
            }
          );
          if (response.ok) {
            const data = await response.json();
            if (data && !data.message) {
              extended = {
                lat: data.lat ?? data.latitude ?? null,
                lng: data.lng ?? data.longitude ?? null,
                timezone: data.timezone ?? null,
                maxDraft: data.maxDraft ?? data.max_draft ?? null,
                facilities: data.facilities ?? data.services ?? null,
                city: data.city ?? data.municipality ?? null,
                country: data.country ?? null,
              };
            }
          }
        } catch {
        }
      }

      if (!dbPort && !extended) {
        return res.status(404).json({ message: "Port not found" });
      }

      // Try Nominatim geocoding if no coordinates yet
      if ((!extended?.lat || !extended?.lng) && dbPort?.name) {
        try {
          const portName = encodeURIComponent(dbPort.name);
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${portName}&format=json&limit=1&countrycodes=tr`,
            {
              headers: { "User-Agent": "VesselPDA/1.0 (info@vesselpda.com)" },
              signal: AbortSignal.timeout(5000),
            }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData?.[0]?.lat && geoData?.[0]?.lon) {
              extended = extended || {};
              extended.lat = extended.lat ?? parseFloat(geoData[0].lat);
              extended.lng = extended.lng ?? parseFloat(geoData[0].lon);
              extended.displayName = extended.displayName ?? geoData[0].display_name;
              if (dbPort?.id && extended.lat && extended.lng) {
                storage.updatePortCoords(dbPort.id, extended.lat, extended.lng).catch(() => {});
              }
            }
          }
        } catch {
          // Nominatim unavailable — skip
        }
      }

      // Use DB coordinates as final fallback
      if ((!extended?.lat || !extended?.lng) && dbPort?.latitude && dbPort?.longitude) {
        extended = extended || {} as any;
        extended.lat = extended.lat ?? dbPort.latitude;
        extended.lng = extended.lng ?? dbPort.longitude;
      }

      // Derive timezone for Turkey if not set
      if (extended && !extended.timezone) {
        extended.timezone = "Europe/Istanbul (UTC+3)";
      } else if (!extended) {
        extended = { timezone: "Europe/Istanbul (UTC+3)", lat: null, lng: null, maxDraft: null, facilities: null, city: null, country: "Turkey" };
      }

      // Get agents serving this port from our directory
      let agents: any[] = [];
      if (dbPort?.id) {
        agents = await storage.getAgentsByPort(dbPort.id);
      }

      // Get open tenders at this port
      let openTenders: any[] = [];
      if (dbPort?.id) {
        const allTenders = await storage.getPortTenders({ portId: dbPort.id, status: "open" });
        openTenders = allTenders.slice(0, 5);
      }

      res.json({ port: dbPort || null, extended, agents, openTenders });
    } catch (error) {
      console.error("Port info error:", error);
      res.status(500).json({ message: "Failed to fetch port info" });
    }
  });

  app.get("/api/exchange-rates", async (_req, res) => {
    try {
      const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
        headers: { "User-Agent": "VesselPDA/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`TCMB responded with ${response.status}`);
      const xml = await response.text();

      const extractRate = (currencyCode: string): number | null => {
        const blockRe = new RegExp(
          `<Currency[^>]*CurrencyCode="${currencyCode}"[^>]*>([\\s\\S]*?)<\\/Currency>`,
          "i"
        );
        const block = xml.match(blockRe)?.[1];
        if (!block) return null;
        const buying = parseFloat(block.match(/<ForexBuying>([\d.]+)<\/ForexBuying>/i)?.[1] ?? "");
        const selling = parseFloat(block.match(/<ForexSelling>([\d.]+)<\/ForexSelling>/i)?.[1] ?? "");
        if (isNaN(buying) || isNaN(selling)) return null;
        return Math.round(((buying + selling) / 2) * 10000) / 10000;
      };

      const dateMatch = xml.match(/Date="([^"]+)"/);
      const usdTry = extractRate("USD");
      const eurTry = extractRate("EUR");

      if (!usdTry || !eurTry) throw new Error("Could not parse rates from TCMB response");

      res.json({ usdTry, eurTry, date: dateMatch?.[1] ?? null, source: "TCMB" });
    } catch (error: any) {
      console.error("Exchange rate fetch error:", error.message);
      res.status(502).json({ message: "Could not fetch live rates from TCMB. Please enter rates manually.", error: error.message });
    }
  });

  app.get("/api/vessels/lookup", isAuthenticated, async (req, res) => {
    const imo = (req.query.imo as string || "").replace(/\D/g, "");
    if (!imo || imo.length < 5) {
      return res.status(400).json({ message: "Please enter a valid IMO number (5–7 digits)" });
    }
    const apiKey = process.env.VESSEL_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        message: "Vessel lookup is not configured. Add a RapidAPI key as VESSEL_API_KEY to enable auto-fill.",
        setupUrl: "https://rapidapi.com/zyla-labs-zyla-labs-default/api/vessel-information-api",
      });
    }
    try {
      const response = await fetch(
        `https://vessel-information-api.p.rapidapi.com/1498/get%2Bvessel%2Binfo?imoCode=${imo}`,
        {
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "vessel-information-api.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      const json: any = await response.json();
      if (!response.ok || !json.success || !json.data) {
        const msg = json?.message || "Vessel not found";
        return res.status(404).json({ message: msg });
      }
      const d = json.data;
      const knownFlags = [
        "Turkey", "Malta", "Panama", "Liberia", "Marshall Islands", "Bahamas",
        "Greece", "Cyprus", "Singapore", "Hong Kong", "Norway", "United Kingdom",
        "Antigua & Barbuda", "Belize", "Comoros", "Cook Islands", "Tuvalu",
        "Vanuatu", "Tanzania", "Palau",
      ];
      const typeMap: Record<string, string> = {
        "Bulk Carrier": "Bulk Carrier", "Container Ship": "Container Ship",
        "Container": "Container Ship", "Tanker": "Tanker", "Ro-Ro": "Ro-Ro",
        "Ro-Ro Cargo": "Ro-Ro", "Passenger": "Passenger",
        "Chemical Tanker": "Chemical Tanker", "LPG Tanker": "LPG Carrier",
        "LNG Tanker": "LNG Carrier", "Reefer": "Reefer",
        "General Cargo": "General Cargo", "Cargo": "General Cargo",
      };
      const rawType = d.ship_type || d.vessel_type || "";
      const mappedType = Object.entries(typeMap).find(([k]) =>
        rawType.toLowerCase().includes(k.toLowerCase())
      )?.[1] || "General Cargo";
      const rawFlag = d.flag || "";
      const mappedFlag = knownFlags.find(f => f.toLowerCase() === rawFlag.toLowerCase()) || rawFlag || "Turkey";
      res.json({
        name: d.vessel_name || "",
        flag: mappedFlag,
        vesselType: mappedType,
        imoNumber: String(d.imo_number || imo),
        mmsi: d.mmsi ? String(d.mmsi) : null,
        callSign: d.call_sign || d.callsign || "",
        grt: d.gross_tonnage ? parseFloat(d.gross_tonnage) : null,
        nrt: d.net_tonnage ? parseFloat(d.net_tonnage) : null,
        dwt: d.summer_deadweight_t ? parseFloat(d.summer_deadweight_t) : null,
        loa: d.length_overall_m ? parseFloat(d.length_overall_m) : null,
        beam: d.beam_m ? parseFloat(d.beam_m) : null,
      });
    } catch (error: any) {
      console.error("Vessel lookup error:", error.message);
      res.status(502).json({ message: "Lookup failed. Please try again or enter details manually." });
    }
  });

  app.get("/api/proformas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (await isAdmin(req)) {
        const allProformas = await storage.getAllProformas();
        return res.json(allProformas);
      }
      const proformas = await storage.getProformasByUser(userId);
      res.json(proformas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proformas" });
    }
  });

  app.get("/api/proformas/:id", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/proformas/calculate", isAuthenticated, async (req: any, res) => {
    try {
      const {
        vesselId, portId, berthStayDays = 5, cargoQuantity,
        anchorageDays = 0, isDangerousCargo = false,
        customsType = "import", flagCategory = "turkish",
        dtoCategory = "turkish", lighthouseCategory = "turkish",
        vtsCategory = "turkish", wharfageCategory = "foreign",
        usdTryRate = 43.86, eurTryRate = 51.73
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

      const calcInput: CalculationInput = {
        nrt: vessel.nrt,
        grt: vessel.grt,
        cargoQuantity: cargoQuantity ? Number(cargoQuantity) : 0,
        berthStayDays: Number(berthStayDays) || 5,
        anchorageDays: Number(anchorageDays) || 0,
        isDangerousCargo: isDangerousCargo === true || isDangerousCargo === "true",
        customsType: customsType || "import",
        flagCategory: flagCategory || "turkish",
        dtoCategory: dtoCategory || "turkish",
        lighthouseCategory: lighthouseCategory || "turkish",
        vtsCategory: vtsCategory || "turkish",
        wharfageCategory: wharfageCategory || "foreign",
        usdTryRate: usdRate,
        eurTryRate: eurRate,
        eurUsdParity,
      };

      const result = calculateProforma(calcInput);
      res.json({
        lineItems: result.lineItems,
        totalUsd: result.totalUsd,
        totalEur: result.totalEur,
        eurUsdParity: Math.round(eurUsdParity * 1000000) / 1000000,
      });
    } catch (error) {
      console.error("Calculate error:", error);
      res.status(500).json({ message: "Failed to calculate expenses" });
    }
  });

  app.post("/api/proformas/quick-estimate", isAuthenticated, async (req: any, res) => {
    try {
      const {
        vesselId, portId,
        berthStayDays = 3, anchorageDays = 0,
        cargoQuantity = 5000, isDangerousCargo = false,
        purposeOfCall = "Loading", customsType = "import",
      } = req.body;

      if (!vesselId || !portId) {
        return res.status(400).json({ message: "vesselId and portId are required" });
      }

      const userId = req.user?.claims?.sub || req.user?.id;

      let vessel = await storage.getVessel(Number(vesselId), userId);
      if (!vessel) {
        const allVessels = await storage.getAllVessels();
        vessel = (allVessels as any[]).find((v: any) => v.id === Number(vesselId)) || null;
      }
      if (!vessel) return res.status(404).json({ message: "Vessel not found" });

      const port = await storage.getPort(Number(portId));
      if (!port) return res.status(404).json({ message: "Port not found" });

      let usdTryRate = 43.86;
      let eurTryRate = 51.73;
      try {
        const rateRes = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
          headers: { "User-Agent": "VesselPDA/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (rateRes.ok) {
          const xml = await rateRes.text();
          const extractRate = (code: string): number | null => {
            const blockRe = new RegExp(`<Currency[^>]*CurrencyCode="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`, "i");
            const block = xml.match(blockRe)?.[1];
            if (!block) return null;
            const b = parseFloat(block.match(/<ForexBuying>([\d.]+)<\/ForexBuying>/i)?.[1] ?? "");
            const s = parseFloat(block.match(/<ForexSelling>([\d.]+)<\/ForexSelling>/i)?.[1] ?? "");
            if (isNaN(b) || isNaN(s)) return null;
            return Math.round(((b + s) / 2) * 10000) / 10000;
          };
          usdTryRate = extractRate("USD") || 43.86;
          eurTryRate = extractRate("EUR") || 51.73;
        }
      } catch (_) { /* use fallback */ }

      const eurUsdParity = eurTryRate / usdTryRate;

      const isTurkishFlag = (flag: string) => {
        const f = (flag || "").toLowerCase().trim();
        return ["turkey", "turkish", "türk", "türkiye", "tr", "turk"].includes(f);
      };
      const turkish = isTurkishFlag(vessel.flag || "");
      const flagCat = turkish ? "turkish" : "foreign" as "turkish" | "foreign";

      const calcInput: CalculationInput = {
        nrt: (vessel as any).nrt || 1000,
        grt: (vessel as any).grt || 2000,
        cargoQuantity: Number(cargoQuantity) || 5000,
        berthStayDays: Number(berthStayDays) || 3,
        anchorageDays: Number(anchorageDays) || 0,
        isDangerousCargo: isDangerousCargo === true || isDangerousCargo === "true",
        customsType: (customsType as "import" | "export" | "transit" | "none") || "import",
        flagCategory: flagCat,
        dtoCategory: flagCat,
        lighthouseCategory: flagCat,
        vtsCategory: flagCat,
        wharfageCategory: turkish ? "cabotage" : "foreign",
        usdTryRate,
        eurTryRate,
        eurUsdParity,
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
      });
    } catch (error) {
      console.error("Quick estimate error:", error);
      res.status(500).json({ message: "Failed to calculate estimate" });
    }
  });

  app.post("/api/proformas", isAuthenticated, async (req: any, res) => {
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

      res.json(proforma);
    } catch (error) {
      console.error("Create proforma error:", error);
      res.status(500).json({ message: "Failed to create proforma" });
    }
  });

  app.post("/api/subscription/upgrade", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/proformas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProforma(id, userId);
      if (!deleted) return res.status(404).json({ message: "Proforma not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete proforma" });
    }
  });

  app.post("/api/proformas/:id/duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const duplicated = await storage.duplicateProforma(id, userId);
      if (!duplicated) return res.status(404).json({ message: "Proforma not found" });
      res.json(duplicated);
    } catch (error) {
      res.status(500).json({ message: "Failed to duplicate proforma" });
    }
  });

  app.post("/api/proformas/:id/send-email", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/user/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      if (!["shipowner", "agent", "provider", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Choose: shipowner, agent, or provider" });
      }
      const user = await storage.getUser(userId);
      if (user && user.roleConfirmed) {
        return res.status(403).json({ message: "Role already confirmed. You cannot change your role." });
      }
      const updated = await storage.updateUserRole(userId, role);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.post("/api/admin/bootstrap", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const APPROVED_ADMINS = ["selim@barbarosshipping.com"];
      if (!user || !APPROVED_ADMINS.includes(user.email || "")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.updateUserRole(userId, "admin");
      await storage.updateActiveRole(userId, "admin");
      res.json({ success: true, userRole: updated?.userRole });
    } catch (error) {
      res.status(500).json({ message: "Bootstrap failed" });
    }
  });

  app.patch("/api/admin/active-role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!(await isAdmin(req))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { activeRole } = req.body;
      if (!["shipowner", "agent", "provider", "admin"].includes(activeRole)) {
        return res.status(400).json({ message: "Invalid role. Choose: shipowner, agent, provider, or admin" });
      }
      const updated = await storage.updateActiveRole(userId, activeRole);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update active role" });
    }
  });

  app.get("/api/company-profile/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getCompanyProfileByUser(userId);
      res.json(profile || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company profile" });
    }
  });

  app.post("/api/company-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !["agent", "provider", "admin"].includes(user.userRole)) {
        return res.status(403).json({ message: "Only agents and providers can create company profiles" });
      }
      const existing = await storage.getCompanyProfileByUser(userId);
      if (existing) {
        return res.status(400).json({ message: "Profile already exists. Use PATCH to update." });
      }
      const { companyName, companyType, description, phone, email, website, address, city, country, servedPorts, serviceTypes } = req.body;
      if (!companyName) return res.status(400).json({ message: "companyName is required" });
      const profile = await storage.createCompanyProfile({
        userId,
        companyName,
        companyType: companyType || "agent",
        description: description || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        address: address || null,
        city: city || null,
        country: country || "Turkey",
        servedPorts: servedPorts || [],
        serviceTypes: serviceTypes || [],
        isApproved: false,
      });
      // Notify admin about pending company profile
      const admins = (await storage.getAllUsers()).filter((u: any) => u.userRole === "admin");
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          type: "system",
          title: "New Company Profile Pending Approval",
          message: `${companyName} has submitted a company profile and is awaiting approval.`,
          link: "/admin",
        });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to create company profile" });
    }
  });

  app.patch("/api/company-profile/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { companyName, companyType, description, phone, email, website, address, city, country, servedPorts, serviceTypes } = req.body;
      const safeData: Record<string, any> = {};
      if (companyName !== undefined) safeData.companyName = companyName;
      if (companyType !== undefined) safeData.companyType = companyType;
      if (description !== undefined) safeData.description = description;
      if (phone !== undefined) safeData.phone = phone;
      if (email !== undefined) safeData.email = email;
      if (website !== undefined) safeData.website = website;
      if (address !== undefined) safeData.address = address;
      if (city !== undefined) safeData.city = city;
      if (country !== undefined) safeData.country = country;
      if (servedPorts !== undefined) safeData.servedPorts = servedPorts;
      if (serviceTypes !== undefined) safeData.serviceTypes = serviceTypes;
      const updated = await storage.updateCompanyProfile(id, userId, safeData);
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update company profile" });
    }
  });

  app.post("/api/company-profile/logo", isAuthenticated, uploadLogo.single("logo"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getCompanyProfileByUser(userId);
      if (!profile) return res.status(404).json({ message: "Create a company profile first" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const fileBuffer = fs.readFileSync(req.file.path);
      const base64 = fileBuffer.toString("base64");
      const mimeType = req.file.mimetype || "image/png";
      const logoUrl = `data:${mimeType};base64,${base64}`;

      fs.unlinkSync(req.file.path);

      const updated = await storage.updateCompanyProfile(profile.id, userId, { logoUrl });
      res.json({ logoUrl, profile: updated });
    } catch (error: any) {
      if (error.message?.includes("Only PNG")) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.delete("/api/company-profile/logo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getCompanyProfileByUser(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const updated = await storage.updateCompanyProfile(profile.id, userId, { logoUrl: null });
      res.json({ success: true, profile: updated });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove logo" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/plan", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const { plan } = req.body;
      if (!["free", "standard", "unlimited"].includes(plan)) return res.status(400).json({ message: "Invalid plan" });
      const updated = await storage.updateUserSubscription(req.params.id, plan);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.patch("/api/admin/users/:id/suspend", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const { suspended } = req.body;
      const updated = await storage.suspendUser(req.params.id, !!suspended);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update suspension status" });
    }
  });

  app.patch("/api/admin/users/:id/verify-email", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      await authStorage.markEmailVerified(req.params.id);
      const users = await storage.getAllUsers();
      const updated = users.find((u: any) => u.id === req.params.id);
      if (!updated) return res.status(404).json({ message: "User not found" });
      console.log(`[admin] Manually verified email for user ${req.params.id}`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  app.get("/api/admin/company-profiles", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const profiles = await storage.getAllCompanyProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company profiles" });
    }
  });

  app.get("/api/admin/companies/pending", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const profiles = await storage.getPendingCompanyProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending company profiles" });
    }
  });

  app.post("/api/admin/companies/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const id = parseInt(req.params.id);
      const profile = await storage.approveCompanyProfile(id);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      // Notify company owner
      await storage.createNotification({
        userId: profile.userId,
        type: "system",
        title: "Company Profile Approved",
        message: `Your company profile for ${profile.companyName} has been approved and is now visible in the directory.`,
        link: "/company-profile",
      });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve company profile" });
    }
  });

  app.delete("/api/admin/companies/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const id = parseInt(req.params.id);
      const profile = await storage.getCompanyProfile(id);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      await storage.rejectCompanyProfile(id);
      // Notify company owner
      await storage.createNotification({
        userId: profile.userId,
        type: "system",
        title: "Company Profile Rejected",
        message: `Your company profile for ${profile.companyName} was not approved. Please review and resubmit.`,
        link: "/company-profile",
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to reject company profile" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const allUsers = await storage.getAllUsers();
      const allVessels = await storage.getAllVessels();
      const allProformas = await storage.getAllProformas();
      const allProfiles = await storage.getAllCompanyProfiles();
      const allTenders = await storage.getPortTenders({});
      const allBids: any[] = [];
      for (const tender of allTenders) {
        const bids = await storage.getTenderBids(tender.id);
        allBids.push(...bids);
      }

      // Tenders by port (top 10)
      const portTenderCount: Record<string, number> = {};
      for (const t of allTenders) {
        const pn = (t as any).portName || `Port #${t.portId}`;
        portTenderCount[pn] = (portTenderCount[pn] || 0) + 1;
      }
      const tendersByPort = Object.entries(portTenderCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([port, count]) => ({ port, count }));

      // Bid conversion
      const selectedBids = allBids.filter(b => b.status === "selected").length;
      const bidConversionRate = allBids.length > 0 ? Math.round((selectedBids / allBids.length) * 100) : 0;

      // Monthly proformas (last 6 months)
      const now = new Date();
      const monthlyProformas = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
        const count = allProformas.filter(p => {
          const pd = new Date((p as any).createdAt || 0);
          return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
        }).length;
        return { month: label, count };
      });

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weeklyUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > oneWeekAgo).length;
      const openTendersCount = allTenders.filter(t => t.status === "open").length;

      res.json({
        totalUsers: allUsers.length,
        weeklyUsers,
        totalVessels: allVessels.length,
        totalProformas: allProformas.length,
        totalCompanyProfiles: allProfiles.length,
        totalTenders: allTenders.length,
        openTendersCount,
        totalBids: allBids.length,
        bidConversionRate,
        tendersByPort,
        monthlyProformas,
        usersByRole: {
          shipowner: allUsers.filter(u => u.userRole === "shipowner").length,
          agent: allUsers.filter(u => u.userRole === "agent").length,
          provider: allUsers.filter(u => u.userRole === "provider").length,
          admin: allUsers.filter(u => u.userRole === "admin").length,
        },
        usersByPlan: {
          free: allUsers.filter(u => u.subscriptionPlan === "free").length,
          standard: allUsers.filter(u => u.subscriptionPlan === "standard").length,
          unlimited: allUsers.filter(u => u.subscriptionPlan === "unlimited").length,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/geocode-status", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      res.json({
        total: geocodeStats.total,
        processed: geocodeStats.processed,
        found: geocodeStats.found,
        notFound: geocodeStats.notFound,
        running: geocodeStats.running,
        startedAt: geocodeStats.startedAt,
        remaining: geocodeStats.total - geocodeStats.processed,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch geocode status" });
    }
  });

  app.post("/api/admin/cleanup-ports", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });

      const badPortIds = `
        SELECT p.id FROM ports p
        WHERE p.country = 'Turkey' AND (
          lower(p.name) LIKE '%demir saha%'
          OR lower(p.name) LIKE '%demirleme saha%'
          OR lower(p.name) LIKE '%samandira%'
          OR p.name ILIKE '%şamandıra%'
          OR lower(p.name) LIKE '%nolu demir%'
          OR lower(p.name) LIKE '%nolu demirleme%'
          OR lower(p.name) LIKE '% boya%'
        )
      `;
      const dupPortIds = `
        SELECT p.id FROM ports p
        WHERE p.country = 'Turkey'
          AND p.id NOT IN (SELECT MIN(p2.id) FROM ports p2 WHERE p2.country = 'Turkey' GROUP BY p2.code)
          AND p.code IN (SELECT p3.code FROM ports p3 WHERE p3.country = 'Turkey' GROUP BY p3.code HAVING COUNT(*) > 1)
      `;
      const allBadIds = `SELECT id FROM (${badPortIds} UNION ${dupPortIds}) sub`;

      const r1 = await db.execute(drizzleSql.raw(`DELETE FROM tariff_rates WHERE category_id IN (SELECT tc.id FROM tariff_categories tc WHERE tc.port_id IN (${allBadIds}))`));
      const r2 = await db.execute(drizzleSql.raw(`DELETE FROM tariff_categories WHERE port_id IN (${allBadIds})`));
      const r3 = await db.execute(drizzleSql.raw(`DELETE FROM ports WHERE id IN (${badPortIds})`));
      const r4 = await db.execute(drizzleSql.raw(`DELETE FROM ports WHERE id IN (${dupPortIds})`));

      const countResult = await db.execute(drizzleSql.raw(`SELECT COUNT(*) AS remaining FROM ports WHERE country = 'Turkey'`));
      const remaining = (countResult.rows[0] as any)?.remaining ?? "?";

      res.json({
        message: "Cleanup complete",
        deletedRates: (r1 as any).rowCount ?? 0,
        deletedCategories: (r2 as any).rowCount ?? 0,
        deletedBadPorts: (r3 as any).rowCount ?? 0,
        deletedDupPorts: (r4 as any).rowCount ?? 0,
        remainingTurkishPorts: remaining,
      });
    } catch (error: any) {
      console.error("Cleanup error:", error);
      res.status(500).json({ message: "Cleanup failed", error: error.message });
    }
  });

  app.get("/api/agent-stats/:companyProfileId", async (req, res) => {
    try {
      const companyProfileId = parseInt(req.params.companyProfileId);
      const profile = await storage.getCompanyProfile(companyProfileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const bids = await storage.getTenderBidsByAgent(profile.userId);
      const selectedBids = bids.filter(b => b.status === "selected").length;
      const winRate = bids.length > 0 ? Math.round((selectedBids / bids.length) * 100) : 0;

      const reviews = await storage.getReviewsByCompany(companyProfileId);
      const avgRating = reviews.length > 0
        ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10
        : 0;

      res.json({
        totalBids: bids.length,
        selectedBids,
        winRate,
        avgRating,
        totalReviews: reviews.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent stats" });
    }
  });

  // ─── TRUST SCORE ──────────────────────────────────────────────────────────

  app.get("/api/trust-score/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const allVoyages = await storage.getVoyagesByUser(userId);
      const completedVoyages = allVoyages.filter(v => v.status === "completed").length;
      const finishedVoyages = allVoyages.filter(v => ["completed", "cancelled"].includes(v.status)).length;
      const successRate = finishedVoyages > 0 ? Math.round((completedVoyages / finishedVoyages) * 100) : null;

      const profile = await storage.getCompanyProfileByUser(userId);
      let avgRating = 0;
      let reviewCount = 0;
      let bidWinRate = null;

      if (profile) {
        const reviews = await storage.getReviewsByCompany(profile.id);
        avgRating = reviews.length > 0
          ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10
          : 0;
        reviewCount = reviews.length;

        const bids = await storage.getTenderBidsByAgent(userId);
        if (bids.length > 0) {
          const won = bids.filter(b => b.status === "selected").length;
          bidWinRate = Math.round((won / bids.length) * 100);
        }
      }

      const voyageReviewsResult = await db.execute(
        drizzleSql.raw(`SELECT AVG(rating)::numeric(4,1) AS avg_rating, COUNT(*) AS cnt FROM voyage_reviews WHERE reviewee_user_id = '${userId}'`)
      );
      const vr = voyageReviewsResult.rows[0] as any;
      const voyageAvgRating = vr?.avg_rating ? parseFloat(vr.avg_rating) : 0;
      const voyageReviewCount = parseInt(vr?.cnt ?? "0");

      const combinedAvg = (reviewCount + voyageReviewCount) > 0
        ? Math.round(((avgRating * reviewCount + voyageAvgRating * voyageReviewCount) / (reviewCount + voyageReviewCount)) * 10) / 10
        : 0;

      res.json({
        completedVoyages,
        totalVoyages: allVoyages.length,
        successRate,
        avgRating: combinedAvg,
        reviewCount: reviewCount + voyageReviewCount,
        bidWinRate,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trust score" });
    }
  });

  // ─── VERIFICATION ─────────────────────────────────────────────────────────

  app.post("/api/company-profile/request-verification", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const profile = await storage.getCompanyProfileByUser(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      const { taxNumber, mtoRegistrationNumber, pandiClubName } = req.body;
      if (!taxNumber) return res.status(400).json({ message: "Tax number is required" });
      const updated = await storage.requestVerification(profile.id, userId, { taxNumber, mtoRegistrationNumber, pandiClubName });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to request verification" });
    }
  });

  app.get("/api/admin/pending-verifications", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const pending = await storage.getPendingVerifications();
      res.json(pending);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending verifications" });
    }
  });

  app.post("/api/admin/verify-company/:profileId", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const profileId = parseInt(req.params.profileId);
      const { action, note } = req.body;
      let updated;
      if (action === "approve") {
        updated = await storage.approveVerification(profileId, note);
      } else if (action === "reject") {
        if (!note) return res.status(400).json({ message: "Rejection note required" });
        updated = await storage.rejectVerification(profileId, note);
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update verification" });
    }
  });

  // ─── ENDORSEMENTS ─────────────────────────────────────────────────────────

  app.get("/api/endorsements/:companyProfileId", async (req, res) => {
    try {
      const id = parseInt(req.params.companyProfileId);
      const list = await storage.getEndorsements(id);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch endorsements" });
    }
  });

  app.post("/api/endorsements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { toCompanyProfileId, relationship, message } = req.body;
      if (!toCompanyProfileId || !relationship) return res.status(400).json({ message: "Profile and relationship required" });
      const existing = await storage.getUserEndorsementForProfile(userId, parseInt(toCompanyProfileId));
      if (existing) return res.status(409).json({ message: "You have already endorsed this company" });
      const endo = await storage.createEndorsement({ fromUserId: userId, toCompanyProfileId: parseInt(toCompanyProfileId), relationship, message });
      res.status(201).json(endo);
    } catch (error) {
      res.status(500).json({ message: "Failed to create endorsement" });
    }
  });

  app.delete("/api/endorsements/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const deleted = await storage.deleteEndorsement(parseInt(req.params.id), userId);
      if (!deleted) return res.status(404).json({ message: "Not found or not yours" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete endorsement" });
    }
  });

  // ─── SANCTIONS ────────────────────────────────────────────────────────────

  app.get("/api/sanctions/check", isAuthenticated, async (req: any, res) => {
    try {
      const name = req.query.name as string;
      const imo = req.query.imo as string | undefined;
      if (!name) return res.status(400).json({ message: "name is required" });
      const result = checkSanctions(name, imo);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to check sanctions" });
    }
  });

  app.get("/api/sanctions/status", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      res.json(getSanctionsStatus());
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sanctions status" });
    }
  });

  app.get("/api/service-ports", async (req, res) => {
    try {
      const profiles = await storage.getPublicCompanyProfiles();
      const allPorts = await storage.getPorts();
      const portMap = new Map(allPorts.map(p => [p.id, p]));

      const portCompanyMap: Record<number, { port: any; companies: any[] }> = {};
      for (const profile of profiles) {
        const served = (profile.servedPorts as number[]) || [];
        for (const portId of served) {
          if (!portCompanyMap[portId]) {
            const port = portMap.get(portId);
            if (!port) continue;
            portCompanyMap[portId] = { port, companies: [] };
          }
          portCompanyMap[portId].companies.push({
            id: profile.id,
            companyName: profile.companyName,
            companyType: profile.companyType,
            serviceTypes: profile.serviceTypes,
            city: profile.city,
            country: profile.country,
            isFeatured: profile.isFeatured,
            phone: profile.phone,
            email: profile.email,
            website: profile.website,
            logoUrl: profile.logoUrl,
          });
        }
      }

      const result = Object.values(portCompanyMap)
        .filter(entry => entry.companies.length > 0)
        .sort((a, b) => b.companies.length - a.companies.length);

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service ports" });
    }
  });

  app.get("/api/directory", async (req, res) => {
    try {
      const companyType = req.query.type as string | undefined;
      const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
      const profiles = await storage.getPublicCompanyProfiles({ companyType, portId });
      // Attach avgRating and reviewCount for agent profiles
      const agentProfiles = profiles.filter(p => p.companyType === "agent");
      if (agentProfiles.length > 0) {
        const reviewsMap = new Map<number, { sum: number; count: number }>();
        await Promise.all(agentProfiles.map(async (p) => {
          const reviews = await storage.getReviewsByCompany(p.id);
          if (reviews.length > 0) {
            const sum = reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
            reviewsMap.set(p.id, { sum, count: reviews.length });
          }
        }));
        const enriched = profiles.map(p => {
          const rating = reviewsMap.get(p.id);
          return rating
            ? { ...p, avgRating: Math.round((rating.sum / rating.count) * 10) / 10, reviewCount: rating.count }
            : { ...p, avgRating: null, reviewCount: 0 };
        });
        res.json(enriched);
      } else {
        res.json(profiles.map(p => ({ ...p, avgRating: null, reviewCount: 0 })));
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch directory" });
    }
  });

  app.get("/api/directory/featured", async (req, res) => {
    try {
      const profiles = await storage.getFeaturedCompanyProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured profiles" });
    }
  });

  app.get("/api/directory/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.getCompanyProfile(id);
      if (!profile || !profile.isActive) return res.status(404).json({ message: "Profile not found" });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.get("/api/reviews/:companyProfileId", async (req, res) => {
    try {
      const companyProfileId = parseInt(req.params.companyProfileId);
      const reviews = await storage.getReviewsByCompany(companyProfileId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;
      if (effectiveRole !== "shipowner") {
        return res.status(403).json({ message: "Only shipowners and brokers can leave reviews" });
      }

      const { companyProfileId, tenderId, rating, comment } = req.body;
      if (!companyProfileId) return res.status(400).json({ message: "companyProfileId is required" });
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be between 1 and 5" });

      const profile = await storage.getCompanyProfile(companyProfileId);
      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      let vesselName: string | undefined;
      let portName: string | undefined;

      if (tenderId) {
        const existing = await storage.getMyReviewForTender(userId, tenderId);
        if (existing) return res.status(400).json({ message: "You have already reviewed this job" });

        const tender = await storage.getPortTenderById(tenderId);
        if (tender) {
          if (tender.nominatedAgentId !== profile.userId) {
            return res.status(403).json({ message: "This agent was not nominated for that tender" });
          }
          if (tender.userId !== userId) {
            return res.status(403).json({ message: "This is not your tender" });
          }
          vesselName = tender.vesselName;
          portName = tender.portName;
        }
      }

      const review = await storage.createReview({
        companyProfileId,
        reviewerUserId: userId,
        tenderId: tenderId || null,
        rating,
        comment: comment || null,
        vesselName: vesselName || null,
        portName: portName || null,
      });

      res.json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const [users, proformas, companies] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProformas(),
        storage.getAllCompanyProfiles(),
      ]);
      res.json({
        userCount: users.length,
        proformaCount: proformas.length,
        companyCount: companies.length,
      });
    } catch {
      res.json({ userCount: 0, proformaCount: 0, companyCount: 0 });
    }
  });

  app.post("/api/contact", async (req, res) => {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ ok: false, error: "All fields are required" });
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Invalid email address" });
    }
    sendContactEmail({ name: String(name), email: String(email), subject: String(subject), message: String(message) });
    return res.json({ ok: true });
  });

  app.get("/api/activity-feed", async (_req, res) => {
    try {
      const activities: { type: string; message: string; timestamp: string; icon: string }[] = [];

      const allVessels = await storage.getAllVessels();
      const vesselMap = new Map(allVessels.map(v => [v.id, v]));
      const allPorts = await storage.getPorts();
      const portMap = new Map(allPorts.map(p => [p.id, p]));

      const allProformas = await storage.getAllProformas();
      for (const p of allProformas.slice(0, 8)) {
        const vessel = p.vesselId ? vesselMap.get(p.vesselId) : null;
        const port = p.portId ? portMap.get(p.portId) : null;
        const vesselName = vessel?.name || "a vessel";
        const portName = port?.name || "port";
        activities.push({
          type: "proforma",
          message: `Proforma generated for ${vesselName} at ${portName}`,
          timestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          icon: "filetext",
        });
      }

      const sortedVessels = allVessels
        .filter(v => v.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      for (const v of sortedVessels.slice(0, 6)) {
        activities.push({
          type: "vessel",
          message: `${v.name} (${v.flag}) registered to the fleet`,
          timestamp: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
          icon: "ship",
        });
      }

      const allProfiles = await storage.getAllCompanyProfiles();
      const sortedProfiles = allProfiles
        .filter(p => p.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      for (const p of sortedProfiles.slice(0, 6)) {
        const typeLabel = p.companyType === "agent" ? "Ship Agent" : "Service Provider";
        activities.push({
          type: "company",
          message: `${p.companyName} joined as ${typeLabel}`,
          timestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          icon: "building",
        });
      }

      const allUsers = await storage.getAllUsers();
      const sortedUsers = allUsers
        .filter(u => u.createdAt && u.userRole !== "admin")
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      for (const u of sortedUsers.slice(0, 4)) {
        const roleLabel = u.userRole === "agent" ? "Ship Agent" : u.userRole === "provider" ? "Service Provider" : "Shipowner";
        const name = u.firstName || "A maritime professional";
        activities.push({
          type: "user",
          message: `${name} joined VesselPDA as ${roleLabel}`,
          timestamp: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
          icon: "user",
        });
      }

      const recentTopics = await storage.getForumTopics({ sort: "latest", limit: 6 });
      for (const t of recentTopics) {
        activities.push({
          type: "forum",
          message: `"${t.title}" posted in the forum`,
          timestamp: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
          icon: "message-square",
        });
      }

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(activities.slice(0, 20));
    } catch (error) {
      console.error("Activity feed error:", error);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  app.get("/api/forum/categories", async (_req, res) => {
    try {
      const categories = await storage.getForumCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch forum categories" });
    }
  });

  app.get("/api/forum/topics", async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const sort = (req.query.sort as string) || "latest";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const topics = await storage.getForumTopics({ categoryId, sort, limit, offset });

      const topicsWithParticipants = await Promise.all(
        topics.map(async (t: any) => {
          const participants = await storage.getTopicParticipants(t.id, 5);
          return { ...t, participants };
        })
      );

      res.json(topicsWithParticipants);
    } catch (error) {
      console.error("Forum topics error:", error);
      res.status(500).json({ message: "Failed to fetch forum topics" });
    }
  });

  app.get("/api/forum/topics/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const topic = await storage.getForumTopic(id);
      if (!topic) return res.status(404).json({ message: "Topic not found" });

      const replies = await storage.getForumReplies(id);
      const participants = await storage.getTopicParticipants(id, 10);

      res.json({ ...topic, replies, participants });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch topic" });
    }
  });

  app.post("/api/forum/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, content, categoryId, isAnonymous } = req.body;

      if (!title || !content || !categoryId) {
        return res.status(400).json({ message: "title, content, and categoryId are required" });
      }

      if (title.trim().length < 3) {
        return res.status(400).json({ message: "Title must be at least 3 characters" });
      }

      if (content.trim().length < 10) {
        return res.status(400).json({ message: "Content must be at least 10 characters" });
      }

      const topic = await storage.createForumTopic({
        userId,
        title: title.trim(),
        content: content.trim(),
        categoryId: Number(categoryId),
        isAnonymous: isAnonymous === true,
      });

      res.json(topic);
    } catch (error) {
      console.error("Create topic error:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.delete("/api/forum/topics/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.id);
      const topic = await storage.getForumTopic(topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const user = await storage.getUser(userId);
      const isAdmin = user?.userRole === "admin";
      if (topic.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this topic" });
      }
      await storage.deleteForumTopic(topicId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete topic error:", error);
      res.status(500).json({ message: "Failed to delete topic" });
    }
  });

  app.post("/api/forum/topics/:id/replies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || content.trim().length < 1) {
        return res.status(400).json({ message: "Content is required" });
      }

      const topic = await storage.getForumTopic(topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });

      if (topic.isLocked) {
        return res.status(403).json({ message: "This topic is locked" });
      }

      const reply = await storage.createForumReply({
        topicId,
        userId,
        content: content.trim(),
      });

      res.json(reply);

      // Notify topic author if different from replier
      try {
        if (topic.userId && topic.userId !== userId) {
          const [replier, topicAuthor] = await Promise.all([
            storage.getUser(userId),
            storage.getUser(topic.userId),
          ]);
          const replierName = replier ? `${replier.firstName || ""} ${replier.lastName || ""}`.trim() || replier.email || "Someone" : "Someone";
          await storage.createNotification({
            userId: topic.userId,
            type: "forum_reply",
            title: "New Reply on Your Topic",
            message: `${replierName} replied to "${topic.title}"`,
            link: `/forum/${topicId}`,
          });
          // Send email notification to topic author
          if (topicAuthor?.email) {
            const preview = content.trim().slice(0, 200) + (content.trim().length > 200 ? "..." : "");
            sendForumReplyEmail({
              toEmail: topicAuthor.email,
              topicTitle: topic.title,
              topicId,
              replyAuthor: replierName,
              replyPreview: preview,
            }).catch(() => {});
          }
        }
      } catch (e) { /* non-critical */ }
    } catch (error) {
      console.error("Create reply error:", error);
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  // Like/unlike forum topics
  app.post("/api/forum/topics/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.id);
      if (!topicId) return res.status(400).json({ message: "Invalid topic ID" });
      const result = await storage.toggleTopicLike(userId, topicId);
      res.json(result);
    } catch (error) {
      console.error("Toggle topic like error:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Like/unlike forum replies
  app.post("/api/forum/replies/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const replyId = parseInt(req.params.id);
      if (!replyId) return res.status(400).json({ message: "Invalid reply ID" });
      const result = await storage.toggleReplyLike(userId, replyId);
      res.json(result);
    } catch (error) {
      console.error("Toggle reply like error:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Get current user's liked topic IDs and reply IDs (+ dislikes)
  app.get("/api/forum/my-likes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [topicIds, replyIds, dislikedTopicIds, dislikedReplyIds] = await Promise.all([
        storage.getUserTopicLikes(userId),
        storage.getUserReplyLikes(userId),
        storage.getUserTopicDislikes(userId),
        storage.getUserReplyDislikes(userId),
      ]);
      res.json({ topicIds, replyIds, dislikedTopicIds, dislikedReplyIds });
    } catch (error) {
      console.error("Get user likes error:", error);
      res.status(500).json({ message: "Failed to get likes" });
    }
  });

  // Dislike/undislike forum topics
  app.post("/api/forum/topics/:id/dislike", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.id);
      if (!topicId) return res.status(400).json({ message: "Invalid topic ID" });
      const result = await storage.toggleTopicDislike(userId, topicId);
      res.json(result);
    } catch (error) {
      console.error("Toggle topic dislike error:", error);
      res.status(500).json({ message: "Failed to toggle dislike" });
    }
  });

  // Dislike/undislike forum replies
  app.post("/api/forum/replies/:id/dislike", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const replyId = parseInt(req.params.id);
      if (!replyId) return res.status(400).json({ message: "Invalid reply ID" });
      const result = await storage.toggleReplyDislike(userId, replyId);
      res.json(result);
    } catch (error) {
      console.error("Toggle reply dislike error:", error);
      res.status(500).json({ message: "Failed to toggle dislike" });
    }
  });

  // ─── TENDER ROUTES ──────────────────────────────────────────────────────────

  app.get("/api/tenders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const isAdminUser = user.userRole === "admin";
      const effectiveRole = isAdminUser ? (user.activeRole || "shipowner") : user.userRole;

      if (effectiveRole === "agent") {
        if (isAdminUser) {
          // Admin in agent view: show ALL open tenders (own tenders shown but can't bid on them)
          const allOpen = await storage.getPortTenders({ status: "open" });
          return res.json({ role: "agent", tenders: allOpen, ownUserId: userId });
        }
        const profile = await storage.getCompanyProfileByUser(userId);
        const servedPorts = (profile?.servedPorts as number[]) || [];
        const tenders = await Promise.all(
          servedPorts.map(portId => storage.getPortTenders({ portId, status: "open" }))
        );
        const flat = tenders.flat();
        const unique = flat.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
        return res.json({ role: "agent", tenders: unique });
      }

      const myTenders = await storage.getPortTenders({ userId });
      return res.json({ role: "shipowner", tenders: myTenders });
    } catch (error) {
      console.error("Get tenders error:", error);
      res.status(500).json({ message: "Failed to get tenders" });
    }
  });

  app.post("/api/tenders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;
      if (effectiveRole !== "shipowner") {
        return res.status(403).json({ message: "Only shipowners and brokers can create tenders" });
      }

      const { portId, vesselName, description, cargoInfo, expiryHours, grt, nrt, flag, cargoType, cargoQuantity, previousPort, q88Base64 } = req.body;
      if (!portId) return res.status(400).json({ message: "Port is required" });
      if (!vesselName) return res.status(400).json({ message: "Vessel name is required" });
      if (!flag) return res.status(400).json({ message: "Flag is required" });
      if (!grt) return res.status(400).json({ message: "GRT is required" });
      if (!nrt) return res.status(400).json({ message: "NRT is required" });
      if (!cargoType) return res.status(400).json({ message: "Cargo type is required" });
      if (!cargoQuantity) return res.status(400).json({ message: "Cargo quantity is required" });
      if (!previousPort) return res.status(400).json({ message: "Previous port is required" });
      if (![24, 48].includes(Number(expiryHours))) {
        return res.status(400).json({ message: "Expiry must be 24 or 48 hours" });
      }

      const tender = await storage.createPortTender({
        userId,
        portId: Number(portId),
        vesselName: vesselName || null,
        description: description || null,
        cargoInfo: cargoInfo || null,
        grt: grt ? Number(grt) : null,
        nrt: nrt ? Number(nrt) : null,
        flag: flag || null,
        cargoType: cargoType || null,
        cargoQuantity: cargoQuantity || null,
        previousPort: previousPort || null,
        q88Base64: q88Base64 || null,
        expiryHours: Number(expiryHours),
      });

      const agents = await storage.getAgentsByPort(Number(portId));
      res.json({ tender, agentCount: agents.length });

      // Notify agents serving this port — async, non-blocking
      try {
        const port = await storage.getPort(Number(portId));
        const agentUsers = await Promise.all(agents.slice(0, 50).map((a: any) => storage.getUser(a.userId)));
        for (const agentUser of agentUsers) {
          if (agentUser?.email) {
            sendNewTenderEmail({
              agentEmail: agentUser.email,
              agentName: agentUser.firstName || undefined,
              portName: (port as any)?.name || `Port #${portId}`,
              vesselName: vesselName || undefined,
              cargoType: cargoType || undefined,
              cargoQuantity: cargoQuantity || undefined,
              expiryHours: Number(expiryHours),
              tenderId: tender.id,
            }).catch(e => console.warn("[email] sendNewTenderEmail failed:", e));
          }
        }
      } catch (emailErr) { console.warn("[email] sendNewTenderEmail batch failed (non-critical):", emailErr); }
    } catch (error) {
      console.error("Create tender error:", error);
      res.status(500).json({ message: "Failed to create tender" });
    }
  });

  app.get("/api/tenders/my-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bids = await storage.getTenderBidsByAgent(userId);
      res.json(bids);
    } catch (error) {
      console.error("Get my bids error:", error);
      res.status(500).json({ message: "Failed to get bids" });
    }
  });

  app.get("/api/tenders/badge-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.json({ count: 0 });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;

      if (effectiveRole === "agent") {
        const profile = await storage.getCompanyProfileByUser(userId);
        const portIds = (profile?.servedPorts as number[]) || [];
        const count = await storage.getTenderCountForAgent(userId, portIds);
        return res.json({ count });
      }

      const myTenders = await storage.getPortTenders({ userId, status: "open" });
      const withBids = myTenders.filter(t => (t.bidCount || 0) > 0);
      return res.json({ count: withBids.length });
    } catch (error) {
      res.json({ count: 0 });
    }
  });

  app.get("/api/tenders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const tenderId = parseInt(req.params.id);
      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Tender not found" });

      const isAdminUser = user.userRole === "admin";
      const effectiveRole = isAdminUser ? (user.activeRole || "shipowner") : user.userRole;

      // Agent view (real agents + admin testing in agent mode)
      if (effectiveRole === "agent") {
        if (!isAdminUser) {
          // Real agents: must serve this port
          const profile = await storage.getCompanyProfileByUser(userId);
          const servedPorts = (profile?.servedPorts as number[]) || [];
          if (!servedPorts.includes(tender.portId)) {
            return res.status(403).json({ message: "This tender is not in your served ports" });
          }
        }
        // Admin in agent mode or real agent: show agent view if not the owner
        if (tender.userId !== userId) {
          const bids = await storage.getTenderBids(tenderId);
          const myBid = bids.find(b => b.agentUserId === userId) || null;
          return res.json({ tender, bids: myBid ? [myBid] : [], myBid, isOwner: false });
        }
      }

      if (!isAdminUser) {
        if (effectiveRole === "provider") {
          return res.status(403).json({ message: "Access denied" });
        }
        if (effectiveRole === "shipowner" && tender.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const bids = await storage.getTenderBids(tenderId);
      const bidsNoPdf = bids.map(({ proformaPdfBase64, ...b }) => ({
        ...b,
        hasPdf: !!proformaPdfBase64,
      }));
      res.json({ tender, bids: bidsNoPdf, myBid: null, isOwner: tender.userId === userId });
    } catch (error) {
      console.error("Get tender error:", error);
      res.status(500).json({ message: "Failed to get tender" });
    }
  });

  app.delete("/api/tenders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);
      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });
      if (tender.userId !== userId && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (tender.status !== "open") {
        return res.status(400).json({ message: "Can only cancel open tenders" });
      }
      await storage.updatePortTenderStatus(tenderId, "cancelled");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel tender" });
    }
  });

  app.post("/api/tenders/:id/bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const tenderId = parseInt(req.params.id);
      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Tender not found" });
      if (tender.status !== "open") return res.status(400).json({ message: "Tender is no longer open" });

      const expiresAt = new Date(tender.createdAt).getTime() + tender.expiryHours * 3600000;
      if (Date.now() > expiresAt) return res.status(400).json({ message: "Tender has expired" });

      const existingBids = await storage.getTenderBids(tenderId);
      if (existingBids.some(b => b.agentUserId === userId)) {
        return res.status(400).json({ message: "You have already submitted a bid for this tender" });
      }

      const profile = await storage.getCompanyProfileByUser(userId);
      const { notes, totalAmount, currency, proformaPdfBase64 } = req.body;

      if (proformaPdfBase64 && proformaPdfBase64.length > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "PDF file is too large (max 5MB)" });
      }

      const bid = await storage.createTenderBid({
        tenderId,
        agentUserId: userId,
        agentCompanyId: profile?.id || null,
        proformaPdfBase64: proformaPdfBase64 || null,
        notes: notes || null,
        totalAmount: totalAmount || null,
        currency: currency || "USD",
      });

      res.json(bid);

      // Notify tender owner — async, non-blocking
      try {
        const owner = await storage.getUser(tender.userId);
        const port = await storage.getPort(tender.portId);
        const portName = (port as any)?.name || `Port #${tender.portId}`;
        const agentName = profile?.companyName || user.firstName || "An agent";
        if (owner?.email) {
          await sendBidReceivedEmail({
            ownerEmail: owner.email,
            ownerName: owner.firstName || owner.email,
            agentName,
            portName,
            vesselName: tender.vesselName || undefined,
            totalAmount: totalAmount || undefined,
            currency: currency || "USD",
            tenderId,
          });
        }
        await storage.createNotification({
          userId: tender.userId,
          type: "bid_received",
          title: "New Bid Received",
          message: `${agentName} submitted a bid for ${portName}${tender.vesselName ? ` — ${tender.vesselName}` : ""}`,
          link: `/tenders/${tenderId}`,
        });
      } catch (emailErr) { console.warn("[email] sendBidReceivedEmail failed (non-critical):", emailErr); }
    } catch (error) {
      console.error("Create bid error:", error);
      res.status(500).json({ message: "Failed to submit bid" });
    }
  });

  app.post("/api/tenders/:id/bids/:bidId/select", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);
      const bidId = parseInt(req.params.bidId);

      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });
      if (tender.userId !== userId && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const bids = await storage.getTenderBids(tenderId);
      for (const bid of bids) {
        await storage.updateTenderBidStatus(bid.id, bid.id === bidId ? "selected" : "rejected");
      }
      await storage.updatePortTenderStatus(tenderId, "closed");

      const selectedBid = bids.find(b => b.id === bidId);
      res.json({ success: true, selectedBid });

      // Notify the winning agent — async, non-blocking
      try {
        if (selectedBid) {
          const agent = await storage.getUser(selectedBid.agentUserId);
          const port = await storage.getPort(tender.portId);
          const portName = (port as any)?.name || `Port #${tender.portId}`;
          if (agent?.email) {
            await sendBidSelectedEmail({
              agentEmail: agent.email,
              agentName: agent.firstName || undefined,
              portName,
              vesselName: tender.vesselName || undefined,
              tenderId,
            });
          }
          await storage.createNotification({
            userId: selectedBid.agentUserId,
            type: "bid_selected",
            title: "Your Bid Was Selected!",
            message: `Your bid for ${portName}${tender.vesselName ? ` — ${tender.vesselName}` : ""} has been selected.`,
            link: `/tenders/${tenderId}`,
          });
        }
      } catch (emailErr) { console.warn("[email] sendBidSelectedEmail failed (non-critical):", emailErr); }
    } catch (error) {
      console.error("Select bid error:", error);
      res.status(500).json({ message: "Failed to select bid" });
    }
  });

  app.post("/api/tenders/:id/nominate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);
      const { note, extraEmails } = req.body;

      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });
      if (tender.userId !== userId && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const bids = await storage.getTenderBids(tenderId);
      const selectedBid = bids.find(b => b.status === "selected");
      if (!selectedBid) return res.status(400).json({ message: "No bid selected yet" });

      await storage.updatePortTenderStatus(tenderId, "nominated", selectedBid.agentUserId);

      // In-app notification for the nominated agent
      const port = await storage.getPort(tender.portId);
      const portNameForNotif = (port as any)?.name || tender.portName || `Port #${tender.portId}`;
      await storage.createNotification({
        userId: selectedBid.agentUserId,
        type: "nomination",
        title: "Tebrikler! Nominasyon Onaylandı",
        message: `${portNameForNotif}${tender.vesselName ? ` — ${tender.vesselName}` : ""} için nominasyon resmi olarak onaylandı.`,
        link: `/tenders/${tenderId}`,
      });

      // Auto-create voyage for both shipowner and agent
      let autoVoyageId: number | null = null;
      let autoConversationId: number | null = null;
      try {
        const existingVoyage = await storage.getVoyageByTenderId(tenderId);
        let voyage = existingVoyage;
        if (!voyage) {
          voyage = await storage.createVoyage({
            userId: tender.userId,
            agentUserId: selectedBid.agentUserId,
            tenderId,
            portId: tender.portId,
            vesselName: tender.vesselName ?? null,
            flag: tender.flag ?? null,
            grt: tender.grt ?? null,
            status: "planned",
            purposeOfCall: tender.cargoType || "Loading",
          } as any);
        }
        autoVoyageId = voyage.id;

        // Create or get conversation linked to voyage
        const conversation = await storage.getOrCreateConversation(
          tender.userId,
          selectedBid.agentUserId,
          voyage.id
        );
        autoConversationId = conversation.id;

        // Notify agent about the new conversation
        await storage.createNotification({
          userId: selectedBid.agentUserId,
          type: "message",
          title: "Sohbet Açıldı",
          message: `Nominasyon seferi için armatörle yeni bir sohbet oluşturuldu.`,
          link: `/messages/${conversation.id}`,
        });
      } catch (voyageErr) {
        console.error("[nominate] Voyage/conversation auto-create failed (non-blocking):", voyageErr);
      }

      const extraEmailsList: string[] = Array.isArray(extraEmails)
        ? extraEmails
        : typeof extraEmails === "string"
          ? extraEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
          : [];

      if (selectedBid.agentEmail) {
        sendNominationEmail({
          agentEmail: selectedBid.agentEmail,
          agentCompanyName: selectedBid.companyName || `${selectedBid.agentFirstName} ${selectedBid.agentLastName}`,
          extraEmails: extraEmailsList,
          portName: tender.portName,
          vesselName: tender.vesselName ?? undefined,
          flag: tender.flag ?? undefined,
          grt: tender.grt ?? undefined,
          nrt: tender.nrt ?? undefined,
          cargoType: tender.cargoType ?? undefined,
          cargoQuantity: tender.cargoQuantity ?? undefined,
          previousPort: tender.previousPort ?? undefined,
          note: note || undefined,
        }).catch(err => console.error("[email] Nomination email failed (non-blocking):", err));
      }

      res.json({
        success: true,
        nominatedAgent: {
          companyName: selectedBid.companyName,
          email: selectedBid.agentEmail,
          agentFirstName: selectedBid.agentFirstName,
          agentLastName: selectedBid.agentLastName,
        },
        note: note || null,
        extraEmails: extraEmailsList,
        emailSent: !!selectedBid.agentEmail,
        voyageId: autoVoyageId,
        conversationId: autoConversationId,
      });
    } catch (error) {
      console.error("Nominate error:", error);
      res.status(500).json({ message: "Failed to process nomination" });
    }
  });

  // Fetch voyage + conversation linked to a tender (for post-nomination UI)
  app.get("/api/tenders/:id/voyage", isAuthenticated, async (req: any, res) => {
    try {
      const tenderId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const voyage = await storage.getVoyageByTenderId(tenderId);
      if (!voyage) return res.json(null);
      // Only participants can see this
      if (voyage.userId !== userId && voyage.agentUserId !== userId && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // Find conversation between the two parties
      const conversation = await storage.getOrCreateConversation(voyage.userId, voyage.agentUserId!, voyage.id);
      res.json({ voyageId: voyage.id, conversationId: conversation.id });
    } catch (err) {
      console.error("GET /api/tenders/:id/voyage error:", err);
      res.status(500).json({ message: "Failed to fetch voyage info" });
    }
  });

  // ─── VESSEL TRACK ─────────────────────────────────────────────────────────────
  function seededRandom(seed: number): number {
    let t = (seed ^ 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // TODO: Replace MOCK_AIS_DATA with real AIS API call when API key is available
  // Compatible with: MarineTraffic API v2, VesselFinder, AISHub, or any MMSI/position-based AIS provider
  // Integration point: replace the MOCK_AIS_DATA array + the search filter below
  // Expected field format per vessel: { mmsi, name, flag, vesselType, lat, lng, heading, speed, destination, eta, status }
  const MOCK_AIS_DATA = [
    { mmsi: "271000001", name: "MV MARMARA STAR", flag: "🇹🇷", vesselType: "Bulk Carrier", lat: 40.9823, lng: 28.6542, heading: 45, speed: 10.2, destination: "ISTANBUL", eta: "2026-02-26T18:00:00Z", status: "underway" },
    { mmsi: "271000002", name: "MV AEGEAN PIONEER", flag: "🇹🇷", vesselType: "General Cargo", lat: 38.4337, lng: 26.7673, heading: 270, speed: 8.5, destination: "IZMIR", eta: "2026-02-26T20:00:00Z", status: "underway" },
    { mmsi: "271000003", name: "MV BOSPHORUS TRADER", flag: "🇹🇷", vesselType: "Container Ship", lat: 41.0210, lng: 29.1102, heading: 180, speed: 0, destination: "ISTANBUL", eta: null, status: "anchored" },
    { mmsi: "248000001", name: "MV HELLAS SPIRIT", flag: "🇬🇷", vesselType: "Tanker", lat: 37.8510, lng: 23.9200, heading: 90, speed: 12.1, destination: "MERSIN", eta: "2026-02-27T10:00:00Z", status: "underway" },
    { mmsi: "271000004", name: "MV MERSIN PRIDE", flag: "🇹🇷", vesselType: "Bulk Carrier", lat: 36.7825, lng: 34.6001, heading: 0, speed: 0, destination: "MERSIN", eta: null, status: "moored" },
    { mmsi: "271000005", name: "MV CANAKKALE GUARDIAN", flag: "🇹🇷", vesselType: "RoRo", lat: 40.1490, lng: 26.3990, heading: 315, speed: 14.3, destination: "CANAKKALE", eta: "2026-02-26T16:30:00Z", status: "underway" },
    { mmsi: "229000001", name: "MV MALTA VENTURE", flag: "🇲🇹", vesselType: "General Cargo", lat: 39.4210, lng: 32.8540, heading: 200, speed: 9.8, destination: "ISKENDERUN", eta: "2026-02-27T08:00:00Z", status: "underway" },
    { mmsi: "271000006", name: "MV TRABZON CARRIER", flag: "🇹🇷", vesselType: "Bulk Carrier", lat: 41.0020, lng: 39.7340, heading: 0, speed: 0, destination: "TRABZON", eta: null, status: "moored" },
    { mmsi: "271000007", name: "MV SAMSUN BREEZE", flag: "🇹🇷", vesselType: "Container Ship", lat: 41.2820, lng: 36.3320, heading: 90, speed: 11.5, destination: "SAMSUN", eta: "2026-02-26T22:00:00Z", status: "underway" },
    { mmsi: "255000001", name: "MV MADEIRA STREAM", flag: "🇵🇹", vesselType: "Tanker", lat: 40.5660, lng: 27.5900, heading: 135, speed: 7.2, destination: "TEKIRDAG", eta: "2026-02-27T06:00:00Z", status: "underway" },
    { mmsi: "271000008", name: "MV IZMIR STAR", flag: "🇹🇷", vesselType: "General Cargo", lat: 38.6990, lng: 27.0990, heading: 0, speed: 0, destination: "IZMIR", eta: null, status: "anchored" },
    { mmsi: "636000001", name: "MV LIBERIA HAWK", flag: "🇱🇷", vesselType: "Bulk Carrier", lat: 36.5990, lng: 36.1620, heading: 270, speed: 13.4, destination: "ISKENDERUN", eta: "2026-02-26T23:00:00Z", status: "underway" },
    { mmsi: "538000001", name: "MV MARSHALL TIDE", flag: "🇲🇭", vesselType: "Tanker", lat: 41.5680, lng: 31.4500, heading: 60, speed: 10.0, destination: "ZONGULDAK", eta: "2026-02-27T04:00:00Z", status: "underway" },
    { mmsi: "271000009", name: "MV BANDIRMA EXPRESS", flag: "🇹🇷", vesselType: "Ferry", lat: 40.3490, lng: 27.9670, heading: 0, speed: 0, destination: "BANDIRMA", eta: null, status: "moored" },
    { mmsi: "311000001", name: "MV BAHAMAS CHIEF", flag: "🇧🇸", vesselType: "Container Ship", lat: 36.8820, lng: 30.6870, heading: 315, speed: 15.2, destination: "ANTALYA", eta: "2026-02-26T19:00:00Z", status: "underway" },
  ];

  app.get("/api/vessel-track/status", isAuthenticated, (_req, res) => {
    const liveCount = getCacheSize();
    const live = isConnected() || liveCount > 0;
    res.json({
      connected: isConnected(),
      vesselCount: live ? liveCount : MOCK_AIS_DATA.length,
      mode: live ? "live" : "demo",
    });
  });

  app.get("/api/vessel-track/positions", isAuthenticated, async (_req, res) => {
    const livePositions = getPositions();
    res.json(livePositions.length > 0 ? livePositions : MOCK_AIS_DATA);
  });

  app.get("/api/vessel-track/search", isAuthenticated, async (req, res) => {
    const q = (req.query.q as string || "").toLowerCase().trim();
    if (!q) return res.json([]);
    const liveResults = searchVessels(q);
    if (liveResults.length > 0) return res.json(liveResults);
    const results = MOCK_AIS_DATA.filter(v =>
      v.name.toLowerCase().includes(q) || v.mmsi.includes(q)
    );
    res.json(results);
  });

  app.get("/api/vessel-track/watchlist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const list = await storage.getVesselWatchlist(userId);
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: "Failed to get watchlist" });
    }
  });

  app.post("/api/vessel-track/watchlist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { vesselName, mmsi, imo, flag, vesselType, notes } = req.body;
      if (!vesselName) return res.status(400).json({ message: "vesselName is required" });
      const item = await storage.addToWatchlist({ userId, vesselName, mmsi, imo, flag, vesselType, notes });
      res.json(item);
    } catch (e) {
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/vessel-track/watchlist/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const ok = await storage.removeFromWatchlist(id, userId);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  app.get("/api/vessel-track/fleet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vessels = await storage.getVesselsByUser(userId);
      const fleetWithPositions = vessels.map((v, i) => {
        const mock = MOCK_AIS_DATA[i % MOCK_AIS_DATA.length];
        return {
          id: v.id,
          vesselName: v.name,
          mmsi: null,
          imo: v.imoNumber,
          flag: v.flag,
          vesselType: v.vesselType,
          grt: v.grt,
          lat: mock.lat + (seededRandom(v.id * 1000 + 1) - 0.5) * 2,
          lng: mock.lng + (seededRandom(v.id * 1000 + 2) - 0.5) * 2,
          heading: Math.floor(seededRandom(v.id * 1000 + 3) * 360),
          speed: Math.round(seededRandom(v.id * 1000 + 4) * 14 * 10) / 10,
          destination: mock.destination,
          eta: mock.eta,
          status: ["underway", "anchored", "moored"][Math.floor(seededRandom(v.id * 1000 + 5) * 3)] as string,
          isOwnVessel: true,
        };
      });
      res.json(fleetWithPositions);
    } catch (e) {
      res.status(500).json({ message: "Failed to get fleet" });
    }
  });

  app.get("/api/vessel-track/agency-vessels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getCompanyProfileByUser(userId);
      if (!profile) return res.json([]);
      const allTenders = await storage.getPortTenders({ status: "nominated" });
      const myNominated = allTenders.filter((t: any) => t.nominatedAgentId === userId);
      const agencyVessels = myNominated.map((t: any, i: number) => {
        const mock = MOCK_AIS_DATA[i % MOCK_AIS_DATA.length];
        return {
          id: `tender-${t.id}`,
          vesselName: t.vesselName || `Vessel #${t.id}`,
          mmsi: null,
          imo: null,
          flag: t.flag || "Unknown",
          vesselType: t.cargoType || "General Cargo",
          tenderId: t.id,
          portName: t.port?.name,
          lat: mock.lat + (seededRandom(t.id * 2000 + 1) - 0.5) * 1.5,
          lng: mock.lng + (seededRandom(t.id * 2000 + 2) - 0.5) * 1.5,
          heading: Math.floor(seededRandom(t.id * 2000 + 3) * 360),
          speed: Math.round(seededRandom(t.id * 2000 + 4) * 12 * 10) / 10,
          destination: t.port?.name || "Unknown",
          eta: null,
          status: "underway",
          isAgencyVessel: true,
        };
      });
      res.json(agencyVessels);
    } catch (e) {
      res.status(500).json({ message: "Failed to get agency vessels" });
    }
  });

  app.get("/api/tenders/:id/bids/:bidId/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);
      const bidId = parseInt(req.params.bidId);

      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });

      const bids = await storage.getTenderBids(tenderId);
      const bid = bids.find(b => b.id === bidId);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      const isOwner = tender.userId === userId;
      const isThisAgent = bid.agentUserId === userId;
      if (!isOwner && !isThisAgent && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allBids = await storage.getTenderBids(tenderId);
      const fullBid = allBids.find(b => b.id === bidId);
      res.json({ proformaPdfBase64: fullBid?.proformaPdfBase64 || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to get PDF" });
    }
  });

  // ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getNotifications(userId);
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      res.json({ notifications: items, unreadCount });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all read" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.markNotificationRead(id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  app.post("/api/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category, message, pageUrl } = req.body;
      if (!category || !message?.trim()) {
        return res.status(400).json({ message: "Category and message are required" });
      }
      const feedback = await storage.createFeedback({ userId, category, message: message.trim(), pageUrl });
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  app.get("/api/admin/feedback", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const items = await storage.getAllFeedbacks();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // ─── VOYAGES ──────────────────────────────────────────────────────────────────

  app.get("/api/voyages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const role = req.user?.activeRole || req.user?.userRole || "shipowner";
      const voyageList = await storage.getVoyagesByUser(userId, role);
      res.json(voyageList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch voyages" });
    }
  });

  app.post("/api/voyages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const data = { ...req.body, userId };
      if (data.eta) data.eta = new Date(data.eta);
      if (data.etd) data.etd = new Date(data.etd);
      const voyage = await storage.createVoyage(data);
      res.json(voyage);
    } catch (error) {
      res.status(500).json({ message: "Failed to create voyage" });
    }
  });

  app.get("/api/voyages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const voyage = await storage.getVoyageById(id);
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });
      res.json(voyage);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch voyage" });
    }
  });

  app.patch("/api/voyages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const id = parseInt(req.params.id);
      const existing = await storage.getVoyageById(id);
      if (!existing) return res.status(404).json({ message: "Voyage not found" });
      if (existing.userId !== userId && existing.agentUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { eta, etd, notes, purposeOfCall, vesselName, imoNumber, mmsi, status } = req.body;
      const updateData: any = {};
      if (eta !== undefined) updateData.eta = eta ? new Date(eta) : null;
      if (etd !== undefined) updateData.etd = etd ? new Date(etd) : null;
      if (notes !== undefined) updateData.notes = notes;
      if (purposeOfCall !== undefined) updateData.purposeOfCall = purposeOfCall;
      if (vesselName !== undefined) updateData.vesselName = vesselName;
      if (imoNumber !== undefined) updateData.imoNumber = imoNumber;
      if (mmsi !== undefined) updateData.mmsi = mmsi;
      if (status !== undefined) updateData.status = status;

      const oldEtaStr = existing.eta ? new Date(existing.eta).toISOString().slice(0, 10) : null;
      const newEtaStr = updateData.eta ? new Date(updateData.eta).toISOString().slice(0, 10) : null;
      const etaChanged = oldEtaStr !== newEtaStr;

      const updated = await storage.updateVoyage(id, updateData);

      if (etaChanged && existing.agentUserId && existing.agentUserId !== userId) {
        const oldEtaFmt = existing.eta ? new Date(existing.eta).toLocaleDateString("tr-TR") : "belirtilmemiş";
        const newEtaFmt = updateData.eta ? new Date(updateData.eta).toLocaleDateString("tr-TR") : "iptal edildi";
        await storage.createNotification({
          userId: existing.agentUserId,
          type: "eta_change",
          title: "ETA Güncellendi",
          message: `Sefer #${id} ETA değişti: ${oldEtaFmt} → ${newEtaFmt}`,
          link: `/voyages/${id}`,
        });
      }
      if (etaChanged && existing.userId && existing.userId !== userId) {
        const oldEtaFmt = existing.eta ? new Date(existing.eta).toLocaleDateString("tr-TR") : "belirtilmemiş";
        const newEtaFmt = updateData.eta ? new Date(updateData.eta).toLocaleDateString("tr-TR") : "iptal edildi";
        await storage.createNotification({
          userId: existing.userId,
          type: "eta_change",
          title: "ETA Güncellendi",
          message: `Sefer #${id} ETA değişti: ${oldEtaFmt} → ${newEtaFmt}`,
          link: `/voyages/${id}`,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("updateVoyage error:", error);
      res.status(500).json({ message: "Failed to update voyage" });
    }
  });

  app.patch("/api/voyages/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const voyage = await storage.updateVoyageStatus(id, status);
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });
      res.json(voyage);
    } catch (error) {
      res.status(500).json({ message: "Failed to update voyage status" });
    }
  });

  app.post("/api/voyages/:id/checklist", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const item = await storage.createChecklistItem({ ...req.body, voyageId });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add checklist item" });
    }
  });

  app.patch("/api/voyages/:id/checklist/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const item = await storage.toggleChecklistItem(itemId, voyageId);
      if (!item) return res.status(404).json({ message: "Item not found" });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle checklist item" });
    }
  });

  app.delete("/api/voyages/:id/checklist/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      await storage.deleteChecklistItem(itemId, voyageId);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete checklist item" });
    }
  });

  // ─── SERVICE REQUESTS ─────────────────────────────────────────────────────────

  app.get("/api/service-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const role = req.user?.activeRole || req.user?.userRole || "shipowner";
      if (role === "provider") {
        const profile = await storage.getCompanyProfile(userId);
        const portIds: number[] = (profile?.servedPorts as any[]) || [];
        const requests = await storage.getServiceRequestsByPort(portIds);
        const myOffers = await storage.getProviderOffersByUser(userId);
        res.json({ requests, myOffers });
      } else {
        const requests = await storage.getServiceRequestsByUser(userId);
        res.json({ requests, myOffers: [] });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service requests" });
    }
  });

  app.post("/api/service-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const data = { ...req.body, requesterId: userId };
      if (data.preferredDate) data.preferredDate = new Date(data.preferredDate);
      const request = await storage.createServiceRequest(data);
      // Notify providers in this port
      const providers = await storage.getAgentsByPort(data.portId);
      for (const p of providers) {
        if (p.userId) {
          await storage.createNotification({
            userId: p.userId,
            type: "service_request",
            title: "Yeni Hizmet Talebi",
            message: `${data.serviceType} hizmeti için yeni bir talep oluşturuldu: ${data.vesselName}`,
            link: `/service-requests/${request.id}`,
          });
        }
      }
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to create service request" });
    }
  });

  app.get("/api/service-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getServiceRequestById(id);
      if (!request) return res.status(404).json({ message: "Not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service request" });
    }
  });

  app.post("/api/service-requests/:id/offers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const serviceRequestId = parseInt(req.params.id);
      const companyId = await storage.getProviderCompanyIdByUser(userId);
      const offer = await storage.createServiceOffer({
        ...req.body,
        serviceRequestId,
        providerUserId: userId,
        providerCompanyId: companyId,
      });
      // Notify requester
      const sr = await storage.getServiceRequestById(serviceRequestId);
      if (sr) {
        await storage.createNotification({
          userId: sr.requesterId,
          type: "service_offer",
          title: "Yeni Hizmet Teklifi",
          message: `${sr.vesselName} için hizmet talebinize yeni bir teklif geldi`,
          link: `/service-requests/${serviceRequestId}`,
        });
      }
      res.json(offer);
    } catch (error) {
      res.status(500).json({ message: "Failed to submit offer" });
    }
  });

  app.post("/api/service-requests/:id/offers/:offerId/select", isAuthenticated, async (req: any, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const offerId = parseInt(req.params.offerId);
      const offer = await storage.selectServiceOffer(offerId, requestId);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      // Notify selected provider
      await storage.createNotification({
        userId: offer.providerUserId,
        type: "service_offer_selected",
        title: "Teklifiniz Seçildi",
        message: "Hizmet teklifiniz kabul edildi",
        link: `/service-requests/${requestId}`,
      });
      res.json(offer);
    } catch (error) {
      res.status(500).json({ message: "Failed to select offer" });
    }
  });

  app.patch("/api/service-requests/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const request = await storage.updateServiceRequestStatus(id, status);
      if (!request) return res.status(404).json({ message: "Not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // ─── VOYAGE DOCUMENTS ──────────────────────────────────────────────────────

  app.get("/api/voyages/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const docs = await storage.getVoyageDocuments(voyageId);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get documents" });
    }
  });

  app.post("/api/voyages/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { name, docType, fileBase64, notes } = req.body;
      if (!name || !fileBase64) return res.status(400).json({ message: "name and fileBase64 required" });
      const doc = await storage.createVoyageDocument({
        voyageId,
        name,
        docType: docType || "other",
        fileBase64,
        notes: notes || null,
        uploadedByUserId: req.user.claims.sub,
      });
      res.status(201).json(doc);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.delete("/api/voyages/:id/documents/:docId", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      const ok = await storage.deleteVoyageDocument(docId, voyageId);
      if (!ok) return res.status(404).json({ message: "Document not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ─── VOYAGE CHAT ────────────────────────────────────────────────────────────

  app.get("/api/voyages/:id/chat", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const userId = req.user?.claims?.sub || req.user?.id;
      const role = req.user?.claims?.role || req.user?.role;
      const voyage = await storage.getVoyageById(voyageId);
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });
      if (role !== "admin" && voyage.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const msgs = await storage.getVoyageChatMessages(voyageId);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get chat messages" });
    }
  });

  app.post("/api/voyages/:id/chat", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const userId = req.user?.claims?.sub || req.user?.id;
      const role = req.user?.claims?.role || req.user?.role;
      const { content } = req.body;
      if (!content || !content.trim()) return res.status(400).json({ message: "content required" });
      const voyage = await storage.getVoyageById(voyageId);
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });
      if (role !== "admin" && voyage.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const msg = await storage.createVoyageChatMessage({
        voyageId,
        senderId: userId,
        content: content.trim(),
      });
      res.status(201).json(msg);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ─── VOYAGE REVIEWS ────────────────────────────────────────────────────────

  app.get("/api/voyages/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const reviews = await storage.getVoyageReviews(voyageId);
      const userId = req.user?.claims?.sub || req.user?.id;
      const myReview = userId ? await storage.getMyVoyageReview(voyageId, userId) : null;
      res.json({ reviews, myReview: myReview ?? null });
    } catch (error) {
      res.status(500).json({ message: "Failed to get reviews" });
    }
  });

  app.post("/api/voyages/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { revieweeUserId, rating, comment } = req.body;
      if (!revieweeUserId || !rating) return res.status(400).json({ message: "revieweeUserId and rating required" });
      const reviewerUserId = req.user?.claims?.sub || req.user?.id;
      const existing = await storage.getMyVoyageReview(voyageId, reviewerUserId);
      if (existing) return res.status(409).json({ message: "Already reviewed" });
      const review = await storage.createVoyageReview({
        voyageId,
        reviewerUserId,
        revieweeUserId,
        rating: parseInt(rating),
        comment: comment || null,
      });
      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // ─── DIRECT MESSAGING ──────────────────────────────────────────────────────

  app.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const cnt = await storage.getUnreadMessageCount(req.user.claims.sub);
      res.json({ count: cnt });
    } catch (error) {
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  app.get("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const convs = await storage.getConversationsByUser(req.user.claims.sub);
      res.json(convs);
    } catch (error) {
      console.error("[messages] getConversationsByUser error:", error);
      res.status(500).json({ message: "Failed to get conversations" });
    }
  });

  app.post("/api/messages/start", isAuthenticated, async (req: any, res) => {
    try {
      const { targetUserId, voyageId, serviceRequestId, message } = req.body;
      if (!targetUserId || !message) return res.status(400).json({ message: "targetUserId and message required" });
      if (targetUserId === req.user.claims.sub) return res.status(400).json({ message: "Cannot message yourself" });
      const conv = await storage.getOrCreateConversation(
        req.user.claims.sub,
        targetUserId,
        voyageId ? parseInt(voyageId) : undefined,
        serviceRequestId ? parseInt(serviceRequestId) : undefined
      );
      const msg = await storage.createMessage({ conversationId: conv.id, senderId: req.user.claims.sub, content: message });
      await storage.createNotification({
        userId: targetUserId,
        type: "message",
        title: "Yeni Mesaj",
        message: message.length > 60 ? message.slice(0, 60) + "..." : message,
        link: `/messages/${conv.id}`,
      });
      res.status(201).json({ conversationId: conv.id, message: msg });
    } catch (error) {
      res.status(500).json({ message: "Failed to start conversation" });
    }
  });

  app.get("/api/messages/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.conversationId);
      const conv = await storage.getConversationById(id, req.user.claims.sub);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      res.json(conv);
    } catch (error) {
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  app.post("/api/messages/:conversationId/send", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const { content, messageType, fileUrl, fileName, fileSize, mentions } = req.body;
      if (!content?.trim() && !fileUrl) return res.status(400).json({ message: "content or file required" });
      if (fileSize && fileSize > 8 * 1024 * 1024) return res.status(400).json({ message: "File too large (max 8MB)" });
      const conv = await storage.getConversationById(conversationId, req.user.claims.sub);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      const msg = await storage.createMessage({
        conversationId,
        senderId: req.user.claims.sub,
        content: content || (fileName ? `[Dosya: ${fileName}]` : ""),
        messageType: messageType || "text",
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        mentions: mentions && Array.isArray(mentions) && mentions.length > 0 ? JSON.stringify(mentions) : null,
      });
      const receiverId = conv.user1Id === req.user.claims.sub ? conv.user2Id : conv.user1Id;
      const notifMessage = fileUrl
        ? `📎 ${fileName || "Dosya paylaşıldı"}`
        : (content.length > 60 ? content.slice(0, 60) + "..." : content);
      await storage.createNotification({
        userId: receiverId,
        type: "message",
        title: "Yeni Mesaj",
        message: notifMessage,
        link: `/messages/${conversationId}`,
      });
      // @mention notifications
      if (Array.isArray(mentions) && mentions.length > 0) {
        const senderUser = await storage.getUser(req.user.claims.sub);
        for (const mentionedId of mentions) {
          if (mentionedId !== req.user.claims.sub) {
            await storage.createNotification({
              userId: mentionedId,
              type: "mention",
              title: "Sizi etiketledi",
              message: `${senderUser?.name || "Bir kullanıcı"} mesajda sizi etiketledi`,
              link: `/messages/${conversationId}`,
            });
          }
        }
      }
      // E-posta bridge: auto-forward if enabled
      if (conv.externalEmailForward && conv.externalEmail) {
        const { sendMessageBridgeEmail } = await import("./email");
        const senderUser = await storage.getUser(req.user.claims.sub);
        sendMessageBridgeEmail(
          conv.externalEmail,
          conv.externalEmailName || conv.externalEmail,
          senderUser?.name || "VesselPDA Kullanıcısı",
          content || "",
          fileName || undefined
        ).catch((e: any) => console.error("[bridge] email failed:", e));
      }
      res.status(201).json(msg);
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.patch("/api/messages/:conversationId/read", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      await storage.markConversationRead(conversationId, req.user.claims.sub);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  app.patch("/api/conversations/:convId/external-email", isAuthenticated, async (req: any, res) => {
    try {
      const convId = parseInt(req.params.convId);
      const { email, name, forward } = req.body;
      const conv = await storage.getConversationById(convId, req.user.claims.sub);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      await storage.updateConversationExternalEmail(convId, email || null, name || null, !!forward);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update external email" });
    }
  });

  // ─── DIRECT NOMINATIONS ──────────────────────────────────────────────────────

  app.get("/api/nominations/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      const cnt = await storage.getPendingNominationCountForAgent(req.user.claims.sub);
      res.json({ count: cnt });
    } catch (error) {
      res.status(500).json({ message: "Failed to get pending count" });
    }
  });

  app.get("/api/nominations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const role = req.user.userRole || req.user.activeRole;
      const sent = await storage.getNominationsByNominator(userId);
      const received = await storage.getNominationsByAgent(userId);
      res.json({ sent, received });
    } catch (error) {
      res.status(500).json({ message: "Failed to get nominations" });
    }
  });

  app.post("/api/nominations", isAuthenticated, async (req: any, res) => {
    try {
      const { agentUserId, agentCompanyId, portId, vesselName, vesselId, purposeOfCall, eta, etd, notes } = req.body;
      if (!agentUserId || !portId || !vesselName || !purposeOfCall) {
        return res.status(400).json({ message: "agentUserId, portId, vesselName, purposeOfCall zorunludur" });
      }
      if (agentUserId === req.user.claims.sub) {
        return res.status(400).json({ message: "Kendinizi nomine edemezsiniz" });
      }
      const nom = await storage.createNomination({
        nominatorUserId: req.user.claims.sub,
        agentUserId,
        agentCompanyId: agentCompanyId ?? null,
        portId: parseInt(portId),
        vesselName,
        vesselId: vesselId ?? null,
        purposeOfCall,
        eta: eta ? new Date(eta) : null,
        etd: etd ? new Date(etd) : null,
        notes: notes ?? null,
      });
      // Notify agent (in-app)
      await storage.createNotification({
        userId: agentUserId,
        type: "nomination",
        title: "Yeni Nominasyon",
        message: `${req.user.name || "Bir armatör"} sizi ${vesselName} gemisi için nomine etti`,
        link: "/nominations",
      });

      // Notify agent (email)
      const agentUser = await storage.getUser(agentUserId);
      if (agentUser?.email) {
        const enriched = await storage.getNominationById(nom.id);
        sendNominationEmail({
          agentEmail: agentUser.email,
          agentCompanyName: enriched?.agentCompanyName || agentUser.name || agentUserId,
          portName: enriched?.portName || `Port #${portId}`,
          vesselName: vesselName,
          eta: eta ? new Date(eta).toLocaleString("tr-TR") : undefined,
          note: notes || undefined,
          shipownerName: req.user.name || undefined,
        }).catch(err => console.error("[email] Nomination email failed (non-blocking):", err));
      }

      res.status(201).json(nom);
    } catch (error) {
      res.status(500).json({ message: "Failed to create nomination" });
    }
  });

  app.get("/api/nominations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const nom = await storage.getNominationById(id);
      if (!nom) return res.status(404).json({ message: "Nomination not found" });
      if (nom.nominatorUserId !== req.user.claims.sub && nom.agentUserId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(nom);
    } catch (error) {
      res.status(500).json({ message: "Failed to get nomination" });
    }
  });

  app.patch("/api/nominations/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!["accepted", "declined"].includes(status)) {
        return res.status(400).json({ message: "status must be accepted or declined" });
      }
      const nom = await storage.getNominationById(id);
      if (!nom) return res.status(404).json({ message: "Nomination not found" });
      if (nom.agentUserId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
      if (nom.status !== "pending") return res.status(409).json({ message: "Already responded" });
      const updated = await storage.updateNominationStatus(id, status);
      // Notify nominator (in-app)
      const statusLabel = status === "accepted" ? "kabul etti" : "reddetti";
      await storage.createNotification({
        userId: nom.nominatorUserId,
        type: "nomination_response",
        title: "Nominasyon Yanıtlandı",
        message: `${nom.agentName || nom.agentCompanyName || "Acente"} nominasyonunuzu ${statusLabel}`,
        link: "/nominations",
      });

      // Notify nominator (email)
      const nominatorUser = await storage.getUser(nom.nominatorUserId);
      if (nominatorUser?.email) {
        sendNominationResponseEmail({
          nominatorEmail: nominatorUser.email,
          nominatorName: nominatorUser.name || "Sayın Kullanıcı",
          agentCompanyName: nom.agentCompanyName || nom.agentName || "Acente",
          status: status as "accepted" | "declined",
          portName: nom.portName || `Port #${nom.portId}`,
          vesselName: nom.vesselName,
          eta: nom.eta ? new Date(nom.eta).toLocaleString("tr-TR") : undefined,
          notes: nom.notes || undefined,
        }).catch(err => console.error("[email] Nomination response email failed (non-blocking):", err));
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to respond to nomination" });
    }
  });

  // ─── VESSEL CERTIFICATES ────────────────────────────────────────────────────

  app.get("/api/vessels/:vesselId/certificates", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const certs = await storage.getVesselCertificates(vesselId);
      res.json(certs);
    } catch {
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });

  app.post("/api/vessels/:vesselId/certificates", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const userId = req.user.claims.sub;
      const cert = await storage.createVesselCertificate({ ...req.body, vesselId, userId });
      res.status(201).json(cert);
    } catch {
      res.status(500).json({ message: "Failed to create certificate" });
    }
  });

  app.patch("/api/vessels/:vesselId/certificates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateVesselCertificate(id, req.body);
      if (!updated) return res.status(404).json({ message: "Certificate not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update certificate" });
    }
  });

  app.delete("/api/vessels/:vesselId/certificates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVesselCertificate(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete certificate" });
    }
  });

  app.get("/api/certificates/expiring", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const daysAhead = parseInt(req.query.days as string) || 30;
      const certs = await storage.getExpiringCertificates(userId, daysAhead);
      res.json(certs);
    } catch {
      res.status(500).json({ message: "Failed to fetch expiring certificates" });
    }
  });

  // ─── PORT CALL APPOINTMENTS ─────────────────────────────────────────────────

  app.get("/api/voyages/:voyageId/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.voyageId);
      const appointments = await storage.getPortCallAppointments(voyageId);
      res.json(appointments);
    } catch {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/voyages/:voyageId/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.voyageId);
      const userId = req.user.claims.sub;
      const appt = await storage.createPortCallAppointment({ ...req.body, voyageId, userId });
      res.status(201).json(appt);
    } catch {
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/voyages/:voyageId/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updatePortCallAppointment(id, req.body);
      if (!updated) return res.status(404).json({ message: "Appointment not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.delete("/api/voyages/:voyageId/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePortCallAppointment(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete appointment" });
    }
  });

  // ─── FIXTURES ───────────────────────────────────────────────────────────────

  app.get("/api/fixtures", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
      const result = isAdmin ? await storage.getAllFixtures() : await storage.getFixtures(userId);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to fetch fixtures" });
    }
  });

  app.post("/api/fixtures", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fixture = await storage.createFixture({ ...req.body, userId });
      res.status(201).json(fixture);
    } catch {
      res.status(500).json({ message: "Failed to create fixture" });
    }
  });

  app.get("/api/fixtures/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const fixture = await storage.getFixture(id);
      if (!fixture) return res.status(404).json({ message: "Fixture not found" });
      const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
      if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
      res.json(fixture);
    } catch {
      res.status(500).json({ message: "Failed to fetch fixture" });
    }
  });

  app.patch("/api/fixtures/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const fixture = await storage.getFixture(id);
      if (!fixture) return res.status(404).json({ message: "Fixture not found" });
      const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
      if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateFixture(id, req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update fixture" });
    }
  });

  app.delete("/api/fixtures/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const fixture = await storage.getFixture(id);
      if (!fixture) return res.status(404).json({ message: "Fixture not found" });
      const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
      if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteFixture(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete fixture" });
    }
  });

  // ─── CARGO POSITIONS ────────────────────────────────────────────────────────

  app.get("/api/cargo-positions", isAuthenticated, async (req: any, res) => {
    try {
      const positions = await storage.getCargoPositions();
      res.json(positions);
    } catch {
      res.status(500).json({ message: "Failed to fetch cargo positions" });
    }
  });

  app.get("/api/cargo-positions/mine", isAuthenticated, async (req: any, res) => {
    try {
      const positions = await storage.getMyCargoPositions(req.user.claims.sub);
      res.json(positions);
    } catch {
      res.status(500).json({ message: "Failed to fetch my cargo positions" });
    }
  });

  app.post("/api/cargo-positions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const pos = await storage.createCargoPosition({ ...req.body, userId });
      res.status(201).json(pos);

      if (pos.positionType === "cargo") {
        const allVessels = await storage.getAllVessels();
        const notifiedOwners = new Set<string>();
        for (const vessel of allVessels) {
          if (!vessel.userId || notifiedOwners.has(vessel.userId) || vessel.userId === userId) continue;
          notifiedOwners.add(vessel.userId);
          await storage.createNotification({
            userId: vessel.userId,
            type: "cargo_match",
            title: "Yeni Kargo İlanı",
            message: `${pos.cargoType || "Kargo"} ilanı: ${pos.loadingPort} → ${pos.dischargePort}`,
            link: "/cargo-positions",
          });
        }
      }
    } catch {
      res.status(500).json({ message: "Failed to create cargo position" });
    }
  });

  app.patch("/api/cargo-positions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateCargoPosition(id, req.body);
      if (!updated) return res.status(404).json({ message: "Position not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update cargo position" });
    }
  });

  app.delete("/api/cargo-positions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCargoPosition(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete cargo position" });
    }
  });

  // ─── FREIGHT INDICES (Yahoo Finance, 4h cache) ───────────────────────────────

  let freightIndexCache: { data: any; fetchedAt: number } | null = null;
  const FREIGHT_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

  const FREIGHT_FALLBACK = [
    { code: "BDI",  name: "Baltic Dry Index",          description: "Kuru Dökme Yük", value: 1245, change: 0, changePct: 0, previousClose: 1245 },
    { code: "BCTI", name: "Baltic Clean Tanker Index", description: "Temiz Tanker",   value: 731,  change: 0, changePct: 0, previousClose: 731  },
    { code: "BDTI", name: "Baltic Dirty Tanker Index", description: "Kirli Tanker",   value: 1089, change: 0, changePct: 0, previousClose: 1089 },
  ];

  async function fetchFreightIndices() {
    const tickers = ["^BDI", "^BCTI", "^BDTI"];
    const results = await Promise.all(tickers.map(async (ticker) => {
      try {
        const encoded = encodeURIComponent(ticker);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2d`;
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; VesselPDA/1.0)",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return null;
        const json = await resp.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return null;
        const code = ticker.replace("^", "");
        const fallback = FREIGHT_FALLBACK.find(f => f.code === code)!;
        return {
          code,
          name: fallback.name,
          description: fallback.description,
          value: Math.round(meta.regularMarketPrice),
          change: Math.round((meta.regularMarketPrice - meta.previousClose) * 100) / 100,
          changePct: Math.round(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 10000) / 100,
          previousClose: Math.round(meta.previousClose),
        };
      } catch {
        return null;
      }
    }));

    const succeeded = results.filter(Boolean);
    if (succeeded.length === 0) return null;

    return tickers.map((ticker, i) => results[i] || FREIGHT_FALLBACK.find(f => f.code === ticker.replace("^", ""))!);
  }

  app.get("/api/market/freight-indices", isAuthenticated, async (_req, res) => {
    try {
      const now = Date.now();
      const cacheValid = freightIndexCache && (now - freightIndexCache.fetchedAt) < FREIGHT_CACHE_TTL;

      if (cacheValid) {
        return res.json({ ...freightIndexCache!.data, cached: true });
      }

      const fresh = await fetchFreightIndices();
      const indices = fresh || FREIGHT_FALLBACK;
      const data = {
        indices,
        lastUpdated: new Date().toISOString(),
        source: fresh ? "Yahoo Finance" : "Fallback",
        cached: false,
      };

      if (fresh) freightIndexCache = { data, fetchedAt: now };

      res.json(data);
    } catch {
      res.json({ indices: FREIGHT_FALLBACK, lastUpdated: new Date().toISOString(), source: "Fallback", cached: false });
    }
  });

  // ─── BUNKER PRICES ───────────────────────────────────────────────────────────

  app.get("/api/market/bunker-prices", isAuthenticated, async (_req, res) => {
    try {
      const prices = await storage.getBunkerPrices();
      res.json(prices);
    } catch {
      res.status(500).json({ message: "Failed to fetch bunker prices" });
    }
  });

  app.post("/api/admin/bunker-prices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
      const price = await storage.upsertBunkerPrice({ ...req.body, updatedBy: userId });
      res.status(201).json(price);
    } catch {
      res.status(500).json({ message: "Failed to save bunker price" });
    }
  });

  app.patch("/api/admin/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      const price = await storage.upsertBunkerPrice({ ...req.body, updatedBy: userId });
      res.json(price);
    } catch {
      res.status(500).json({ message: "Failed to update bunker price" });
    }
  });

  app.delete("/api/admin/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      await storage.deleteBunkerPrice(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete bunker price" });
    }
  });

  // ─── DOCUMENT TEMPLATES ─────────────────────────────────────────────────────

  app.get("/api/document-templates", isAuthenticated, async (_req, res) => {
    try {
      const templates = await storage.getDocumentTemplates();
      res.json(templates);
    } catch {
      res.status(500).json({ message: "Failed to get templates" });
    }
  });

  app.post("/api/voyages/:id/documents/from-template", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const voyageId = parseInt(req.params.id);
      const { templateId } = req.body;
      if (!templateId) return res.status(400).json({ message: "templateId required" });

      const voyage = await storage.getVoyageById(voyageId);
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });

      const templates = await storage.getDocumentTemplates();
      const template = templates.find((t: any) => t.id === templateId);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const port = voyage.port || { name: "N/A" };
      const portName = typeof port === "object" ? (port.name || "N/A") : String(port);
      const formatDate = (d?: string | Date | null) => d ? new Date(d).toLocaleDateString("tr-TR") : "N/A";

      let content = template.content
        .replace(/\{\{vesselName\}\}/g, voyage.vesselName || "N/A")
        .replace(/\{\{imoNumber\}\}/g, voyage.imoNumber || "N/A")
        .replace(/\{\{port\}\}/g, portName)
        .replace(/\{\{grt\}\}/g, voyage.grt ? String(voyage.grt) : "N/A")
        .replace(/\{\{eta\}\}/g, formatDate(voyage.eta))
        .replace(/\{\{etd\}\}/g, formatDate(voyage.etd))
        .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("tr-TR"))
        .replace(/\{\{purposeOfCall\}\}/g, voyage.purposeOfCall || "N/A");

      const fileBase64 = Buffer.from(content).toString("base64");
      const doc = await storage.createVoyageDocument({
        voyageId,
        name: `${template.name} - ${voyage.vesselName || "Gemi"}`,
        docType: template.category.toLowerCase(),
        fileBase64: `data:text/html;base64,${fileBase64}`,
        notes: "Şablondan otomatik oluşturuldu",
        uploadedByUserId: userId,
        version: 1,
        templateId: template.id,
      });
      res.status(201).json(doc);
    } catch (err) {
      console.error("from-template error:", err);
      res.status(500).json({ message: "Failed to create document from template" });
    }
  });

  app.post("/api/voyages/:id/documents/:docId/sign", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const voyageId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      const { signatureText } = req.body;
      if (!signatureText) return res.status(400).json({ message: "signatureText required" });

      const voyage = await storage.getVoyageById(voyageId);
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });
      if (voyage.userId !== userId && voyage.agentUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      await storage.signVoyageDocument(docId, signatureText, new Date());
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to sign document" });
    }
  });

  app.post("/api/voyages/:id/documents/:docId/new-version", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const voyageId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);
      const { name, fileBase64, notes } = req.body;
      if (!fileBase64) return res.status(400).json({ message: "fileBase64 required" });

      const docs = await storage.getVoyageDocuments(voyageId);
      const parentDoc = docs.find((d: any) => d.id === docId);
      if (!parentDoc) return res.status(404).json({ message: "Document not found" });

      const newDoc = await storage.createNewDocumentVersion(parentDoc, { name: name || parentDoc.name, fileBase64, notes, uploadedByUserId: userId });
      res.status(201).json(newDoc);
    } catch {
      res.status(500).json({ message: "Failed to create new version" });
    }
  });

  // ─── INVOICES ────────────────────────────────────────────────────────────────

  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const items = await storage.getInvoicesByUser(userId);
      res.json(items);
    } catch {
      res.status(500).json({ message: "Failed to get invoices" });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { title, amount, currency, dueDate, notes, invoiceType, voyageId, proformaId, linkedProformaId } = req.body;
      if (!title || !amount) return res.status(400).json({ message: "title and amount required" });

      const invoice = await storage.createInvoice({
        createdByUserId: userId,
        title,
        amount: parseFloat(amount),
        currency: currency || "USD",
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        invoiceType: invoiceType || "invoice",
        voyageId: voyageId ? parseInt(voyageId) : null,
        proformaId: proformaId ? parseInt(proformaId) : null,
        linkedProformaId: linkedProformaId ? parseInt(linkedProformaId) : null,
      });
      res.status(201).json(invoice);
    } catch {
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id/pay", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { paidAt } = req.body;
      await storage.updateInvoiceStatus(id, "paid", paidAt ? new Date(paidAt) : new Date());
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to mark invoice paid" });
    }
  });

  app.patch("/api/invoices/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateInvoiceStatus(id, "cancelled");
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to cancel invoice" });
    }
  });

  // ─── PORT ALERTS ─────────────────────────────────────────────────────────────

  app.get("/api/port-alerts", async (req, res) => {
    try {
      const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
      const portName = req.query.portName as string | undefined;
      const alerts = await storage.getPortAlerts(portId, portName);
      res.json(alerts);
    } catch {
      res.status(500).json({ message: "Failed to get port alerts" });
    }
  });

  app.get("/api/admin/port-alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
      const alerts = await storage.getAllPortAlerts();
      res.json(alerts);
    } catch {
      res.status(500).json({ message: "Failed to get all port alerts" });
    }
  });

  app.post("/api/port-alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
      const { portId, portName, alertType, severity, title, message, isActive, startsAt, endsAt } = req.body;
      if (!portName || !title || !message) return res.status(400).json({ message: "portName, title, message required" });

      const alert = await storage.createPortAlert({
        portId: portId ? parseInt(portId) : null,
        portName,
        alertType: alertType || "other",
        severity: severity || "info",
        title,
        message,
        isActive: isActive !== false,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        createdByUserId: userId,
      });
      res.status(201).json(alert);
    } catch {
      res.status(500).json({ message: "Failed to create port alert" });
    }
  });

  app.patch("/api/port-alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      await storage.updatePortAlert(id, req.body);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to update port alert" });
    }
  });

  app.delete("/api/port-alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      await storage.deletePortAlert(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete port alert" });
    }
  });

  app.post("/api/ai/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { messages } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "messages array required" });
      }
      const validMessages = messages.filter(
        (m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      );
      if (validMessages.length === 0) {
        return res.status(400).json({ message: "No valid messages" });
      }
      const result = await handleAiChat(userId, validMessages);
      res.json(result);
    } catch (err: any) {
      console.error("AI chat error:", err);
      res.status(500).json({ message: "AI servisine bağlanılamadı" });
    }
  });

  return httpServer;
}
