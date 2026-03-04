import type { Express } from "express";
import { createServer, type Server } from "http";
import { authLimiter, generalLimiter, aiLimiter, uploadLimiter, searchLimiter } from "./middleware/rate-limit";
import { validateBody, validateQuery, validateParams, integerIdParam } from "./middleware/validate";
import { sanitizeInput, sanitizeFilename } from "./utils/sanitize";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import { sendNominationEmail, sendNominationResponseEmail, sendContactEmail, sendBidReceivedEmail, sendBidSelectedEmail, sendNewTenderEmail, sendForumReplyEmail, sendProformaEmail } from "./email";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes, authStorage } from "./replit_integrations/auth";
import { insertVesselSchema } from "@shared/schema";
import type { ProformaLineItem } from "@shared/schema";
import { calculateProforma, type CalculationInput } from "./proforma-calculator";
import { lookupPilotageFee, lookupTugboatFee, lookupMooringFee, lookupBerthingFee, lookupAgencyFee, lookupMarpolFee, lookupLcbFee, lookupSanitaryDuesFee, lookupChamberFreightShareFee, lookupChamberShippingFee, lookupLightDuesFee, lookupMiscExpenses, lookupSupervisionFee, type VesselCategory } from "./tariff-lookup";
import { startAISStream, getPositions, searchVessels, isConnected, getCacheSize } from "./ais-stream";
import { geocodeStats } from "./geocode-ports";
import { checkSanctions, getSanctionsStatus, loadSanctionsList } from "./sanctions";
import { db, pool } from "./db";
import { sql as drizzleSql } from "drizzle-orm";
import { handleAiChat } from "./anthropic";
import { getOrFetchRates, fetchTCMBRates } from "./exchange-rates";
import { logAction, getClientIp } from "./audit";
import { cache } from "./cache";
import { attachOrgContext } from "./middleware/org-context";
import { logOrgActivity } from "./utils/orgActivity";

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

const ALLOWED_FILE_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".svg", ".webp"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp",
]);

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_FILE_EXTENSIONS.has(ext) && ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG`));
    }
  },
});

// ── Request Body Validation Schemas ──────────────────────────────────────────

const vesselBodySchema = insertVesselSchema.omit({ userId: true }).extend({
  name: z.string().min(1).max(200),
  flag: z.string().min(1).max(100),
  vesselType: z.string().min(1).max(100),
  grt: z.coerce.number().positive(),
  nrt: z.coerce.number().positive(),
  dwt: z.coerce.number().positive().optional().nullable(),
  loa: z.coerce.number().positive().optional().nullable(),
  beam: z.coerce.number().positive().optional().nullable(),
  draft: z.coerce.number().positive().optional().nullable(),
  yearBuilt: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
});

const tenderBodySchema = z.object({
  portId: z.coerce.number().int().positive(),
  vesselName: z.string().min(1).max(200),
  flag: z.string().min(1).max(100),
  grt: z.coerce.number().positive(),
  nrt: z.coerce.number().positive(),
  cargoType: z.string().min(1).max(100),
  cargoQuantity: z.string().min(1).max(50),
  previousPort: z.string().min(1).max(200),
  expiryHours: z.coerce.number().refine(v => [24, 48].includes(v), "Must be 24 or 48"),
  description: z.string().max(2000).optional().nullable(),
  cargoInfo: z.string().max(2000).optional().nullable(),
  q88Base64: z.string().optional().nullable(),
});

const bidBodySchema = z.object({
  totalAmount: z.coerce.number().positive().optional().nullable(),
  currency: z.string().length(3).default("USD"),
  notes: z.string().max(2000).optional().nullable(),
  lineItems: z.array(z.any()).optional(),
});

const forumTopicBodySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(300),
  content: z.string().min(10, "Content must be at least 10 characters").max(20000),
  categoryId: z.coerce.number().int().positive(),
  isAnonymous: z.boolean().optional().default(false),
});

const forumReplyBodySchema = z.object({
  content: z.string().min(1, "Reply cannot be empty").max(10000),
});

const contactBodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().min(1).max(300),
  message: z.string().min(1).max(5000),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

  // ── Rate Limiting ──────────────────────────────────────────────────────────
  // MUST be applied after setupAuth() (so session/passport middleware is on
  // the stack and req.user is populated by the time skip functions run) but
  // BEFORE registerAuthRoutes() and all other route registrations, so that
  // rate limiters sit in front of every route handler in the middleware stack.
  app.use("/api/auth", authLimiter);           // 5 req/min — brute force guard
  app.use("/api/ai", aiLimiter);               // 10 req/min — costly AI calls
  app.use("/api/files", uploadLimiter);        // 20 req/min — file storage abuse
  app.use("/api/search", searchLimiter);       // 30 req/min — search/enumeration guard
  app.use("/api/vessel-track/search", searchLimiter);  // vessel search
  app.use("/api/vessels/lookup", searchLimiter);       // IMO lookup
  app.use("/api", generalLimiter);             // 100 req/min — baseline for all API routes

  registerAuthRoutes(app);

  // ── Organization routes ──────────────────────────────────────────────────
  const { default: organizationRouter } = await import("./routes/organizations");
  app.use("/api/organizations", organizationRouter);

  // ── Team Chat routes ──────────────────────────────────────────────────────
  const { default: teamChatRouter } = await import("./routes/team-chat");
  app.use("/api/organizations", teamChatRouter);

  app.patch("/api/team-messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const id = parseInt(req.params.id);
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "content required" });
      const { rows } = await pool.query(
        "UPDATE team_messages SET content = $1, is_edited = TRUE WHERE id = $2 AND sender_id = $3 RETURNING *",
        [content.trim(), id, userId]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found or not your message" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to edit message" }); }
  });

  app.delete("/api/team-messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const id = parseInt(req.params.id);
      const { rows } = await pool.query(
        "DELETE FROM team_messages WHERE id = $1 AND sender_id = $2 RETURNING id",
        [id, userId]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found or not your message" });
      res.json({ message: "Deleted" });
    } catch { res.status(500).json({ message: "Failed to delete message" }); }
  });

  startAISStream();

  authStorage.markExistingUsersVerified().catch((err) =>
    console.error("[auth] Failed to mark existing users verified:", err)
  );

  app.use("/uploads", (await import("express")).default.static(path.join(process.cwd(), "uploads")));

  // ─── GENERIC FILE UPLOAD ──────────────────────────────────────────────────────

  app.post("/api/files/upload", isAuthenticated, fileUpload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file provided" });
      const { uploadFile } = await import("./file-storage");
      const folder = (req.query.folder as string) || "documents";
      const allowedFolders = ["documents", "certificates", "crew"];
      const safeFolder = allowedFolders.includes(folder) ? folder : "documents";
      const safeName = sanitizeFilename(req.file.originalname);
      const url = uploadFile(req.file.buffer, safeName, safeFolder);
      res.json({
        url,
        fileName: safeName,
        fileSize: req.file.size,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Upload failed", error: e.message });
    }
  });

  async function isAdmin(req: any): Promise<boolean> {
    const userId = req.user?.claims?.sub;
    if (!userId) return false;
    const user = await storage.getUser(userId);
    return user?.userRole === "admin";
  }

  // Helper: get a single notification preference field for a user (returns DB default if no row)
  const NOTIF_DEFAULTS: Record<string, boolean> = {
    email_on_new_tender: true,
    email_on_bid_received: true,
    email_on_nomination: true,
    email_on_message: false,
    email_on_forum_reply: false,
    email_on_certificate_expiry: true,
    email_on_voyage_update: true,
    push_enabled: true,
    daily_digest: false,
  };
  async function getNotifPref(userId: string, field: string): Promise<boolean> {
    try {
      const r = await pool.query(
        `SELECT ${field} FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );
      if (r.rows.length === 0) return NOTIF_DEFAULTS[field] ?? true;
      return r.rows[0][field];
    } catch {
      return NOTIF_DEFAULTS[field] ?? true;
    }
  }

  app.get("/api/vessels", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (await isAdmin(req)) {
        const vessels = await storage.getAllVessels();
        return res.json(vessels);
      }
      const vessels = await storage.getVesselsByUser(userId, req.organizationId);
      res.json(vessels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vessels" });
    }
  });

  app.post("/api/vessels", isAuthenticated, attachOrgContext, validateBody(vesselBodySchema), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vessel = await storage.createVessel({ ...req.body, userId, organizationId: req.organizationId ?? null });
      if (req.organizationId) {
        const { rows } = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
        const name = `${rows[0]?.first_name || ""} ${rows[0]?.last_name || ""}`.trim() || "A user";
        logOrgActivity({ organizationId: req.organizationId, userId, action: "created_vessel", entityType: "vessel", entityId: vessel.id, description: `${name} added vessel ${vessel.name}` });
      }
      res.json(vessel);
    } catch (error) {
      res.status(500).json({ message: "Failed to create vessel" });
    }
  });

  app.patch("/api/vessels/:id", isAuthenticated, validateBody(vesselBodySchema.partial()), async (req: any, res) => {
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
        return res.json(await storage.searchPorts(q.trim(), country));
      }
      const cacheKey = country ? `ports:country:${country}` : "ports:top100";
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
      const results = country ? await storage.getPorts(undefined, country) : await storage.getPorts(100);
      cache.set(cacheKey, results, 3600);
      res.json(results);
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
    const cached = cache.get("exchange-rates");
    if (cached) return res.json(cached);
    try {
      const rates = await getOrFetchRates();
      cache.set("exchange-rates", rates, 30 * 60);
      res.json(rates);
    } catch (error: any) {
      console.error("Exchange rate fetch error:", error.message);
      res.status(502).json({ message: "Could not fetch live rates from TCMB. Please enter rates manually.", error: error.message });
    }
  });

  app.post("/api/exchange-rates/refresh", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const rates = await fetchTCMBRates();
      cache.invalidate("exchange-rates");
      res.json({ success: true, rates });
    } catch (error: any) {
      console.error("Exchange rate refresh error:", error.message);
      res.status(502).json({ message: "Could not fetch live rates from TCMB.", error: error.message });
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

  app.get("/api/proformas", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (await isAdmin(req)) {
        const allProformas = await storage.getAllProformas();
        return res.json(allProformas);
      }
      const proformas = await storage.getProformasByUser(userId, req.organizationId);
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

  app.post("/api/proformas/quick-estimate", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/proformas", isAuthenticated, attachOrgContext, async (req: any, res) => {
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
        organizationId: (req as any).organizationId ?? null,
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
      if ((req as any).organizationId) {
        const { rows: ur } = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
        const uname = `${ur[0]?.first_name || ""} ${ur[0]?.last_name || ""}`.trim() || "A user";
        logOrgActivity({ organizationId: (req as any).organizationId, userId, action: "created_proforma", entityType: "proforma", entityId: proforma.id, description: `${uname} created proforma ${proforma.referenceNumber}` });
      }

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
      logAction(userId, "delete", "proforma", id, null, getClientIp(req));
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
      logAction(userId, "create", "proforma", duplicated.id, { duplicatedFrom: id }, getClientIp(req));
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
      cache.invalidatePrefix("directory:");
      cache.invalidate("service-ports");
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
      cache.invalidatePrefix("directory:");
      cache.invalidate("service-ports");
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
      logAction(req.user?.claims?.sub, "approve", "company_profile", id, { companyName: profile.companyName }, getClientIp(req));
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

  // ─── ENHANCED ADMIN STATS (active voyages, pending approvals, today's txns) ───
  app.get("/api/admin/stats/enhanced", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const allUsers = await storage.getAllUsers();
      const pendingProfiles = await storage.getPendingCompanyProfiles();
      const today = new Date(); today.setHours(0, 0, 0, 0);

      // Active voyages (in_progress or scheduled)
      const voyagesRows = await db.execute(drizzleSql`SELECT id, status FROM voyages`);
      const voyages: any[] = (voyagesRows as any).rows ?? (voyagesRows as any);
      const activeVoyages = voyages.filter((v: any) => v.status === "in_progress" || v.status === "scheduled").length;

      // Today's transactions (proformas + voyages + service requests created today)
      const proformaRows = await db.execute(drizzleSql`SELECT id FROM proformas WHERE created_at >= ${today.toISOString()}`);
      const todayProformas = ((proformaRows as any).rows ?? (proformaRows as any)).length;
      const voyageTodayRows = await db.execute(drizzleSql`SELECT id FROM voyages WHERE created_at >= ${today.toISOString()}`);
      const todayVoyages = ((voyageTodayRows as any).rows ?? (voyageTodayRows as any)).length;
      const srRows = await db.execute(drizzleSql`SELECT id FROM service_requests WHERE created_at >= ${today.toISOString()}`);
      const todaySR = ((srRows as any).rows ?? (srRows as any)).length;
      const todayTransactions = todayProformas + todayVoyages + todaySR;

      // Pending verifications
      const pendingVerifRows = await db.execute(drizzleSql`SELECT id FROM company_profiles WHERE verification_status = 'pending'`);
      const pendingVerifications = ((pendingVerifRows as any).rows ?? (pendingVerifRows as any)).length;

      // System health
      const dbOk = true;
      const aisOk = !!process.env.AIS_STREAM_API_KEY;
      const teOk = !!process.env.TRADING_ECONOMICS_API_KEY;
      const resendOk = !!process.env.RESEND_API_KEY;

      res.json({
        totalUsers: allUsers.length,
        usersByRole: {
          shipowner: allUsers.filter((u: any) => u.userRole === "shipowner").length,
          agent: allUsers.filter((u: any) => u.userRole === "agent").length,
          provider: allUsers.filter((u: any) => u.userRole === "provider").length,
          broker: allUsers.filter((u: any) => u.userRole === "broker").length,
          admin: allUsers.filter((u: any) => u.userRole === "admin").length,
        },
        usersByPlan: {
          free: allUsers.filter((u: any) => u.subscriptionPlan === "free").length,
          standard: allUsers.filter((u: any) => u.subscriptionPlan === "standard").length,
          unlimited: allUsers.filter((u: any) => u.subscriptionPlan === "unlimited").length,
        },
        activeVoyages,
        todayTransactions,
        pendingApprovals: pendingProfiles.length,
        pendingVerifications,
        totalVoyages: voyages.length,
        systemHealth: { dbOk, aisOk, teOk, resendOk },
      });
    } catch (error) {
      console.error("[admin/stats/enhanced]", error);
      res.status(500).json({ message: "Failed to fetch enhanced stats" });
    }
  });

  // ─── ADMIN SYSTEM HEALTH ───────────────────────────────────────────────────
  app.get("/api/admin/system-health", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const [dbSizeRow, tableCountsRow] = await Promise.all([
        pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes`),
        pool.query(`SELECT
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM voyages) as voyages,
          (SELECT COUNT(*) FROM proformas) as proformas,
          (SELECT COUNT(*) FROM port_tenders) as tenders,
          (SELECT COUNT(*) FROM vessel_positions) as positions
        `),
      ]);
      const cacheStats = cache.stats();
      const dbSize = dbSizeRow.rows[0];
      const tableCounts = tableCountsRow.rows[0];
      res.json({
        db: { size: dbSize.size, bytes: parseInt(dbSize.bytes) },
        tables: {
          users: parseInt(tableCounts.users),
          voyages: parseInt(tableCounts.voyages),
          proformas: parseInt(tableCounts.proformas),
          tenders: parseInt(tableCounts.tenders),
          positions: parseInt(tableCounts.positions),
        },
        cache: cacheStats,
        ais: { connected: isConnected(), cacheSize: getCacheSize() },
        apiKeys: {
          ais: !!process.env.AIS_STREAM_API_KEY,
          tradingEconomics: !!process.env.TRADING_ECONOMICS_API_KEY,
          resend: !!process.env.RESEND_API_KEY,
          mapbox: !!process.env.VITE_MAPBOX_TOKEN,
        },
      });
    } catch (error) {
      console.error("[admin/system-health]", error);
      res.status(500).json({ message: "Failed to fetch system health" });
    }
  });

  app.get("/api/admin/hourly-activity", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const rows = await pool.query(`
        SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY hour ORDER BY hour
      `);
      const map: Record<number, number> = {};
      for (const r of rows.rows) map[r.hour] = r.count;
      const result = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map[h] ?? 0 }));
      res.json(result);
    } catch (error) {
      console.error("[admin/hourly-activity]", error);
      res.status(500).json({ message: "Failed to fetch hourly activity" });
    }
  });

  // ─── ADMIN ACTIVITY FEED ───────────────────────────────────────────────────
  app.get("/api/admin/activity", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const activities: any[] = [];

      // Recent proformas
      const pRows = await db.execute(drizzleSql`
        SELECT p.id, p.reference_number, p.created_at, u.first_name, u.last_name, u.email
        FROM proformas p LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC LIMIT 10
      `);
      const proformas: any[] = (pRows as any).rows ?? (pRows as any);
      for (const p of proformas) {
        activities.push({ type: "proforma", icon: "FileText", label: `Proforma oluşturuldu: ${p.reference_number || "#" + p.id}`, user: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email, createdAt: p.created_at });
      }

      // Recent voyages
      const vRows = await db.execute(drizzleSql`
        SELECT v.id, v.status, v.created_at, u.first_name, u.last_name, u.email
        FROM voyages v LEFT JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC LIMIT 8
      `);
      const vList: any[] = (vRows as any).rows ?? (vRows as any);
      for (const v of vList) {
        activities.push({ type: "voyage", icon: "Ship", label: `Sefer oluşturuldu (#${v.id})`, user: `${v.first_name || ""} ${v.last_name || ""}`.trim() || v.email, createdAt: v.created_at });
      }

      // Recent service requests
      const srRows2 = await db.execute(drizzleSql`
        SELECT s.id, s.service_type, s.created_at, u.first_name, u.last_name, u.email
        FROM service_requests s LEFT JOIN users u ON s.requester_id = u.id
        ORDER BY s.created_at DESC LIMIT 8
      `);
      const srList: any[] = (srRows2 as any).rows ?? (srRows2 as any);
      for (const s of srList) {
        activities.push({ type: "service_request", icon: "Wrench", label: `Hizmet talebi: ${s.service_type || "#" + s.id}`, user: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email, createdAt: s.created_at });
      }

      // Recent user registrations
      const uRows = await db.execute(drizzleSql`
        SELECT id, first_name, last_name, email, user_role, created_at FROM users ORDER BY created_at DESC LIMIT 8
      `);
      const uList: any[] = (uRows as any).rows ?? (uRows as any);
      for (const u of uList) {
        activities.push({ type: "user_register", icon: "UserPlus", label: `Yeni kayıt: ${u.user_role}`, user: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email, createdAt: u.created_at });
      }

      // Sort by date desc and take top 20
      activities.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json(activities.slice(0, 20));
    } catch (error) {
      console.error("[admin/activity]", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  // ─── ADMIN REPORTS ─────────────────────────────────────────────────────────
  app.get("/api/admin/reports/user-growth", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const next = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
        return { label: d.toLocaleString("tr-TR", { month: "short", year: "2-digit" }), start: d.toISOString(), end: next.toISOString() };
      });

      const result = await Promise.all(months.map(async (m) => {
        const rows = await db.execute(drizzleSql`
          SELECT user_role, COUNT(*) as cnt FROM users
          WHERE created_at >= ${m.start} AND created_at < ${m.end}
          GROUP BY user_role
        `);
        const list: any[] = (rows as any).rows ?? (rows as any);
        const byRole: any = { shipowner: 0, agent: 0, provider: 0, broker: 0, admin: 0 };
        let total = 0;
        for (const r of list) { byRole[r.user_role] = (byRole[r.user_role] || 0) + parseInt(r.cnt); total += parseInt(r.cnt); }
        return { month: m.label, total, ...byRole };
      }));

      res.json(result);
    } catch (error) {
      console.error("[admin/reports/user-growth]", error);
      res.status(500).json({ message: "Failed to fetch user growth" });
    }
  });

  app.get("/api/admin/reports/active-users", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const rows = await db.execute(drizzleSql`
        SELECT u.id, u.first_name, u.last_name, u.email, u.user_role, u.subscription_plan,
          (SELECT COUNT(*) FROM proformas WHERE user_id = u.id) as proforma_count,
          (SELECT COUNT(*) FROM voyages WHERE user_id = u.id) as voyage_count,
          (SELECT COUNT(*) FROM service_requests WHERE requester_id = u.id) as sr_count
        FROM users u
        WHERE u.user_role != 'admin'
        ORDER BY (
          (SELECT COUNT(*) FROM proformas WHERE user_id = u.id) +
          (SELECT COUNT(*) FROM voyages WHERE user_id = u.id) +
          (SELECT COUNT(*) FROM service_requests WHERE requester_id = u.id)
        ) DESC
        LIMIT 10
      `);
      const list: any[] = (rows as any).rows ?? (rows as any);
      res.json(list.map(r => ({
        id: r.id, name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email,
        email: r.email, role: r.user_role, plan: r.subscription_plan,
        proformaCount: parseInt(r.proforma_count || 0),
        voyageCount: parseInt(r.voyage_count || 0),
        srCount: parseInt(r.sr_count || 0),
        totalActivity: parseInt(r.proforma_count || 0) + parseInt(r.voyage_count || 0) + parseInt(r.sr_count || 0),
      })));
    } catch (error) {
      console.error("[admin/reports/active-users]", error);
      res.status(500).json({ message: "Failed to fetch active users" });
    }
  });

  // ─── ADMIN USER CRUD ───────────────────────────────────────────────────────
  app.delete("/api/admin/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const adminId = req.user?.claims?.sub || req.user?.id;
      if (req.params.id === adminId) return res.status(400).json({ message: "Kendi hesabınızı silemezsiniz" });
      await db.execute(drizzleSql`DELETE FROM users WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("[admin/delete-user]", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const { email, password, firstName, lastName, userRole, subscriptionPlan } = req.body;
      if (!email || !password || !firstName || !lastName || !userRole) {
        return res.status(400).json({ message: "Tüm alanlar zorunludur" });
      }
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();
      await db.execute(drizzleSql`
        INSERT INTO users (id, email, password_hash, first_name, last_name, user_role, active_role, subscription_plan, email_verified, role_confirmed, is_suspended, created_at)
        VALUES (${id}, ${email}, ${passwordHash}, ${firstName}, ${lastName}, ${userRole}, ${userRole}, ${subscriptionPlan || "free"}, true, true, false, NOW())
      `);
      res.json({ success: true, id });
    } catch (error: any) {
      console.error("[admin/create-user]", error);
      if (error?.code === "23505") return res.status(400).json({ message: "Bu e-posta zaten kayıtlı" });
      res.status(500).json({ message: "Kullanıcı oluşturulamadı" });
    }
  });

  app.patch("/api/admin/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const { userRole } = req.body;
      if (!["shipowner", "agent", "provider", "broker"].includes(userRole)) return res.status(400).json({ message: "Geçersiz rol" });
      await db.execute(drizzleSql`UPDATE users SET user_role = ${userRole}, active_role = ${userRole} WHERE id = ${req.params.id}`);
      const allUsers = await storage.getAllUsers();
      const updated = allUsers.find((u: any) => u.id === req.params.id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.get("/api/admin/users/:id/activity", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const uid = req.params.id;
      const activities: any[] = [];

      const pRows = await db.execute(drizzleSql`SELECT id, reference_number, created_at FROM proformas WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 5`);
      const proformas: any[] = (pRows as any).rows ?? (pRows as any);
      for (const p of proformas) activities.push({ type: "proforma", label: `Proforma: ${p.reference_number || "#" + p.id}`, createdAt: p.created_at });

      const vRows2 = await db.execute(drizzleSql`SELECT id, status, created_at FROM voyages WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 5`);
      const vList2: any[] = (vRows2 as any).rows ?? (vRows2 as any);
      for (const v of vList2) activities.push({ type: "voyage", label: `Sefer #${v.id} (${v.status})`, createdAt: v.created_at });

      const srRows3 = await db.execute(drizzleSql`SELECT id, service_type, created_at FROM service_requests WHERE requester_id = ${uid} ORDER BY created_at DESC LIMIT 5`);
      const srList2: any[] = (srRows3 as any).rows ?? (srRows3 as any);
      for (const s of srList2) activities.push({ type: "service_request", label: `Hizmet: ${s.service_type || "#" + s.id}`, createdAt: s.created_at });

      activities.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json(activities.slice(0, 15));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user activity" });
    }
  });

  // ─── ADMIN ANNOUNCE ────────────────────────────────────────────────────────
  app.post("/api/admin/announce", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const { title, message, targetRole } = req.body;
      if (!title || !message) return res.status(400).json({ message: "Başlık ve mesaj zorunludur" });

      const allUsers = await storage.getAllUsers();
      const targets = targetRole && targetRole !== "all"
        ? allUsers.filter((u: any) => u.userRole === targetRole && !u.isSuspended)
        : allUsers.filter((u: any) => u.userRole !== "admin" && !u.isSuspended);

      let sent = 0;
      for (const u of targets) {
        await storage.createNotification({ userId: (u as any).id, type: "system", title, message, link: "/" });
        sent++;
      }
      res.json({ success: true, sent });
    } catch (error) {
      console.error("[admin/announce]", error);
      res.status(500).json({ message: "Duyuru gönderilemedi" });
    }
  });

  // ─── ADMIN CONTENT MANAGEMENT ─────────────────────────────────────────────
  app.get("/api/admin/voyages", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const rows = await db.execute(drizzleSql`
        SELECT v.id, v.status, v.created_at, v.eta, v.etd,
          u.first_name, u.last_name, u.email, u.user_role,
          ves.name as vessel_name, ves.imo_number,
          p.name as port_name
        FROM voyages v
        LEFT JOIN users u ON v.user_id = u.id
        LEFT JOIN vessels ves ON v.vessel_id = ves.id
        LEFT JOIN ports p ON v.port_id = p.id
        ORDER BY v.created_at DESC
        LIMIT 100
      `);
      const list: any[] = (rows as any).rows ?? (rows as any);
      res.json(list);
    } catch (error) {
      console.error("[admin/voyages]", error);
      res.status(500).json({ message: "Failed to fetch voyages" });
    }
  });

  app.get("/api/admin/service-requests-list", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const rows = await db.execute(drizzleSql`
        SELECT s.id, s.service_type, s.status, s.description, s.created_at,
          u.first_name, u.last_name, u.email,
          p.name as port_name
        FROM service_requests s
        LEFT JOIN users u ON s.requester_id = u.id
        LEFT JOIN ports p ON s.port_id = p.id
        ORDER BY s.created_at DESC
        LIMIT 100
      `);
      const list: any[] = (rows as any).rows ?? (rows as any);
      res.json(list);
    } catch (error) {
      console.error("[admin/service-requests]", error);
      res.status(500).json({ message: "Failed to fetch service requests" });
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

  // ─── FLEETS ───────────────────────────────────────────────────────────────

  app.get("/api/fleets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const result = await pool.query(
        `SELECT f.*,
                COUNT(fv.vessel_id)::int AS vessel_count,
                COALESCE(ARRAY_AGG(fv.vessel_id) FILTER (WHERE fv.vessel_id IS NOT NULL), '{}') AS vessel_ids,
                COALESCE(ARRAY_AGG(v.mmsi) FILTER (WHERE v.mmsi IS NOT NULL AND v.mmsi <> ''), '{}') AS vessel_mmsis
         FROM fleets f
         LEFT JOIN fleet_vessels fv ON fv.fleet_id = f.id
         LEFT JOIN vessels v ON v.id = fv.vessel_id
         WHERE f.user_id = $1 AND f.is_active = true
         GROUP BY f.id
         ORDER BY f.created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch fleets" });
    }
  });

  app.post("/api/fleets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { name, description, color } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Fleet name is required" });
      const result = await pool.query(
        `INSERT INTO fleets (user_id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, name.trim(), description?.trim() || null, color || "#2563EB"]
      );
      res.json({ ...result.rows[0], vessel_count: 0, vessel_ids: [], vessel_mmsis: [] });
    } catch (error) {
      res.status(500).json({ message: "Failed to create fleet" });
    }
  });

  app.put("/api/fleets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { name, description, color } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Fleet name is required" });
      const result = await pool.query(
        `UPDATE fleets SET name = $1, description = $2, color = $3 WHERE id = $4 AND user_id = $5 RETURNING *`,
        [name.trim(), description?.trim() || null, color || "#2563EB", req.params.id, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to update fleet" });
    }
  });

  app.delete("/api/fleets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const result = await pool.query(
        `DELETE FROM fleets WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId]
      );
      if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: "Fleet not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete fleet" });
    }
  });

  app.post("/api/fleets/:id/vessels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { vesselId } = req.body;
      if (!vesselId) return res.status(400).json({ message: "vesselId is required" });
      const fleet = await pool.query("SELECT id FROM fleets WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
      if (fleet.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
      await pool.query(
        `INSERT INTO fleet_vessels (fleet_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, vesselId]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to add vessel to fleet" });
    }
  });

  app.delete("/api/fleets/:id/vessels/:vesselId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const fleet = await pool.query("SELECT id FROM fleets WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
      if (fleet.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
      await pool.query(
        `DELETE FROM fleet_vessels WHERE fleet_id = $1 AND vessel_id = $2`,
        [req.params.id, req.params.vesselId]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove vessel from fleet" });
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
    const cached = cache.get("service-ports");
    if (cached) return res.json(cached);
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

      cache.set("service-ports", result, 30 * 60);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service ports" });
    }
  });

  app.get("/api/directory", async (req, res) => {
    try {
      const companyType = req.query.type as string | undefined;
      const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
      const cacheKey = `directory:${companyType ?? "all"}:${portId ?? "all"}`;
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
      const profiles = await storage.getPublicCompanyProfiles({ companyType, portId });
      // Attach avgRating and reviewCount for agent profiles
      const agentProfiles = profiles.filter(p => p.companyType === "agent");
      let result: any[];
      if (agentProfiles.length > 0) {
        const reviewsMap = new Map<number, { sum: number; count: number }>();
        await Promise.all(agentProfiles.map(async (p) => {
          const reviews = await storage.getReviewsByCompany(p.id);
          if (reviews.length > 0) {
            const sum = reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
            reviewsMap.set(p.id, { sum, count: reviews.length });
          }
        }));
        result = profiles.map(p => {
          const rating = reviewsMap.get(p.id);
          return rating
            ? { ...p, avgRating: Math.round((rating.sum / rating.count) * 10) / 10, reviewCount: rating.count }
            : { ...p, avgRating: null, reviewCount: 0 };
        });
      } else {
        result = profiles.map(p => ({ ...p, avgRating: null, reviewCount: 0 }));
      }
      cache.set(cacheKey, result, 10 * 60);
      res.json(result);
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

  // ─── GLOBAL SEARCH ─────────────────────────────────────────────────────────

  app.get("/api/search", isAuthenticated, async (req: any, res) => {
    const q = ((req.query.q as string) || "").trim();
    const type = (req.query.type as string) || "all";
    if (q.length < 2) return res.json({ vessels: [], ports: [], proformas: [], voyages: [], directory: [], forum: [], tenders: [], fixtures: [] });

    const userId = req.user?.claims?.sub || req.user?.id;
    const like = `%${q}%`;

    try {
      const run = async (sql: string, params: any[]) => {
        const r = await pool.query(sql, params);
        return r.rows;
      };

      const want = (cat: string) => type === "all" || type === cat;

      const [vessels, ports, proformas, voyages, directory, forum, tenders, fixtures] = await Promise.all([
        want("vessels")   ? run(`SELECT id, name, imo_number AS "imoNumber", flag, vessel_type AS "vesselType" FROM vessels WHERE user_id=$1 AND (name ILIKE $2 OR imo_number ILIKE $2) ORDER BY name LIMIT 5`, [userId, like]) : [],
        want("ports")     ? run(`SELECT id, name, country, code FROM ports WHERE name ILIKE $1 OR code ILIKE $1 ORDER BY name LIMIT 5`, [like]) : [],
        want("proformas") ? run(`SELECT id, reference_number AS "referenceNumber", to_company AS "toCompany", status, created_at AS "createdAt" FROM proformas WHERE user_id=$1 AND (reference_number ILIKE $2 OR to_company ILIKE $2) ORDER BY created_at DESC LIMIT 5`, [userId, like]) : [],
        want("voyages")   ? run(`SELECT id, vessel_name AS "vesselName", status, port_id AS "portId" FROM voyages WHERE (user_id=$1 OR agent_user_id=$1) AND vessel_name ILIKE $2 ORDER BY created_at DESC LIMIT 5`, [userId, like]) : [],
        want("directory") ? run(`SELECT id, company_name AS "companyName", company_type AS "companyType", city, country FROM company_profiles WHERE is_active=true AND company_name ILIKE $1 ORDER BY company_name LIMIT 5`, [like]) : [],
        want("forum")     ? run(`SELECT id, title, reply_count AS "replyCount" FROM forum_topics WHERE title ILIKE $1 ORDER BY last_activity_at DESC LIMIT 5`, [like]) : [],
        want("tenders")   ? run(`SELECT id, vessel_name AS "vesselName", status, created_at AS "createdAt" FROM port_tenders WHERE vessel_name ILIKE $1 ORDER BY created_at DESC LIMIT 5`, [like]) : [],
        want("fixtures")  ? run(`SELECT id, vessel_name AS "vesselName", cargo_type AS "cargoType", status FROM fixtures WHERE user_id=$1 AND (vessel_name ILIKE $2 OR cargo_type ILIKE $2) ORDER BY created_at DESC LIMIT 5`, [userId, like]) : [],
      ]);

      res.json({ vessels, ports, proformas, voyages, directory, forum, tenders, fixtures });
    } catch (err) {
      console.error("[search]", err);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    const cached = cache.get("stats");
    if (cached) return res.json(cached);
    try {
      const [users, proformas, companies] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProformas(),
        storage.getAllCompanyProfiles(),
      ]);
      const data = {
        userCount: users.length,
        proformaCount: proformas.length,
        companyCount: companies.length,
      };
      cache.set("stats", data, 5 * 60);
      res.json(data);
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
    const cached = cache.get("forum:categories");
    if (cached) return res.json(cached);
    try {
      const categories = await storage.getForumCategories();
      cache.set("forum:categories", categories, 3600);
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

  app.post("/api/forum/topics", isAuthenticated, validateBody(forumTopicBodySchema), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, content, categoryId, isAnonymous } = req.body;

      const topic = await storage.createForumTopic({
        userId,
        title: sanitizeInput(title).trim(),
        content: sanitizeInput(content).trim(),
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

  app.post("/api/forum/topics/:id/replies", isAuthenticated, validateBody(forumReplyBodySchema), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.id);
      const { content } = req.body;

      const topic = await storage.getForumTopic(topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });

      if (topic.isLocked) {
        return res.status(403).json({ message: "This topic is locked" });
      }

      const reply = await storage.createForumReply({
        topicId,
        userId,
        content: sanitizeInput(content).trim(),
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
          // Send email notification to topic author (check preferences)
          if (topicAuthor?.email) {
            getNotifPref(topic.userId, "email_on_forum_reply").then(allowed => {
              if (!allowed) return;
              const preview = content.trim().slice(0, 200) + (content.trim().length > 200 ? "..." : "");
              sendForumReplyEmail({
                toEmail: topicAuthor.email,
                topicTitle: topic.title,
                topicId,
                replyAuthor: replierName,
                replyPreview: preview,
              }).catch(() => {});
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

  app.post("/api/tenders", isAuthenticated, validateBody(tenderBodySchema), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;
      if (effectiveRole !== "shipowner") {
        return res.status(403).json({ message: "Only shipowners and brokers can create tenders" });
      }

      const { portId, vesselName, description, cargoInfo, expiryHours, grt, nrt, flag, cargoType, cargoQuantity, previousPort, q88Base64 } = req.body;

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

      logAction(userId, "create", "tender", tender.id, { portId: Number(portId), vesselName, cargoType, expiryHours: Number(expiryHours) }, getClientIp(req));
      const agents = await storage.getAgentsByPort(Number(portId));
      res.json({ tender, agentCount: agents.length });

      // Notify agents serving this port — async, non-blocking
      try {
        const port = await storage.getPort(Number(portId));
        const agentUsers = await Promise.all(agents.slice(0, 50).map((a: any) => storage.getUser(a.userId)));
        for (const agentUser of agentUsers) {
          if (agentUser?.email && agentUser.id) {
            getNotifPref(agentUser.id, "email_on_new_tender").then(allowed => {
              if (!allowed) return;
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
            }).catch(() => {});
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
      logAction(userId, "delete", "tender", tenderId, { status: "cancelled" }, getClientIp(req));
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

      logAction(userId, "create", "tender_bid", bid.id, { tenderId, totalAmount, currency }, getClientIp(req));
      res.json(bid);

      // Notify tender owner — async, non-blocking
      try {
        const owner = await storage.getUser(tender.userId);
        const port = await storage.getPort(tender.portId);
        const portName = (port as any)?.name || `Port #${tender.portId}`;
        const agentName = profile?.companyName || user.firstName || "An agent";
        if (owner?.email && owner.id) {
          const sendBid = await getNotifPref(owner.id, "email_on_bid_received");
          if (sendBid) {
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
      logAction(userId, "select", "tender_bid", bidId, { tenderId, selectedBidId: bidId }, getClientIp(req));
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

  // ── VESSEL POSITION HISTORY ────────────────────────────────────────────────

  app.get("/api/vessel-positions/:mmsi/latest", isAuthenticated, async (req, res) => {
    try {
      const { mmsi } = req.params;
      const result = await pool.query(
        `SELECT * FROM vessel_positions WHERE mmsi = $1 ORDER BY timestamp DESC LIMIT 1`,
        [mmsi]
      );
      res.json(result.rows[0] || null);
    } catch {
      res.status(500).json({ message: "Failed to fetch latest position" });
    }
  });

  app.get("/api/vessel-positions/:mmsi", isAuthenticated, async (req, res) => {
    try {
      const { mmsi } = req.params;
      const days = Math.min(parseInt(req.query.days as string) || 7, 30);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await pool.query(
        `SELECT * FROM vessel_positions WHERE mmsi = $1 AND timestamp >= $2 ORDER BY timestamp DESC`,
        [mmsi, cutoff]
      );
      res.json(result.rows);
    } catch {
      res.status(500).json({ message: "Failed to fetch position history" });
    }
  });

  app.get("/api/vessel-track/history/:mmsi", isAuthenticated, async (req, res) => {
    try {
      const { mmsi } = req.params;
      const days = Math.min(parseInt(req.query.days as string) || 1, 30);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await pool.query(
        `SELECT latitude, longitude, speed, course, heading, navigation_status, destination, timestamp
         FROM vessel_positions WHERE mmsi = $1 AND timestamp >= $2 ORDER BY timestamp ASC`,
        [mmsi, cutoff]
      );
      const rows = result.rows;
      const pointFeatures = rows.map((r: any) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.longitude, r.latitude] },
        properties: {
          speed: r.speed,
          course: r.course,
          heading: r.heading,
          status: r.navigation_status,
          destination: r.destination,
          timestamp: r.timestamp,
        },
      }));
      const lineCoords = rows.map((r: any) => [r.longitude, r.latitude]);
      res.json({
        type: "FeatureCollection",
        count: rows.length,
        features: pointFeatures,
        line: lineCoords.length >= 2
          ? { type: "Feature", geometry: { type: "LineString", coordinates: lineCoords }, properties: {} }
          : null,
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch vessel track history" });
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

  // ─── NOTIFICATION PREFERENCES ────────────────────────────────────────────────

  app.get("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const r = await pool.query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );
      if (r.rows.length === 0) {
        res.json({ userId, ...NOTIF_DEFAULTS });
      } else {
        const row = r.rows[0];
        res.json({
          userId: row.user_id,
          emailOnNewTender: row.email_on_new_tender,
          emailOnBidReceived: row.email_on_bid_received,
          emailOnNomination: row.email_on_nomination,
          emailOnMessage: row.email_on_message,
          emailOnForumReply: row.email_on_forum_reply,
          emailOnCertificateExpiry: row.email_on_certificate_expiry,
          emailOnVoyageUpdate: row.email_on_voyage_update,
          pushEnabled: row.push_enabled,
          dailyDigest: row.daily_digest,
        });
      }
    } catch (err) {
      console.error("Notification prefs fetch error:", err);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.put("/api/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const {
        emailOnNewTender, emailOnBidReceived, emailOnNomination,
        emailOnMessage, emailOnForumReply, emailOnCertificateExpiry,
        emailOnVoyageUpdate, pushEnabled, dailyDigest,
      } = req.body;

      await pool.query(`
        INSERT INTO notification_preferences
          (user_id, email_on_new_tender, email_on_bid_received, email_on_nomination,
           email_on_message, email_on_forum_reply, email_on_certificate_expiry,
           email_on_voyage_update, push_enabled, daily_digest, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          email_on_new_tender         = EXCLUDED.email_on_new_tender,
          email_on_bid_received       = EXCLUDED.email_on_bid_received,
          email_on_nomination         = EXCLUDED.email_on_nomination,
          email_on_message            = EXCLUDED.email_on_message,
          email_on_forum_reply        = EXCLUDED.email_on_forum_reply,
          email_on_certificate_expiry = EXCLUDED.email_on_certificate_expiry,
          email_on_voyage_update      = EXCLUDED.email_on_voyage_update,
          push_enabled                = EXCLUDED.push_enabled,
          daily_digest                = EXCLUDED.daily_digest,
          updated_at                  = NOW()
      `, [
        userId,
        emailOnNewTender  ?? true,
        emailOnBidReceived ?? true,
        emailOnNomination  ?? true,
        emailOnMessage     ?? false,
        emailOnForumReply  ?? false,
        emailOnCertificateExpiry ?? true,
        emailOnVoyageUpdate ?? true,
        pushEnabled ?? true,
        dailyDigest ?? false,
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error("Notification prefs update error:", err);
      res.status(500).json({ message: "Failed to update preferences" });
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

  app.get("/api/voyages", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const role = req.user?.activeRole || req.user?.userRole || "shipowner";
      const voyageList = await storage.getVoyagesByUser(userId, role, req.organizationId);
      res.json(voyageList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch voyages" });
    }
  });

  app.post("/api/voyages", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const data = { ...req.body, userId, organizationId: req.organizationId ?? null };
      if (data.eta) data.eta = new Date(data.eta);
      if (data.etd) data.etd = new Date(data.etd);
      const voyage = await storage.createVoyage(data);
      logAction(userId, "create", "voyage", voyage.id, { portId: voyage.portId, vesselName: voyage.vesselName, status: voyage.status }, getClientIp(req));
      if (req.organizationId) {
        const { rows } = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
        const name = `${rows[0]?.first_name || ""} ${rows[0]?.last_name || ""}`.trim() || "A user";
        logOrgActivity({ organizationId: req.organizationId, userId, action: "created_voyage", entityType: "voyage", entityId: voyage.id, description: `${name} created voyage for ${voyage.vesselName || "vessel"}` });
      }
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
      const uid = req.user?.claims?.sub || req.user?.id;
      logAction(uid, "update", "voyage", id, { newStatus: status }, getClientIp(req));
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
      const { name, docType, fileBase64, fileUrl, fileName, fileSize, notes } = req.body;
      if (!name || (!fileBase64 && !fileUrl)) return res.status(400).json({ message: "name and file required" });
      const doc = await storage.createVoyageDocument({
        voyageId,
        name,
        docType: docType || "other",
        fileBase64: fileBase64 || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
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

  // ─── VOYAGE TIMELINE ────────────────────────────────────────────────────────

  app.get("/api/voyages/:id/timeline", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const voyage = await storage.getVoyageById(voyageId);
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });

      const [docs, checklists] = await Promise.all([
        storage.getVoyageDocuments(voyageId),
        pool.query(
          `SELECT id, title, is_completed, completed_at, created_at FROM voyage_checklists WHERE voyage_id = $1 ORDER BY created_at ASC`,
          [voyageId]
        ).then(r => r.rows),
      ]);

      const events: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        timestamp: string | null;
        status: "completed" | "active" | "pending";
        icon: string;
      }> = [];

      // 1. Voyage created
      events.push({
        id: "voyage_created",
        type: "voyage_created",
        title: "Voyage Created",
        description: `Port call for ${voyage.vesselName || "vessel"} was created`,
        timestamp: voyage.createdAt ? new Date(voyage.createdAt).toISOString() : null,
        status: "completed",
        icon: "anchor",
      });

      // 2. ETA / NOR
      if (voyage.eta) {
        const etaPast = new Date(voyage.eta) <= new Date();
        events.push({
          id: "nor_given",
          type: "nor",
          title: "Notice of Readiness (NOR)",
          description: `Expected: ${new Date(voyage.eta).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
          timestamp: new Date(voyage.eta).toISOString(),
          status: etaPast ? "completed" : voyage.status === "planned" ? "pending" : "active",
          icon: "radio",
        });
      }

      // 3. Berthing (active status)
      const berthingAt = voyage.status === "active" || voyage.status === "completed"
        ? voyage.createdAt
        : null;
      if (voyage.status !== "planned") {
        events.push({
          id: "berthed",
          type: "berthing",
          title: "Vessel Berthed",
          description: `Vessel arrived at port and berthed`,
          timestamp: berthingAt ? new Date(berthingAt).toISOString() : null,
          status: voyage.status === "completed" ? "completed" : "active",
          icon: "ship",
        });
      }

      // 4. Loading / Discharging started
      if (voyage.status === "active" || voyage.status === "completed") {
        const purpose = voyage.purposeOfCall || "Loading";
        events.push({
          id: "cargo_started",
          type: "cargo_start",
          title: `${purpose} Started`,
          description: `${purpose} operations commenced`,
          timestamp: null,
          status: voyage.status === "completed" ? "completed" : "active",
          icon: purpose === "Loading" ? "upload" : "download",
        });
      }

      // 5. Completed checklist items (sorted by completedAt)
      const completedChecks = checklists
        .filter((c: any) => c.is_completed && c.completed_at)
        .sort((a: any, b: any) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());

      for (const item of completedChecks) {
        events.push({
          id: `checklist_${item.id}`,
          type: "checklist",
          title: "Checklist Item Completed",
          description: item.title,
          timestamp: new Date(item.completed_at).toISOString(),
          status: "completed",
          icon: "check",
        });
      }

      // 6. Documents uploaded (sorted by createdAt)
      const sortedDocs = [...docs].sort(
        (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      for (const doc of sortedDocs) {
        events.push({
          id: `doc_${doc.id}`,
          type: "document",
          title: "Document Uploaded",
          description: doc.name,
          timestamp: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
          status: "completed",
          icon: "file",
        });
      }

      // 7. Voyage completed / ETD
      if (voyage.status === "completed") {
        events.push({
          id: "voyage_completed",
          type: "voyage_completed",
          title: "Voyage Completed",
          description: "Port call successfully completed",
          timestamp: voyage.etd ? new Date(voyage.etd).toISOString() : null,
          status: "completed",
          icon: "flag",
        });
      } else if (voyage.etd) {
        events.push({
          id: "etd_planned",
          type: "etd",
          title: "Planned Departure (ETD)",
          description: `Expected: ${new Date(voyage.etd).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
          timestamp: new Date(voyage.etd).toISOString(),
          status: "pending",
          icon: "flag",
        });
      }

      // Sort all events chronologically (null timestamps go to end)
      events.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      res.json(events);
    } catch (error) {
      console.error("Timeline error:", error);
      res.status(500).json({ message: "Failed to build timeline" });
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
      const userId = req.user?.claims?.sub || req.user?.id;
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

  // ─── VESSEL CREW ─────────────────────────────────────────────────────────────

  app.get("/api/vessels/:vesselId/crew", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const crew = await storage.getVesselCrew(vesselId);
      res.json(crew);
    } catch {
      res.status(500).json({ message: "Failed to fetch crew" });
    }
  });

  app.post("/api/vessels/:vesselId/crew", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const userId = req.user?.claims?.sub || req.user?.id;
      const member = await storage.createVesselCrewMember({ ...req.body, vesselId, userId });
      res.status(201).json(member);
    } catch {
      res.status(500).json({ message: "Failed to create crew member" });
    }
  });

  app.patch("/api/vessels/:vesselId/crew/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateVesselCrewMember(id, req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update crew member" });
    }
  });

  app.delete("/api/vessels/:vesselId/crew/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVesselCrewMember(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete crew member" });
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

  // ─── VOYAGE PORT CALLS ──────────────────────────────────────────────────────

  async function canAccessVoyagePc(userId: string, voyageId: number): Promise<boolean> {
    const { rows: aRows } = await pool.query("SELECT user_role FROM users WHERE id = $1", [userId]);
    if (aRows[0]?.user_role === "admin") return true;
    const { rows } = await pool.query(`SELECT user_id, agent_user_id, organization_id FROM voyages WHERE id = $1`, [voyageId]);
    if (!rows.length) return false;
    const v = rows[0];
    if (v.user_id === userId || v.agent_user_id === userId) return true;
    if (v.organization_id) {
      const { rows: om } = await pool.query("SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true", [v.organization_id, userId]);
      if (om.length > 0) return true;
    }
    const { rows: col } = await pool.query(
      `SELECT 1 FROM voyage_collaborators vc WHERE vc.voyage_id = $1 AND vc.status = 'accepted'
       AND (vc.user_id = $2 OR vc.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = $2 AND is_active = true))`,
      [voyageId, userId]
    );
    return col.length > 0;
  }

  app.get("/api/voyages/:id/port-calls", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { rows } = await pool.query(
        `SELECT vpc.*, p.name AS port_name, p.country AS port_country, p.code AS port_locode,
           u.first_name AS agent_first_name, u.last_name AS agent_last_name
         FROM voyage_port_calls vpc
         LEFT JOIN ports p ON p.id = vpc.port_id
         LEFT JOIN users u ON u.id = vpc.agent_user_id
         WHERE vpc.voyage_id = $1 ORDER BY vpc.port_call_order ASC, vpc.id ASC`,
        [voyageId]
      );
      res.json(rows);
    } catch (err) {
      console.error("GET port-calls error:", err);
      res.status(500).json({ message: "Failed to fetch port calls" });
    }
  });

  app.post("/api/voyages/:id/port-calls", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const userId = req.user?.claims?.sub;
      const canAccess = await canAccessVoyagePc(userId, voyageId);
      if (!canAccess) return res.status(403).json({ message: "Access denied" });
      const { portId, portCallOrder, portCallType, status, eta, etd, berthName, terminalName, cargoType, cargoQuantity, cargoUnit, agentUserId, notes, organizationId } = req.body;
      if (!portId) return res.status(400).json({ message: "portId is required" });
      const { rows: countRows } = await pool.query("SELECT COALESCE(MAX(port_call_order),0)+1 AS next_order FROM voyage_port_calls WHERE voyage_id = $1", [voyageId]);
      const nextOrder = portCallOrder || countRows[0].next_order;
      const { rows } = await pool.query(
        `INSERT INTO voyage_port_calls (voyage_id, port_id, port_call_order, port_call_type, status, eta, etd, berth_name, terminal_name, cargo_type, cargo_quantity, cargo_unit, agent_user_id, notes, organization_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [voyageId, portId, nextOrder, portCallType || "discharging", status || "planned",
         eta ? new Date(eta) : null, etd ? new Date(etd) : null,
         berthName || null, terminalName || null, cargoType || null,
         cargoQuantity || null, cargoUnit || "MT", agentUserId || null, notes || null, organizationId || null]
      );
      const { rows: allCalls } = await pool.query(`SELECT p.name FROM voyage_port_calls vpc JOIN ports p ON p.id = vpc.port_id WHERE vpc.voyage_id = $1 ORDER BY vpc.port_call_order`, [voyageId]);
      const loadPortSummary = allCalls.map((r: any) => r.name).join(" → ");
      await pool.query("UPDATE voyages SET load_port = $1, voyage_type = CASE WHEN $2::int > 1 THEN 'multi' ELSE voyage_type END WHERE id = $3", [loadPortSummary, allCalls.length, voyageId]);
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("POST port-call error:", err);
      res.status(500).json({ message: "Failed to create port call" });
    }
  });

  app.patch("/api/voyages/:id/port-calls/:portCallId", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const portCallId = parseInt(req.params.portCallId);
      const userId = req.user?.claims?.sub;
      const canAccess = await canAccessVoyagePc(userId, voyageId);
      if (!canAccess) return res.status(403).json({ message: "Access denied" });
      const fields: string[] = [];
      const vals: any[] = [];
      let p = 1;
      const allowed = ["port_call_type","status","eta","etd","ata","atd","berth_name","terminal_name","cargo_type","cargo_quantity","cargo_unit","agent_user_id","notes","port_call_order"];
      const keyMap: Record<string, string> = { portCallType:"port_call_type", berthName:"berth_name", terminalName:"terminal_name", cargoType:"cargo_type", cargoQuantity:"cargo_quantity", cargoUnit:"cargo_unit", agentUserId:"agent_user_id", portCallOrder:"port_call_order" };
      for (const [k, v] of Object.entries(req.body)) {
        const col = keyMap[k] || k;
        if (!allowed.includes(col)) continue;
        const parsedVal = ["eta","etd","ata","atd"].includes(col) && v ? new Date(v as string) : v;
        fields.push(`${col} = $${p++}`); vals.push(parsedVal);
      }
      if (!fields.length) return res.status(400).json({ message: "No valid fields" });
      vals.push(portCallId, voyageId);
      const { rows } = await pool.query(`UPDATE voyage_port_calls SET ${fields.join(", ")} WHERE id = $${p++} AND voyage_id = $${p} RETURNING *`, vals);
      if (!rows.length) return res.status(404).json({ message: "Port call not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("PATCH port-call error:", err);
      res.status(500).json({ message: "Failed to update port call" });
    }
  });

  app.patch("/api/voyages/:id/port-calls/:portCallId/status", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const portCallId = parseInt(req.params.portCallId);
      const { status } = req.body;
      const VALID = ["planned","approaching","at_anchor","berthed","operations","completed","skipped"];
      if (!VALID.includes(status)) return res.status(400).json({ message: "Invalid status" });
      const { rows } = await pool.query("UPDATE voyage_port_calls SET status = $1 WHERE id = $2 AND voyage_id = $3 RETURNING *", [status, portCallId, voyageId]);
      if (!rows.length) return res.status(404).json({ message: "Port call not found" });
      if (status === "berthed" || status === "operations") {
        await pool.query("UPDATE voyages SET current_port_call_id = $1 WHERE id = $2", [portCallId, voyageId]);
      }
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: "Failed to update port call status" });
    }
  });

  app.delete("/api/voyages/:id/port-calls/:portCallId", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const portCallId = parseInt(req.params.portCallId);
      const userId = req.user?.claims?.sub;
      const canAccess = await canAccessVoyagePc(userId, voyageId);
      if (!canAccess) return res.status(403).json({ message: "Access denied" });
      await pool.query("DELETE FROM voyage_port_calls WHERE id = $1 AND voyage_id = $2", [portCallId, voyageId]);
      const { rows } = await pool.query("SELECT id FROM voyage_port_calls WHERE voyage_id = $1 ORDER BY port_call_order ASC, id ASC", [voyageId]);
      for (let i = 0; i < rows.length; i++) {
        await pool.query("UPDATE voyage_port_calls SET port_call_order = $1 WHERE id = $2", [i + 1, rows[i].id]);
      }
      const { rows: allCalls } = await pool.query(`SELECT p.name FROM voyage_port_calls vpc JOIN ports p ON p.id = vpc.port_id WHERE vpc.voyage_id = $1 ORDER BY vpc.port_call_order`, [voyageId]);
      await pool.query("UPDATE voyages SET load_port = $1 WHERE id = $2", [allCalls.map((r: any) => r.name).join(" → ") || null, voyageId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete port call" });
    }
  });

  // ─── SOF (STATEMENT OF FACTS) ────────────────────────────────────────────────

  const INTERRUPTION_CODES = new Set(["RAIN_STARTED","RAIN_STOPPED","BREAKDOWN","BREAKDOWN_REPAIRED","SHIFT_START","SHIFT_END","HOLIDAY","BUNKER_START","BUNKER_END"]);

  app.get("/api/voyages/:voyageId/port-calls/:portCallId/sof", isAuthenticated, async (req: any, res) => {
    try {
      const portCallId = parseInt(req.params.portCallId);
      const { rows } = await pool.query(
        `SELECT se.*, u.first_name, u.last_name
         FROM sof_events se
         LEFT JOIN users u ON u.id = se.recorded_by_user_id
         WHERE se.port_call_id = $1
         ORDER BY se.event_time ASC, se.id ASC`,
        [portCallId]
      );
      res.json(rows);
    } catch (err) {
      console.error("GET SOF error:", err);
      res.status(500).json({ message: "Failed to fetch SOF events" });
    }
  });

  app.post("/api/voyages/:voyageId/port-calls/:portCallId/sof", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.voyageId);
      const portCallId = parseInt(req.params.portCallId);
      const userId = req.user?.claims?.sub;
      const { eventCode, eventName, eventTime, remarks, isOfficial, organizationId } = req.body;
      if (!eventCode || !eventName || !eventTime) return res.status(400).json({ message: "eventCode, eventName, eventTime required" });
      const { rows } = await pool.query(
        `INSERT INTO sof_events (port_call_id, voyage_id, event_code, event_name, event_time, remarks, is_official, recorded_by_user_id, organization_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [portCallId, voyageId, eventCode, eventName, new Date(eventTime), remarks || null, isOfficial || false, userId, organizationId || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("POST SOF event error:", err);
      res.status(500).json({ message: "Failed to add SOF event" });
    }
  });

  app.post("/api/voyages/:voyageId/port-calls/:portCallId/sof/from-template", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.voyageId);
      const portCallId = parseInt(req.params.portCallId);
      const userId = req.user?.claims?.sub;
      const { templateId, baseDate } = req.body;
      const { rows: tmpl } = await pool.query("SELECT * FROM sof_templates WHERE id = $1", [templateId]);
      if (!tmpl.length) return res.status(404).json({ message: "Template not found" });
      const events: any[] = tmpl[0].events;
      const base = baseDate ? new Date(baseDate) : new Date();
      const insertedIds: number[] = [];
      for (const ev of events) {
        const evTime = new Date(base.getTime() + (ev.order - 1) * 60 * 60 * 1000);
        const { rows } = await pool.query(
          `INSERT INTO sof_events (port_call_id, voyage_id, event_code, event_name, event_time, recorded_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [portCallId, voyageId, ev.eventCode, ev.eventName, evTime, userId]
        );
        insertedIds.push(rows[0].id);
      }
      res.status(201).json({ inserted: insertedIds.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to apply template" });
    }
  });

  app.patch("/api/sof-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { eventCode, eventName, eventTime, remarks, isOfficial } = req.body;
      const fields: string[] = [];
      const vals: any[] = [];
      let p = 1;
      if (eventCode !== undefined) { fields.push(`event_code = $${p++}`); vals.push(eventCode); }
      if (eventName !== undefined) { fields.push(`event_name = $${p++}`); vals.push(eventName); }
      if (eventTime !== undefined) { fields.push(`event_time = $${p++}`); vals.push(new Date(eventTime)); }
      if (remarks !== undefined) { fields.push(`remarks = $${p++}`); vals.push(remarks); }
      if (isOfficial !== undefined) { fields.push(`is_official = $${p++}`); vals.push(isOfficial); }
      if (!fields.length) return res.status(400).json({ message: "No fields to update" });
      vals.push(id);
      const { rows } = await pool.query(`UPDATE sof_events SET ${fields.join(",")} WHERE id = $${p} RETURNING *`, vals);
      if (!rows.length) return res.status(404).json({ message: "SOF event not found" });
      res.json(rows[0]);
    } catch {
      res.status(500).json({ message: "Failed to update SOF event" });
    }
  });

  app.delete("/api/sof-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      await pool.query("DELETE FROM sof_events WHERE id = $1", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete SOF event" });
    }
  });

  app.get("/api/sof-templates", isAuthenticated, async (req: any, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM sof_templates ORDER BY is_default DESC, id ASC");
      res.json(rows);
    } catch {
      res.status(500).json({ message: "Failed to fetch SOF templates" });
    }
  });

  app.post("/api/sof-templates", isAuthenticated, async (req: any, res) => {
    try {
      const { name, portCallType, events } = req.body;
      if (!name || !events) return res.status(400).json({ message: "name and events required" });
      const { rows } = await pool.query(
        "INSERT INTO sof_templates (name, port_call_type, events, is_default) VALUES ($1,$2,$3,false) RETURNING *",
        [name, portCallType || null, JSON.stringify(events)]
      );
      res.status(201).json(rows[0]);
    } catch {
      res.status(500).json({ message: "Failed to create SOF template" });
    }
  });

  // ─── VOYAGE EXPENSES & BUDGETS ───────────────────────────────────────────────

  const EXPENSE_CATEGORIES = [
    "port_charges","agency_fee","pilotage","tugboat","mooring","bunker",
    "provisions","crew","repairs","insurance","communication","misc"
  ];

  app.get("/api/voyages/:id/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { rows } = await pool.query(
        `SELECT ve.*, vpc.port_call_order, p.name AS port_name
         FROM voyage_expenses ve
         LEFT JOIN voyage_port_calls vpc ON vpc.id = ve.port_call_id
         LEFT JOIN ports p ON p.id = vpc.port_id
         WHERE ve.voyage_id = $1
         ORDER BY ve.created_at ASC`,
        [voyageId]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed to fetch expenses" }); }
  });

  app.post("/api/voyages/:id/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const userId = req.user?.claims?.sub || req.user?.id;
      const {
        portCallId, category, description, budgetAmount, actualAmount,
        currency = "USD", exchangeRate = 1, vendor, invoiceNumber,
        invoiceDate, paymentStatus = "unpaid", notes, organizationId
      } = req.body;
      if (!category || !description || actualAmount == null)
        return res.status(400).json({ message: "category, description, actualAmount required" });
      const amountUsd = parseFloat(actualAmount) * parseFloat(exchangeRate);
      const { rows } = await pool.query(
        `INSERT INTO voyage_expenses
           (voyage_id, port_call_id, user_id, organization_id, category, description,
            budget_amount, actual_amount, currency, exchange_rate, amount_usd,
            vendor, invoice_number, invoice_date, payment_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [voyageId, portCallId || null, userId, organizationId || null, category, description,
         budgetAmount || null, actualAmount, currency, exchangeRate, amountUsd,
         vendor || null, invoiceNumber || null, invoiceDate || null, paymentStatus, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to add expense" }); }
  });

  app.patch("/api/voyages/:id/expenses/:expenseId", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const expenseId = parseInt(req.params.expenseId);
      const fields: string[] = [];
      const vals: any[] = [];
      let p = 1;
      const allowed = ["port_call_id","category","description","budget_amount","actual_amount",
                       "currency","exchange_rate","vendor","invoice_number","invoice_date",
                       "payment_status","paid_at","notes"];
      const keyMap: Record<string, string> = {
        portCallId:"port_call_id", category:"category", description:"description",
        budgetAmount:"budget_amount", actualAmount:"actual_amount", currency:"currency",
        exchangeRate:"exchange_rate", vendor:"vendor", invoiceNumber:"invoice_number",
        invoiceDate:"invoice_date", paymentStatus:"payment_status", paidAt:"paid_at", notes:"notes"
      };
      for (const [camel, col] of Object.entries(keyMap)) {
        if (req.body[camel] !== undefined) { fields.push(`${col} = $${p++}`); vals.push(req.body[camel]); }
      }
      if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });
      if (req.body.actualAmount !== undefined && req.body.exchangeRate !== undefined) {
        fields.push(`amount_usd = $${p++}`);
        vals.push(parseFloat(req.body.actualAmount) * parseFloat(req.body.exchangeRate));
      }
      vals.push(expenseId, voyageId);
      const { rows } = await pool.query(
        `UPDATE voyage_expenses SET ${fields.join(", ")} WHERE id = $${p++} AND voyage_id = $${p} RETURNING *`, vals
      );
      if (!rows.length) return res.status(404).json({ message: "Expense not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to update expense" }); }
  });

  app.delete("/api/voyages/:id/expenses/:expenseId", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const expenseId = parseInt(req.params.expenseId);
      await pool.query("DELETE FROM voyage_expenses WHERE id = $1 AND voyage_id = $2", [expenseId, voyageId]);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to delete expense" }); }
  });

  app.get("/api/voyages/:id/expenses/summary", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { rows: expenses } = await pool.query(
        "SELECT category, amount_usd, payment_status FROM voyage_expenses WHERE voyage_id = $1", [voyageId]
      );
      const { rows: budgets } = await pool.query(
        "SELECT category, budget_amount FROM voyage_budgets WHERE voyage_id = $1", [voyageId]
      );
      const budgetMap: Record<string, number> = {};
      for (const b of budgets) budgetMap[b.category] = parseFloat(b.budget_amount) || 0;

      const catMap: Record<string, { actual: number; paid: number }> = {};
      for (const e of expenses) {
        if (!catMap[e.category]) catMap[e.category] = { actual: 0, paid: 0 };
        catMap[e.category].actual += parseFloat(e.amount_usd) || 0;
        if (e.payment_status === "paid") catMap[e.category].paid += parseFloat(e.amount_usd) || 0;
      }

      const categories = EXPENSE_CATEGORIES.map(cat => ({
        category: cat,
        budget: budgetMap[cat] || 0,
        actual: catMap[cat]?.actual || 0,
        paid: catMap[cat]?.paid || 0,
        variance: (catMap[cat]?.actual || 0) - (budgetMap[cat] || 0),
      }));

      const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
      const totalActual = categories.reduce((s, c) => s + c.actual, 0);
      const totalPaid = categories.reduce((s, c) => s + c.paid, 0);
      res.json({ categories, totalBudget, totalActual, totalPaid, totalVariance: totalActual - totalBudget });
    } catch { res.status(500).json({ message: "Failed to get expense summary" }); }
  });

  app.get("/api/voyages/:id/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { rows } = await pool.query(
        "SELECT * FROM voyage_budgets WHERE voyage_id = $1 ORDER BY category ASC", [voyageId]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed to fetch budgets" }); }
  });

  app.post("/api/voyages/:id/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { category, budgetAmount, currency = "USD", notes } = req.body;
      if (!category || budgetAmount == null) return res.status(400).json({ message: "category and budgetAmount required" });
      const { rows } = await pool.query(
        `INSERT INTO voyage_budgets (voyage_id, category, budget_amount, currency, notes)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (voyage_id, category) DO UPDATE SET budget_amount = $3, currency = $4, notes = $5
         RETURNING *`,
        [voyageId, category, budgetAmount, currency, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to save budget" }); }
  });

  // ─── BUNKER MANAGEMENT ───────────────────────────────────────────────────────

  const FUEL_TYPES = ["IFO380", "VLSFO", "MGO", "LSMGO", "LNG"];

  app.get("/api/vessels/:vesselId/bunker", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const { from, to, fuelType, recordType, voyageId } = req.query;
      const conds: string[] = ["vessel_id = $1"];
      const vals: any[] = [vesselId];
      let p = 2;
      if (from) { conds.push(`record_date >= $${p++}`); vals.push(from); }
      if (to) { conds.push(`record_date <= $${p++}`); vals.push(to); }
      if (fuelType) { conds.push(`fuel_type = $${p++}`); vals.push(fuelType); }
      if (recordType) { conds.push(`record_type = $${p++}`); vals.push(recordType); }
      if (voyageId) { conds.push(`voyage_id = $${p++}`); vals.push(parseInt(voyageId as string)); }
      const { rows } = await pool.query(
        `SELECT * FROM bunker_records WHERE ${conds.join(" AND ")} ORDER BY record_date DESC`, vals
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed to fetch bunker records" }); }
  });

  app.post("/api/vessels/:vesselId/bunker", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const userId = req.user?.claims?.sub || req.user?.id;
      const { recordType, recordDate, fuelType, quantity, unit = "MT", pricePerTon,
              totalCost, currency = "USD", supplier, deliveryNote, robBefore, robAfter,
              portName, notes, fileUrl, voyageId, portCallId, organizationId } = req.body;
      if (!recordType || !recordDate || !fuelType || quantity == null)
        return res.status(400).json({ message: "recordType, recordDate, fuelType, quantity required" });
      const computedCost = (totalCost != null) ? totalCost
        : (pricePerTon && quantity) ? parseFloat(pricePerTon) * parseFloat(quantity) : null;
      const { rows } = await pool.query(
        `INSERT INTO bunker_records
           (vessel_id, voyage_id, port_call_id, user_id, organization_id, record_type,
            record_date, fuel_type, quantity, unit, price_per_ton, total_cost, currency,
            supplier, delivery_note, rob_before, rob_after, port_name, notes, file_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING *`,
        [vesselId, voyageId || null, portCallId || null, userId, organizationId || null,
         recordType, recordDate, fuelType, quantity, unit, pricePerTon || null, computedCost,
         currency, supplier || null, deliveryNote || null, robBefore ?? null, robAfter ?? null,
         portName || null, notes || null, fileUrl || null]
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to add bunker record" }); }
  });

  app.patch("/api/vessels/:vesselId/bunker/:id", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const id = parseInt(req.params.id);
      const keyMap: Record<string, string> = {
        recordType:"record_type", recordDate:"record_date", fuelType:"fuel_type",
        quantity:"quantity", unit:"unit", pricePerTon:"price_per_ton", totalCost:"total_cost",
        currency:"currency", supplier:"supplier", deliveryNote:"delivery_note",
        robBefore:"rob_before", robAfter:"rob_after", portName:"port_name",
        notes:"notes", fileUrl:"file_url", voyageId:"voyage_id", portCallId:"port_call_id"
      };
      const fields: string[] = []; const vals: any[] = []; let p = 1;
      for (const [camel, col] of Object.entries(keyMap)) {
        if (req.body[camel] !== undefined) { fields.push(`${col} = $${p++}`); vals.push(req.body[camel]); }
      }
      if (!fields.length) return res.status(400).json({ message: "No fields" });
      vals.push(id, vesselId);
      const { rows } = await pool.query(
        `UPDATE bunker_records SET ${fields.join(", ")} WHERE id = $${p++} AND vessel_id = $${p} RETURNING *`, vals
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to update bunker record" }); }
  });

  app.delete("/api/vessels/:vesselId/bunker/:id", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const id = parseInt(req.params.id);
      await pool.query("DELETE FROM bunker_records WHERE id = $1 AND vessel_id = $2", [id, vesselId]);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to delete bunker record" }); }
  });

  app.get("/api/vessels/:vesselId/bunker/rob", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const { rows: surveys } = await pool.query(
        "SELECT * FROM bunker_surveys WHERE vessel_id = $1 ORDER BY survey_date DESC LIMIT 1", [vesselId]
      );
      if (surveys.length) {
        const s = surveys[0];
        return res.json({
          source: "survey",
          surveyDate: s.survey_date,
          robs: {
            IFO380: s.ifo380_rob, VLSFO: s.vlsfo_rob,
            MGO: s.mgo_rob, LSMGO: s.lsmgo_rob,
          }
        });
      }
      const { rows: robRows } = await pool.query(
        `SELECT fuel_type, rob_after, record_date FROM bunker_records
         WHERE vessel_id = $1 AND rob_after IS NOT NULL
         ORDER BY record_date DESC`, [vesselId]
      );
      const robs: Record<string, any> = {};
      for (const r of robRows) {
        if (!robs[r.fuel_type]) robs[r.fuel_type] = { rob: r.rob_after, date: r.record_date };
      }
      res.json({ source: "records", robs });
    } catch { res.status(500).json({ message: "Failed to get ROB" }); }
  });

  app.get("/api/vessels/:vesselId/bunker/consumption", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const days = parseInt((req.query.days as string) || "30");
      const { rows } = await pool.query(
        `SELECT date_trunc('day', record_date) AS day, fuel_type, SUM(quantity) AS consumed
         FROM bunker_records
         WHERE vessel_id = $1 AND record_type = 'consumption'
           AND record_date >= NOW() - INTERVAL '${days} days'
         GROUP BY day, fuel_type ORDER BY day ASC`,
        [vesselId]
      );
      const dailyMap: Record<string, Record<string, number>> = {};
      for (const r of rows) {
        const d = r.day.toISOString().split("T")[0];
        if (!dailyMap[d]) dailyMap[d] = {};
        dailyMap[d][r.fuel_type] = parseFloat(r.consumed);
      }
      res.json({ daily: dailyMap, days });
    } catch { res.status(500).json({ message: "Failed to get consumption" }); }
  });

  app.get("/api/vessels/:vesselId/bunker/cost-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const { rows } = await pool.query(
        `SELECT date_trunc('month', record_date) AS month, fuel_type,
                SUM(total_cost) AS total_cost, SUM(quantity) AS quantity,
                AVG(price_per_ton) AS avg_price
         FROM bunker_records
         WHERE vessel_id = $1 AND record_type = 'bunkering' AND total_cost IS NOT NULL
         GROUP BY month, fuel_type ORDER BY month ASC`,
        [vesselId]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed to get cost analysis" }); }
  });

  app.post("/api/vessels/:vesselId/bunker/survey", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const userId = req.user?.claims?.sub || req.user?.id;
      const { surveyDate, ifo380Rob = 0, vlsfoRob = 0, mgoRob = 0, lsmgoRob = 0, notes } = req.body;
      if (!surveyDate) return res.status(400).json({ message: "surveyDate required" });
      const { rows } = await pool.query(
        `INSERT INTO bunker_surveys (vessel_id, survey_date, user_id, ifo380_rob, vlsfo_rob, mgo_rob, lsmgo_rob, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [vesselId, surveyDate, userId, ifo380Rob, vlsfoRob, mgoRob, lsmgoRob, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to save survey" }); }
  });

  app.get("/api/vessels/:vesselId/bunker/surveys", isAuthenticated, async (req: any, res) => {
    try {
      const vesselId = parseInt(req.params.vesselId);
      const { rows } = await pool.query(
        "SELECT * FROM bunker_surveys WHERE vessel_id = $1 ORDER BY survey_date DESC LIMIT 20", [vesselId]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed to get surveys" }); }
  });

  // ─── FINAL DISBURSEMENT ACCOUNTS (FDA) ───────────────────────────────────────

  async function genFdaRefNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { rows } = await pool.query("SELECT COUNT(*) FROM final_disbursements WHERE EXTRACT(YEAR FROM created_at) = $1", [year]);
    const seq = parseInt(rows[0].count) + 1;
    return `FDA-${year}-${String(seq).padStart(3, "0")}`;
  }

  function calcFdaTotals(lineItems: any[]) {
    const totalProforma = lineItems.reduce((s: number, i: any) => s + (parseFloat(i.proformaAmount) || 0), 0);
    const totalActual = lineItems.reduce((s: number, i: any) => s + (parseFloat(i.actualAmount) || 0), 0);
    const totalVariance = totalActual - totalProforma;
    const variancePercentage = totalProforma !== 0 ? (totalVariance / totalProforma) * 100 : 0;
    return { totalProforma, totalActual, totalVariance, variancePercentage };
  }

  app.get("/api/final-da", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { rows: aRows } = await pool.query("SELECT user_role FROM users WHERE id = $1", [userId]);
      const isAdminUser = aRows[0]?.user_role === "admin";
      let query: string;
      let params: any[];
      if (isAdminUser) {
        query = `SELECT fd.*, p.name AS port_name, v.name AS vessel_name,
                   pr.reference_number AS proforma_ref
                 FROM final_disbursements fd
                 LEFT JOIN ports p ON p.id = fd.port_id
                 LEFT JOIN vessels v ON v.id = fd.vessel_id
                 LEFT JOIN proformas pr ON pr.id = fd.proforma_id
                 ORDER BY fd.created_at DESC`;
        params = [];
      } else if (req.organizationId) {
        query = `SELECT fd.*, p.name AS port_name, v.name AS vessel_name,
                   pr.reference_number AS proforma_ref
                 FROM final_disbursements fd
                 LEFT JOIN ports p ON p.id = fd.port_id
                 LEFT JOIN vessels v ON v.id = fd.vessel_id
                 LEFT JOIN proformas pr ON pr.id = fd.proforma_id
                 WHERE fd.user_id = $1 OR fd.organization_id = $2
                 ORDER BY fd.created_at DESC`;
        params = [userId, req.organizationId];
      } else {
        query = `SELECT fd.*, p.name AS port_name, v.name AS vessel_name,
                   pr.reference_number AS proforma_ref
                 FROM final_disbursements fd
                 LEFT JOIN ports p ON p.id = fd.port_id
                 LEFT JOIN vessels v ON v.id = fd.vessel_id
                 LEFT JOIN proformas pr ON pr.id = fd.proforma_id
                 WHERE fd.user_id = $1
                 ORDER BY fd.created_at DESC`;
        params = [userId];
      }
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error("GET final-da error:", err);
      res.status(500).json({ message: "Failed to fetch Final DAs" });
    }
  });

  app.get("/api/final-da/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT fd.*, p.name AS port_name, p.code AS port_locode,
           v.name AS vessel_name, v.imo_number,
           pr.reference_number AS proforma_ref, pr.line_items AS proforma_line_items,
           pr.total_usd AS proforma_total_usd,
           u.first_name, u.last_name, u.email
         FROM final_disbursements fd
         LEFT JOIN ports p ON p.id = fd.port_id
         LEFT JOIN vessels v ON v.id = fd.vessel_id
         LEFT JOIN proformas pr ON pr.id = fd.proforma_id
         LEFT JOIN users u ON u.id = fd.user_id
         WHERE fd.id = $1`,
        [parseInt(req.params.id)]
      );
      if (!rows.length) return res.status(404).json({ message: "Final DA not found" });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch Final DA" });
    }
  });

  app.post("/api/final-da/from-proforma/:proformaId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const proformaId = parseInt(req.params.proformaId);
      const userId = req.user?.claims?.sub;
      const { rows: pRows } = await pool.query(
        "SELECT * FROM proformas WHERE id = $1",
        [proformaId]
      );
      if (!pRows.length) return res.status(404).json({ message: "Proforma not found" });
      const pf = pRows[0];
      const proformaItems: any[] = pf.line_items || [];
      const lineItems = proformaItems.map((item: any) => ({
        description: item.description,
        proformaAmount: parseFloat(item.amountUsd) || 0,
        actualAmount: parseFloat(item.amountUsd) || 0,
        difference: 0,
        notes: item.notes || "",
      }));
      const { totalProforma, totalActual, totalVariance, variancePercentage } = calcFdaTotals(lineItems);
      const refNumber = await genFdaRefNumber();
      const { rows } = await pool.query(
        `INSERT INTO final_disbursements
           (proforma_id, voyage_id, user_id, organization_id, vessel_id, port_id,
            reference_number, to_company, line_items, total_proforma, total_actual,
            total_variance, variance_percentage, currency, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft') RETURNING *`,
        [
          proformaId,
          pf.voyage_id || null,
          userId,
          req.organizationId || null,
          pf.vessel_id || null,
          pf.port_id,
          refNumber,
          pf.to_company || null,
          JSON.stringify(lineItems),
          totalProforma,
          totalActual,
          totalVariance,
          variancePercentage,
          pf.currency || "USD",
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Create FDA from proforma error:", err);
      res.status(500).json({ message: "Failed to create Final DA from proforma" });
    }
  });

  app.post("/api/final-da", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { proformaId, portId, vesselId, voyageId, portCallId, toCompany, lineItems = [], currency, notes, bankDetails } = req.body;
      if (!portId) return res.status(400).json({ message: "portId is required" });
      const items = lineItems.map((item: any) => ({
        ...item,
        difference: (parseFloat(item.actualAmount) || 0) - (parseFloat(item.proformaAmount) || 0),
      }));
      const { totalProforma, totalActual, totalVariance, variancePercentage } = calcFdaTotals(items);
      const refNumber = await genFdaRefNumber();
      const { rows } = await pool.query(
        `INSERT INTO final_disbursements
           (proforma_id, port_call_id, voyage_id, user_id, organization_id, vessel_id, port_id,
            reference_number, to_company, line_items, total_proforma, total_actual,
            total_variance, variance_percentage, currency, notes, bank_details, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft') RETURNING *`,
        [
          proformaId || null, portCallId || null, voyageId || null,
          userId, req.organizationId || null, vesselId || null, portId,
          refNumber, toCompany || null, JSON.stringify(items),
          totalProforma, totalActual, totalVariance, variancePercentage,
          currency || "USD", notes || null, bankDetails ? JSON.stringify(bankDetails) : null,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Create FDA error:", err);
      res.status(500).json({ message: "Failed to create Final DA" });
    }
  });

  app.patch("/api/final-da/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { lineItems, toCompany, currency, notes, status, bankDetails, closedAt } = req.body;
      const fields: string[] = [];
      const vals: any[] = [];
      let p = 1;
      if (toCompany !== undefined) { fields.push(`to_company = $${p++}`); vals.push(toCompany); }
      if (currency !== undefined) { fields.push(`currency = $${p++}`); vals.push(currency); }
      if (notes !== undefined) { fields.push(`notes = $${p++}`); vals.push(notes); }
      if (status !== undefined) {
        fields.push(`status = $${p++}`); vals.push(status);
        if (status === "paid" || status === "final") {
          fields.push(`closed_at = $${p++}`); vals.push(new Date());
        }
      }
      if (closedAt !== undefined) { fields.push(`closed_at = $${p++}`); vals.push(closedAt ? new Date(closedAt) : null); }
      if (bankDetails !== undefined) { fields.push(`bank_details = $${p++}`); vals.push(JSON.stringify(bankDetails)); }
      if (lineItems !== undefined) {
        const items = lineItems.map((item: any) => ({
          ...item,
          difference: (parseFloat(item.actualAmount) || 0) - (parseFloat(item.proformaAmount) || 0),
        }));
        const { totalProforma, totalActual, totalVariance, variancePercentage } = calcFdaTotals(items);
        fields.push(`line_items = $${p++}`); vals.push(JSON.stringify(items));
        fields.push(`total_proforma = $${p++}`); vals.push(totalProforma);
        fields.push(`total_actual = $${p++}`); vals.push(totalActual);
        fields.push(`total_variance = $${p++}`); vals.push(totalVariance);
        fields.push(`variance_percentage = $${p++}`); vals.push(variancePercentage);
      }
      if (!fields.length) return res.status(400).json({ message: "No fields to update" });
      vals.push(id);
      const { rows } = await pool.query(`UPDATE final_disbursements SET ${fields.join(",")} WHERE id = $${p} RETURNING *`, vals);
      if (!rows.length) return res.status(404).json({ message: "Final DA not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("PATCH FDA error:", err);
      res.status(500).json({ message: "Failed to update Final DA" });
    }
  });

  app.delete("/api/final-da/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { rows: aRows } = await pool.query("SELECT user_role FROM users WHERE id = $1", [userId]);
      const isAdminUser = aRows[0]?.user_role === "admin";
      const { rows: fdaRows } = await pool.query("SELECT user_id FROM final_disbursements WHERE id = $1", [parseInt(req.params.id)]);
      if (!fdaRows.length) return res.status(404).json({ message: "Not found" });
      if (!isAdminUser && fdaRows[0].user_id !== userId) return res.status(403).json({ message: "Access denied" });
      await pool.query("DELETE FROM final_disbursements WHERE id = $1", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete Final DA" });
    }
  });

  app.get("/api/final-da/:id/variance-report", isAuthenticated, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT fd.*, p.name AS port_name, v.name AS vessel_name
         FROM final_disbursements fd
         LEFT JOIN ports p ON p.id = fd.port_id
         LEFT JOIN vessels v ON v.id = fd.vessel_id
         WHERE fd.id = $1`,
        [parseInt(req.params.id)]
      );
      if (!rows.length) return res.status(404).json({ message: "Final DA not found" });
      const fda = rows[0];
      const items: any[] = fda.line_items || [];
      const sortedByVariance = [...items]
        .sort((a, b) => Math.abs((parseFloat(b.actualAmount) || 0) - (parseFloat(b.proformaAmount) || 0)) -
                        Math.abs((parseFloat(a.actualAmount) || 0) - (parseFloat(a.proformaAmount) || 0)));
      res.json({
        id: fda.id,
        referenceNumber: fda.reference_number,
        portName: fda.port_name,
        vesselName: fda.vessel_name,
        totalProforma: fda.total_proforma,
        totalActual: fda.total_actual,
        totalVariance: fda.total_variance,
        variancePercentage: fda.variance_percentage,
        lineItems: items,
        topVarianceItems: sortedByVariance.slice(0, 3),
      });
    } catch {
      res.status(500).json({ message: "Failed to get variance report" });
    }
  });

  // ─── FIXTURES ───────────────────────────────────────────────────────────────

  app.get("/api/fixtures", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
      const result = isAdmin ? await storage.getAllFixtures() : await storage.getFixtures(userId, req.organizationId);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to fetch fixtures" });
    }
  });

  app.post("/api/fixtures", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fixture = await storage.createFixture({ ...req.body, userId, organizationId: req.organizationId ?? null });
      if (req.organizationId) {
        const { rows } = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
        const name = `${rows[0]?.first_name || ""} ${rows[0]?.last_name || ""}`.trim() || "A user";
        logOrgActivity({ organizationId: req.organizationId, userId, action: "created_fixture", entityType: "fixture", entityId: fixture.id, description: `${name} created fixture for ${fixture.vesselName}` });
      }
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

  // ─── LAYTIME CALCULATIONS ────────────────────────────────────────────────────

  app.get("/api/fixtures/:id/laytime", isAuthenticated, async (req: any, res) => {
    try {
      const fixtureId = parseInt(req.params.id);
      const { rows } = await pool.query(
        "SELECT * FROM laytime_calculations WHERE fixture_id = $1 ORDER BY created_at ASC",
        [fixtureId]
      );
      res.json(rows);
    } catch {
      res.status(500).json({ message: "Failed to fetch laytime calculations" });
    }
  });

  app.post("/api/fixtures/:id/laytime", isAuthenticated, async (req: any, res) => {
    try {
      const fixtureId = parseInt(req.params.id);
      const { calculateLaytime } = await import("./laytime-calculator");
      const {
        portCallType = "loading",
        portName,
        allowedLaytimeHours = 0,
        norStartedAt,
        berthingAt,
        loadingStartedAt,
        loadingCompletedAt,
        departedAt,
        demurrageRate = 0,
        despatchRate = 0,
        currency = "USD",
        deductions = [],
        notes,
      } = req.body;

      const calc = calculateLaytime({
        allowedLaytimeHours: Number(allowedLaytimeHours),
        norStartedAt,
        berthingAt,
        loadingStartedAt,
        loadingCompletedAt,
        departedAt,
        demurrageRate: Number(demurrageRate),
        despatchRate: Number(despatchRate),
        deductions,
      });

      const { rows } = await pool.query(
        `INSERT INTO laytime_calculations
          (fixture_id, port_call_type, port_name, allowed_laytime_hours,
           nor_started_at, berthing_at, loading_started_at, loading_completed_at, departed_at,
           time_used_hours, demurrage_rate, despatch_rate, demurrage_amount, despatch_amount,
           currency, deductions, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          fixtureId, portCallType, portName || null, allowedLaytimeHours,
          norStartedAt || null, berthingAt || null, loadingStartedAt || null,
          loadingCompletedAt || null, departedAt || null,
          calc.timeUsedHours, demurrageRate, despatchRate,
          calc.demurrageAmount, calc.despatchAmount,
          currency, JSON.stringify(deductions), notes || null,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to create laytime calculation", error: e.message });
    }
  });

  app.put("/api/laytime/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { calculateLaytime } = await import("./laytime-calculator");
      const {
        portCallType,
        portName,
        allowedLaytimeHours,
        norStartedAt,
        berthingAt,
        loadingStartedAt,
        loadingCompletedAt,
        departedAt,
        demurrageRate,
        despatchRate,
        currency,
        deductions,
        notes,
      } = req.body;

      const calc = calculateLaytime({
        allowedLaytimeHours: Number(allowedLaytimeHours || 0),
        norStartedAt,
        berthingAt,
        loadingStartedAt,
        loadingCompletedAt,
        departedAt,
        demurrageRate: Number(demurrageRate || 0),
        despatchRate: Number(despatchRate || 0),
        deductions: deductions || [],
      });

      const { rows } = await pool.query(
        `UPDATE laytime_calculations SET
          port_call_type = $2, port_name = $3, allowed_laytime_hours = $4,
          nor_started_at = $5, berthing_at = $6, loading_started_at = $7,
          loading_completed_at = $8, departed_at = $9,
          time_used_hours = $10, demurrage_rate = $11, despatch_rate = $12,
          demurrage_amount = $13, despatch_amount = $14,
          currency = $15, deductions = $16, notes = $17
         WHERE id = $1 RETURNING *`,
        [
          id, portCallType, portName || null, allowedLaytimeHours || 0,
          norStartedAt || null, berthingAt || null, loadingStartedAt || null,
          loadingCompletedAt || null, departedAt || null,
          calc.timeUsedHours, demurrageRate || 0, despatchRate || 0,
          calc.demurrageAmount, calc.despatchAmount,
          currency || "USD", JSON.stringify(deductions || []), notes || null,
        ]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to update laytime calculation", error: e.message });
    }
  });

  app.delete("/api/laytime/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await pool.query("DELETE FROM laytime_calculations WHERE id = $1", [id]);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete laytime calculation" });
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

  app.post("/api/cargo-positions", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const pos = await storage.createCargoPosition({ ...req.body, userId, organizationId: req.organizationId ?? null });
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

  // ─── FREIGHT INDICES (Trading Economics or Fallback, 4h cache) ──────────────

  let freightIndexCache: { data: any; fetchedAt: number } | null = null;
  const FREIGHT_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

  const FREIGHT_META: Record<string, { name: string; description: string }> = {
    BDI:  { name: "Baltic Dry Index",          description: "Kuru Dökme Yük" },
    BCTI: { name: "Baltic Clean Tanker Index", description: "Temiz Tanker" },
    BDTI: { name: "Baltic Dirty Tanker Index", description: "Kirli Tanker" },
  };

  const FREIGHT_FALLBACK = [
    { code: "BDI",  ...FREIGHT_META.BDI,  value: 1245, change: 0, changePct: 0, previousClose: 1245 },
    { code: "BCTI", ...FREIGHT_META.BCTI, value: 731,  change: 0, changePct: 0, previousClose: 731  },
    { code: "BDTI", ...FREIGHT_META.BDTI, value: 1089, change: 0, changePct: 0, previousClose: 1089 },
  ];

  // ── Attempt 1: Trading Economics API (requires TRADING_ECONOMICS_API_KEY) ──
  async function fetchFromTradingEconomics(): Promise<any[] | null> {
    const teKey = process.env.TRADING_ECONOMICS_API_KEY;
    if (!teKey) return null;
    try {
      const symbols = "BDI:IND,BCTI:IND,BDTI:IND";
      const url = `https://api.tradingeconomics.com/markets/symbol/${encodeURIComponent(symbols)}?c=${encodeURIComponent(teKey)}`;
      const resp = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        console.warn("[freight] Trading Economics response not OK:", resp.status);
        return null;
      }
      const json = await resp.json();
      if (!Array.isArray(json) || json.length === 0) return null;

      const mapped = json.map((item: any) => {
        const ticker = (item.Ticker || "").toUpperCase();
        const code = ticker.replace(/:IND$/, "");
        const meta = FREIGHT_META[code];
        if (!meta) return null;
        const last = Number(item.Last ?? item.Close ?? 0);
        const prev = Number(item.Close ?? last);
        const chg  = Number(item.DailyChange ?? 0);
        const chgPct = Number(item.DailyPercentualChange ?? 0);
        return {
          code,
          name: meta.name,
          description: meta.description,
          value: Math.round(last),
          change: Math.round(chg * 100) / 100,
          changePct: Math.round(chgPct * 100) / 100,
          previousClose: Math.round(prev - chg),
        };
      }).filter(Boolean);

      if (mapped.length === 0) return null;
      // Ensure all three indices are present; fill gaps from fallback
      return ["BDI", "BCTI", "BDTI"].map(
        code => mapped.find((m: any) => m.code === code) || FREIGHT_FALLBACK.find(f => f.code === code)!
      );
    } catch (err) {
      console.warn("[freight] Trading Economics fetch failed:", err);
      return null;
    }
  }

  // ── Attempt 2: Yahoo Finance crumb-based (in-memory, no file writes) ────────
  async function fetchFromYahooFinance(): Promise<any[] | null> {
    try {
      // Step 1: get crumb + cookie in memory
      const cookieResp = await fetch("https://fc.yahoo.com/", {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(6000),
        redirect: "follow",
      });
      const rawCookies: string[] = [];
      const setCookie = cookieResp.headers.get("set-cookie");
      if (setCookie) rawCookies.push(...setCookie.split(/,(?=[^ ])/));

      const cookieHeader = rawCookies
        .map(c => c.split(";")[0].trim())
        .filter(Boolean)
        .join("; ");

      // Step 2: get crumb
      const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Cookie": cookieHeader,
        },
        signal: AbortSignal.timeout(6000),
      });
      const crumb = await crumbResp.text();
      if (!crumb || crumb.includes("<") || crumb.length > 50) return null;

      // Step 3: try known BDI-related tickers
      const tickerMap: Record<string, string> = {
        BDI: "BDI",
        BCTI: "BCTI",
        BDTI: "BDTI",
      };
      const results = await Promise.all(
        Object.entries(tickerMap).map(async ([code, ticker]) => {
          try {
            const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d&crumb=${encodeURIComponent(crumb)}`;
            const r = await fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Cookie": cookieHeader,
              },
              signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) return null;
            const j = await r.json();
            const meta = j?.chart?.result?.[0]?.meta;
            if (!meta?.regularMarketPrice || meta.regularMarketPrice < 10) return null;
            const meta2 = FREIGHT_META[code]!;
            const price = meta.regularMarketPrice;
            const prev  = meta.previousClose || price;
            return {
              code,
              name: meta2.name,
              description: meta2.description,
              value: Math.round(price),
              change: Math.round((price - prev) * 100) / 100,
              changePct: Math.round(((price - prev) / prev) * 10000) / 100,
              previousClose: Math.round(prev),
            };
          } catch { return null; }
        })
      );
      const valid = results.filter(Boolean);
      if (valid.length === 0) return null;
      return ["BDI", "BCTI", "BDTI"].map(
        code => valid.find((v: any) => v?.code === code) || FREIGHT_FALLBACK.find(f => f.code === code)!
      );
    } catch (err) {
      console.warn("[freight] Yahoo Finance fetch failed:", err);
      return null;
    }
  }

  async function fetchFreightIndices(): Promise<{ indices: any[]; source: string } | null> {
    // Try Trading Economics first (most reliable if API key is set)
    const teData = await fetchFromTradingEconomics();
    if (teData) return { indices: teData, source: "Trading Economics" };

    // Try Yahoo Finance with crumb auth
    const yfData = await fetchFromYahooFinance();
    if (yfData) return { indices: yfData, source: "Yahoo Finance" };

    return null;
  }

  app.get("/api/market/freight-indices", isAuthenticated, async (_req, res) => {
    const simpleCached = cache.get("market:freight-indices");
    if (simpleCached) return res.json(simpleCached);
    try {
      const now = Date.now();
      const cacheValid = freightIndexCache && (now - freightIndexCache.fetchedAt) < FREIGHT_CACHE_TTL;

      if (cacheValid) {
        const data = { ...freightIndexCache!.data, cached: true };
        cache.set("market:freight-indices", data, 15 * 60);
        return res.json(data);
      }

      const fresh = await fetchFreightIndices();
      const hasApiKey = !!process.env.TRADING_ECONOMICS_API_KEY;
      const data = {
        indices: fresh?.indices ?? FREIGHT_FALLBACK,
        lastUpdated: new Date().toISOString(),
        source: fresh?.source ?? "Fallback",
        cached: false,
        hasApiKey,
      };

      if (fresh) freightIndexCache = { data, fetchedAt: now };
      cache.set("market:freight-indices", data, 15 * 60);
      res.json(data);
    } catch {
      res.json({ indices: FREIGHT_FALLBACK, lastUpdated: new Date().toISOString(), source: "Fallback", cached: false, hasApiKey: false });
    }
  });

  // ─── BUNKER PRICES ───────────────────────────────────────────────────────────

  app.get("/api/market/bunker-prices", isAuthenticated, async (_req, res) => {
    const cached = cache.get("market:bunker-prices");
    if (cached) return res.json(cached);
    try {
      const prices = await storage.getBunkerPrices();
      cache.set("market:bunker-prices", prices, 15 * 60);
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
      cache.invalidate("market:bunker-prices");
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
      cache.invalidate("market:bunker-prices");
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
      cache.invalidate("market:bunker-prices");
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

  app.get("/api/invoices", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const items = await storage.getInvoicesByUser(userId, req.organizationId);
      res.json(items);
    } catch {
      res.status(500).json({ message: "Failed to get invoices" });
    }
  });

  app.post("/api/invoices", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { title, amount, currency, dueDate, notes, invoiceType, voyageId, proformaId, linkedProformaId } = req.body;
      if (!title || !amount) return res.status(400).json({ message: "title and amount required" });

      const invoice = await storage.createInvoice({
        createdByUserId: userId,
        organizationId: req.organizationId ?? null,
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
      logAction(userId, "create", "invoice", invoice.id, { title, amount: parseFloat(amount), currency: currency || "USD", invoiceType: invoiceType || "invoice" }, getClientIp(req));
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
      logAction(req.user?.claims?.sub || req.user?.id, "pay", "invoice", id, { status: "paid" }, getClientIp(req));
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to mark invoice paid" });
    }
  });

  app.patch("/api/invoices/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateInvoiceStatus(id, "cancelled");
      logAction(req.user?.claims?.sub || req.user?.id, "cancel", "invoice", id, { status: "cancelled" }, getClientIp(req));
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

  // ─── TARIFF MANAGEMENT (Admin only) ────────────────────────────────────────

  const ALLOWED_TARIFF_TABLES: Record<string, { label: string; feeFields: string[] }> = {
    pilotage_tariffs: { label: "Kılavuzluk Ücretleri", feeFields: ["base_fee", "per_1000_grt"] },
    external_pilotage_tariffs: { label: "Liman Dışı Kılavuzluk", feeFields: ["grt_up_to_1000", "per_additional_1000_grt"] },
    berthing_tariffs: { label: "Barınma Ücretleri", feeFields: ["intl_foreign_flag", "intl_turkish_flag", "cabotage_turkish"] },
    agency_fees: { label: "Acentelik Ücretleri", feeFields: ["fee"] },
    marpol_tariffs: { label: "MARPOL Atık Ücretleri", feeFields: ["fixed_fee", "weekday_ek1_rate", "weekday_ek4_rate", "weekday_ek5_rate"] },
    port_authority_fees: { label: "Liman Resmi Ücretleri", feeFields: ["amount"] },
    lcb_tariffs: { label: "LCB Tarifeleri", feeFields: ["amount"] },
    tonnage_tariffs: { label: "Tonaj Tarifeleri", feeFields: ["ithalat", "ihracat"] },
    other_services: { label: "Diğer Hizmetler", feeFields: ["fee"] },
    cargo_handling_tariffs: { label: "Yükleme/Boşaltma", feeFields: ["rate"] },
    light_dues: { label: "Light Dues", feeFields: ["rate_up_to_800", "rate_above_800"] },
    chamber_of_shipping_fees: { label: "Chamber of Shipping Fee", feeFields: ["fee"] },
    chamber_freight_share: { label: "Chamber of Shipping Share on Freight", feeFields: ["fee"] },
    harbour_master_dues: { label: "Harbour Master Dues", feeFields: ["fee"] },
    sanitary_dues: { label: "Sanitary Dues", feeFields: ["nrt_rate"] },
    vts_fees: { label: "VTS Fee", feeFields: ["fee"] },
    supervision_fees: { label: "Supervision Fee", feeFields: ["rate"] },
    misc_expenses: { label: "Miscellaneous Expenses", feeFields: ["fee_usd"] },
  };

  app.get("/api/admin/tariffs/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });

      const counts: Record<string, number> = {};
      let totalRecords = 0;
      let latestUpdate: Date | null = null;
      let outdatedCount = 0;
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      for (const tbl of Object.keys(ALLOWED_TARIFF_TABLES)) {
        const result = await pool.query(`SELECT count(*)::int as cnt, max(updated_at) as latest FROM ${tbl}`);
        const row = result.rows[0];
        counts[tbl] = row.cnt || 0;
        totalRecords += row.cnt || 0;
        if (row.latest && (!latestUpdate || new Date(row.latest) > latestUpdate)) {
          latestUpdate = new Date(row.latest);
        }
        const oldResult = await pool.query(`SELECT count(*)::int as cnt FROM ${tbl} WHERE updated_at < $1`, [oneYearAgo]);
        outdatedCount += oldResult.rows[0].cnt || 0;
      }

      const portCount = await pool.query(`SELECT count(distinct port_id)::int as cnt FROM pilotage_tariffs WHERE port_id IS NOT NULL`);
      res.json({
        portCount: portCount.rows[0].cnt || 0,
        totalRecords,
        lastUpdated: latestUpdate,
        outdatedCount,
        tableCounts: counts,
      });
    } catch (err) {
      console.error("Tariff summary error:", err);
      res.status(500).json({ message: "Failed to fetch tariff summary" });
    }
  });

  app.get("/api/admin/tariffs/:table", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
      const tbl = req.params.table;
      if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

      const params: any[] = [];
      const conditions: string[] = [];
      if (req.query.portId === "global") {
        conditions.push("port_id IS NULL");
      } else if (req.query.portId && req.query.portId !== "all") {
        params.push(parseInt(req.query.portId as string));
        conditions.push(`(port_id = $${params.length} OR port_id IS NULL)`);
      }
      if (req.query.currency && req.query.currency !== "all") {
        params.push(req.query.currency as string);
        conditions.push(`currency = $${params.length}`);
      }
      if (req.query.year && req.query.year !== "all") {
        params.push(parseInt(req.query.year as string));
        conditions.push(`valid_year = $${params.length}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const result = await pool.query(`SELECT * FROM ${tbl} ${where} ORDER BY id LIMIT 500`, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Tariff list error:", err);
      res.status(500).json({ message: "Failed to fetch tariffs" });
    }
  });

  app.post("/api/admin/tariffs/:table", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
      const tbl = req.params.table;
      if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

      const body = { ...req.body };
      delete body.id;
      body.updated_at = new Date().toISOString();

      const keys = Object.keys(body).filter(k => body[k] !== undefined);
      const cols = keys.map(k => `"${k}"`).join(", ");
      const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map(k => (body[k] === "" ? null : body[k]));

      const result = await pool.query(`INSERT INTO ${tbl} (${cols}) VALUES (${vals}) RETURNING *`, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Tariff create error:", err);
      res.status(500).json({ message: "Failed to create tariff" });
    }
  });

  app.patch("/api/admin/tariffs/:table/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
      const tbl = req.params.table;
      if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

      const body = { ...req.body };
      delete body.id;
      body.updated_at = new Date().toISOString();

      const keys = Object.keys(body).filter(k => body[k] !== undefined);
      const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      const values: any[] = keys.map(k => (body[k] === "" ? null : body[k]));
      values.push(parseInt(req.params.id));

      const result = await pool.query(`UPDATE ${tbl} SET ${sets} WHERE id = $${values.length} RETURNING *`, values);
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Tariff update error:", err);
      res.status(500).json({ message: "Failed to update tariff" });
    }
  });

  app.delete("/api/admin/tariffs/:table/clear", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
      const tbl = req.params.table;
      if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });
      const portId = req.query.portId as string | undefined;
      if (!portId || portId === "null" || portId === "global") {
        await pool.query(`DELETE FROM ${tbl} WHERE port_id IS NULL`);
      } else {
        await pool.query(`DELETE FROM ${tbl} WHERE port_id = $1`, [parseInt(portId)]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Tariff clear error:", err);
      res.status(500).json({ message: "Failed to clear tariff records" });
    }
  });

  app.delete("/api/admin/tariffs/:table/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
      const tbl = req.params.table;
      if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

      await pool.query(`DELETE FROM ${tbl} WHERE id = $1`, [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      console.error("Tariff delete error:", err);
      res.status(500).json({ message: "Failed to delete tariff" });
    }
  });

  app.post("/api/admin/tariffs/:table/bulk-increase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
      const tbl = req.params.table;
      if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

      const { ids, percent } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || typeof percent !== "number") {
        return res.status(400).json({ message: "ids[] and percent required" });
      }
      const feeFields = ALLOWED_TARIFF_TABLES[tbl].feeFields;
      const multiplier = 1 + percent / 100;
      const sets = feeFields.map(f => `"${f}" = ROUND(COALESCE("${f}", 0) * ${multiplier}, 2)`).join(", ");
      const idList = ids.map(Number).join(",");
      await pool.query(`UPDATE ${tbl} SET ${sets}, updated_at = NOW() WHERE id IN (${idList})`);
      res.json({ success: true, affected: ids.length });
    } catch (err) {
      console.error("Bulk increase error:", err);
      res.status(500).json({ message: "Failed to apply bulk increase" });
    }
  });

  app.post("/api/admin/tariffs/:table/bulk-copy-year", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await storage.getUser(userId);
      if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
      const tbl = req.params.table;
      if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

      const { ids, targetYear } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || typeof targetYear !== "number") {
        return res.status(400).json({ message: "ids[] and targetYear required" });
      }

      const colResult = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name NOT IN ('id','updated_at') ORDER BY ordinal_position`,
        [tbl]
      );
      const cols = colResult.rows.map((r: any) => r.column_name);
      const colStr = cols.map((c: string) => c === "valid_year" ? `${parseInt(String(targetYear))}` : `"${c}"`).join(", ");
      const idList = ids.map(Number).join(",");
      await pool.query(`INSERT INTO ${tbl} (${cols.map((c: string) => `"${c}"`).join(", ")}) SELECT ${colStr} FROM ${tbl} WHERE id IN (${idList})`);
      res.json({ success: true, copied: ids.length });
    } catch (err) {
      console.error("Bulk copy year error:", err);
      res.status(500).json({ message: "Failed to copy tariffs to year" });
    }
  });

  // ── Custom Tariff Sections ──────────────────────────────────────────────────
  const checkAdmin = async (req: any, res: any) => {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") {
      res.status(403).json({ message: "Forbidden" });
      return false;
    }
    return true;
  };

  app.get("/api/admin/tariff-custom-sections", isAuthenticated, async (req: any, res) => {
    try {
      if (!await checkAdmin(req, res)) return;
      const result = await pool.query("SELECT * FROM custom_tariff_sections ORDER BY sort_order, id");
      res.json(result.rows);
    } catch (err) {
      console.error("Custom sections list error:", err);
      res.status(500).json({ message: "Failed to fetch custom sections" });
    }
  });

  app.post("/api/admin/tariff-custom-sections", isAuthenticated, async (req: any, res) => {
    try {
      if (!await checkAdmin(req, res)) return;
      const { label, default_currency } = req.body;
      if (!label?.trim()) return res.status(400).json({ message: "Label is required" });
      const result = await pool.query(
        "INSERT INTO custom_tariff_sections (label, default_currency) VALUES ($1, $2) RETURNING *",
        [label.trim(), default_currency || "USD"]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Custom section create error:", err);
      res.status(500).json({ message: "Failed to create custom section" });
    }
  });

  app.delete("/api/admin/tariff-custom-sections/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!await checkAdmin(req, res)) return;
      await pool.query("DELETE FROM custom_tariff_sections WHERE id = $1", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      console.error("Custom section delete error:", err);
      res.status(500).json({ message: "Failed to delete custom section" });
    }
  });

  app.get("/api/admin/tariff-custom-sections/:id/entries", isAuthenticated, async (req: any, res) => {
    try {
      if (!await checkAdmin(req, res)) return;
      const sectionId = parseInt(req.params.id);
      const params: any[] = [sectionId];
      let portCondition = "";
      if (req.query.portId === "global") {
        portCondition = "AND port_id IS NULL";
      } else if (req.query.portId && req.query.portId !== "all") {
        params.push(parseInt(req.query.portId as string));
        portCondition = `AND port_id = $${params.length}`;
      }
      const result = await pool.query(
        `SELECT * FROM custom_tariff_entries WHERE section_id = $1 ${portCondition} ORDER BY id`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Custom entries list error:", err);
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });

  app.post("/api/admin/tariff-custom-sections/:id/entries", isAuthenticated, async (req: any, res) => {
    try {
      if (!await checkAdmin(req, res)) return;
      const sectionId = parseInt(req.params.id);
      const body = { ...req.body };
      delete body.id;
      body.section_id = sectionId;
      body.updated_at = new Date().toISOString();
      const keys = Object.keys(body).filter(k => body[k] !== undefined);
      const cols = keys.map(k => `"${k}"`).join(", ");
      const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map(k => (body[k] === "" ? null : body[k]));
      const result = await pool.query(
        `INSERT INTO custom_tariff_entries (${cols}) VALUES (${vals}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Custom entry create error:", err);
      res.status(500).json({ message: "Failed to create entry" });
    }
  });

  app.patch("/api/admin/tariff-custom-sections/:id/entries/:entryId", isAuthenticated, async (req: any, res) => {
    try {
      if (!await checkAdmin(req, res)) return;
      const entryId = parseInt(req.params.entryId);
      const body = { ...req.body };
      delete body.id;
      delete body.section_id;
      body.updated_at = new Date().toISOString();
      const keys = Object.keys(body).filter(k => body[k] !== undefined);
      const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      const values = [...keys.map(k => (body[k] === "" ? null : body[k])), entryId];
      const result = await pool.query(
        `UPDATE custom_tariff_entries SET ${sets} WHERE id = $${values.length} RETURNING *`,
        values
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Custom entry update error:", err);
      res.status(500).json({ message: "Failed to update entry" });
    }
  });

  app.delete("/api/admin/tariff-custom-sections/:id/entries/:entryId", isAuthenticated, async (req: any, res) => {
    try {
      if (!await checkAdmin(req, res)) return;
      const entryId = parseInt(req.params.entryId);
      await pool.query("DELETE FROM custom_tariff_entries WHERE id = $1", [entryId]);
      res.json({ success: true });
    } catch (err) {
      console.error("Custom entry delete error:", err);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  // ─── AUDIT LOGS (Admin only) ─────────────────────────────────────────────────

  app.get("/api/admin/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const { userId, action, entityType, from, to, limit: lim, offset: off } = req.query;
      let query = `
        SELECT al.*, u.email, u.first_name, u.last_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (userId) { params.push(userId); query += ` AND al.user_id = $${params.length}`; }
      if (action) { params.push(action); query += ` AND al.action = $${params.length}`; }
      if (entityType) { params.push(entityType); query += ` AND al.entity_type = $${params.length}`; }
      if (from) { params.push(from); query += ` AND al.created_at >= $${params.length}`; }
      if (to) { params.push(to); query += ` AND al.created_at <= $${params.length}`; }
      query += ` ORDER BY al.created_at DESC`;
      const limitVal = Math.min(parseInt(lim as string) || 100, 500);
      const offsetVal = parseInt(off as string) || 0;
      params.push(limitVal); query += ` LIMIT $${params.length}`;
      params.push(offsetVal); query += ` OFFSET $${params.length}`;
      const result = await pool.query(query, params);

      // Count query
      let countQ = `SELECT COUNT(*) FROM audit_logs al WHERE 1=1`;
      const countParams: any[] = [];
      if (userId) { countParams.push(userId); countQ += ` AND al.user_id = $${countParams.length}`; }
      if (action) { countParams.push(action); countQ += ` AND al.action = $${countParams.length}`; }
      if (entityType) { countParams.push(entityType); countQ += ` AND al.entity_type = $${countParams.length}`; }
      if (from) { countParams.push(from); countQ += ` AND al.created_at >= $${countParams.length}`; }
      if (to) { countParams.push(to); countQ += ` AND al.created_at <= $${countParams.length}`; }
      const countResult = await pool.query(countQ, countParams);

      res.json({ logs: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (error) {
      console.error("Audit log fetch error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ─── REPORTS ────────────────────────────────────────────────────────────────

  app.get("/api/reports/voyages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { from, to } = req.query as { from?: string; to?: string };

      const params: any[] = [userId];
      let dateFilter = "";
      if (from) { params.push(from); dateFilter += ` AND v.created_at >= $${params.length}`; }
      if (to)   { params.push(to);   dateFilter += ` AND v.created_at <= $${params.length}`; }

      const [statsRow, byPort, list] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'planned'   THEN 1 ELSE 0 END) AS planned,
            AVG(CASE WHEN eta IS NOT NULL AND etd IS NOT NULL
                THEN EXTRACT(EPOCH FROM (etd - eta)) / 86400 END) AS avg_duration_days
          FROM voyages v
          WHERE (user_id = $1 OR agent_user_id = $1) ${dateFilter}
        `, params),
        pool.query(`
          SELECT p.name AS port_name, COUNT(*) AS count
          FROM voyages v
          JOIN ports p ON p.id = v.port_id
          WHERE (v.user_id = $1 OR v.agent_user_id = $1) ${dateFilter}
          GROUP BY p.name ORDER BY count DESC LIMIT 10
        `, params),
        pool.query(`
          SELECT v.id, v.vessel_name, v.status, v.purpose_of_call,
                 v.eta, v.etd, v.created_at, p.name AS port_name
          FROM voyages v
          JOIN ports p ON p.id = v.port_id
          WHERE (v.user_id = $1 OR v.agent_user_id = $1) ${dateFilter}
          ORDER BY v.created_at DESC LIMIT 100
        `, params),
      ]);

      const s = statsRow.rows[0];
      res.json({
        stats: {
          total: parseInt(s.total),
          completed: parseInt(s.completed),
          cancelled: parseInt(s.cancelled),
          active: parseInt(s.active),
          planned: parseInt(s.planned),
          avgDurationDays: s.avg_duration_days ? parseFloat(parseFloat(s.avg_duration_days).toFixed(1)) : null,
        },
        byPort: byPort.rows.map(r => ({ portName: r.port_name, count: parseInt(r.count) })),
        list: list.rows,
      });
    } catch (err) {
      console.error("Voyage report error:", err);
      res.status(500).json({ message: "Failed to generate voyage report" });
    }
  });

  app.get("/api/reports/financial", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { from, to } = req.query as { from?: string; to?: string };

      const pParams: any[] = [userId];
      let pDateFilter = "";
      if (from) { pParams.push(from); pDateFilter += ` AND p.created_at >= $${pParams.length}`; }
      if (to)   { pParams.push(to);   pDateFilter += ` AND p.created_at <= $${pParams.length}`; }

      const iParams: any[] = [userId];
      let iDateFilter = "";
      if (from) { iParams.push(from); iDateFilter += ` AND i.created_at >= $${iParams.length}`; }
      if (to)   { iParams.push(to);   iDateFilter += ` AND i.created_at <= $${iParams.length}`; }

      const [proformaStats, invoiceStats, monthly, byPort] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS total_count,
            COALESCE(SUM(total_usd), 0) AS total_usd,
            COALESCE(SUM(total_eur), 0) AS total_eur
          FROM proformas p
          WHERE p.user_id = $1 ${pDateFilter}
        `, pParams),
        pool.query(`
          SELECT
            status,
            COUNT(*) AS count,
            COALESCE(SUM(amount), 0) AS total
          FROM invoices i
          WHERE i.created_by_user_id = $1 ${iDateFilter}
          GROUP BY status
        `, iParams),
        pool.query(`
          SELECT
            TO_CHAR(p.created_at, 'YYYY-MM') AS month,
            COALESCE(SUM(p.total_usd), 0) AS total_usd,
            COUNT(*) AS count
          FROM proformas p
          WHERE p.user_id = $1 ${pDateFilter}
          GROUP BY month ORDER BY month ASC LIMIT 12
        `, pParams),
        pool.query(`
          SELECT po.name AS port_name,
                 COALESCE(SUM(p.total_usd), 0) AS total_usd,
                 COUNT(*) AS count
          FROM proformas p
          JOIN ports po ON po.id = p.port_id
          WHERE p.user_id = $1 ${pDateFilter}
          GROUP BY po.name ORDER BY total_usd DESC LIMIT 8
        `, pParams),
      ]);

      const ps = proformaStats.rows[0];
      const invoiceMap: Record<string, { count: number; total: number }> = {};
      for (const r of invoiceStats.rows) {
        invoiceMap[r.status] = { count: parseInt(r.count), total: parseFloat(r.total) };
      }

      res.json({
        proforma: {
          totalCount: parseInt(ps.total_count),
          totalUsd: parseFloat(ps.total_usd),
          totalEur: parseFloat(ps.total_eur),
        },
        invoices: {
          pending:   invoiceMap["pending"]   || { count: 0, total: 0 },
          paid:      invoiceMap["paid"]      || { count: 0, total: 0 },
          cancelled: invoiceMap["cancelled"] || { count: 0, total: 0 },
        },
        monthly: monthly.rows.map(r => ({
          month: r.month,
          totalUsd: parseFloat(r.total_usd),
          count: parseInt(r.count),
        })),
        byPort: byPort.rows.map(r => ({
          portName: r.port_name,
          totalUsd: parseFloat(r.total_usd),
          count: parseInt(r.count),
        })),
      });
    } catch (err) {
      console.error("Financial report error:", err);
      res.status(500).json({ message: "Failed to generate financial report" });
    }
  });

  app.get("/api/reports/fleet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;

      const [vessels, voyagesPerVessel, certs] = await Promise.all([
        pool.query(`
          SELECT id, name, vessel_type, flag, grt, fleet_status
          FROM vessels
          WHERE user_id = $1
          ORDER BY name ASC
        `, [userId]),
        pool.query(`
          SELECT vessel_id,
                 COUNT(*) AS total_voyages,
                 SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_voyages,
                 SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_voyages
          FROM voyages
          WHERE user_id = $1 AND vessel_id IS NOT NULL
          GROUP BY vessel_id
        `, [userId]),
        pool.query(`
          SELECT vc.vessel_id,
                 COUNT(*) AS total_certs,
                 SUM(CASE WHEN vc.expires_at > NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END) AS valid,
                 SUM(CASE WHEN vc.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END) AS expiring,
                 SUM(CASE WHEN vc.expires_at < NOW() THEN 1 ELSE 0 END) AS expired
          FROM vessel_certificates vc
          JOIN vessels v ON v.id = vc.vessel_id
          WHERE v.user_id = $1
          GROUP BY vc.vessel_id
        `, [userId]),
      ]);

      const voyageMap: Record<number, any> = {};
      for (const r of voyagesPerVessel.rows) {
        voyageMap[r.vessel_id] = {
          totalVoyages: parseInt(r.total_voyages),
          activeVoyages: parseInt(r.active_voyages),
          completedVoyages: parseInt(r.completed_voyages),
        };
      }
      const certMap: Record<number, any> = {};
      for (const r of certs.rows) {
        certMap[r.vessel_id] = {
          totalCerts: parseInt(r.total_certs),
          valid: parseInt(r.valid),
          expiring: parseInt(r.expiring),
          expired: parseInt(r.expired),
        };
      }

      const vesselList = vessels.rows.map((v: any) => ({
        id: v.id,
        name: v.name,
        vesselType: v.vessel_type,
        flag: v.flag,
        grt: v.grt,
        status: v.fleet_status,
        voyages: voyageMap[v.id] || { totalVoyages: 0, activeVoyages: 0, completedVoyages: 0 },
        certs: certMap[v.id] || { totalCerts: 0, valid: 0, expiring: 0, expired: 0 },
      }));

      const totalVessels = vesselList.length;
      const activeVessels = vesselList.filter((v: any) => v.voyages.activeVoyages > 0).length;
      const totalCerts = vesselList.reduce((acc: number, v: any) => acc + v.certs.totalCerts, 0);
      const expiredCerts = vesselList.reduce((acc: number, v: any) => acc + v.certs.expired, 0);
      const expiringCerts = vesselList.reduce((acc: number, v: any) => acc + v.certs.expiring, 0);

      res.json({
        summary: {
          totalVessels,
          activeVessels,
          utilizationRate: totalVessels > 0 ? Math.round((activeVessels / totalVessels) * 100) : 0,
          totalCerts,
          expiredCerts,
          expiringCerts,
        },
        vessels: vesselList,
      });
    } catch (err) {
      console.error("Fleet report error:", err);
      res.status(500).json({ message: "Failed to generate fleet report" });
    }
  });

  app.get("/api/reports/performance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;

      const [bids, reviews, monthly] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS total_bids,
            SUM(CASE WHEN tb.status = 'selected' THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN tb.status = 'rejected' THEN 1 ELSE 0 END) AS lost,
            AVG(EXTRACT(EPOCH FROM (tb.created_at - pt.created_at)) / 3600) AS avg_response_hours
          FROM tender_bids tb
          JOIN port_tenders pt ON pt.id = tb.tender_id
          WHERE tb.agent_user_id = $1
        `, [userId]),
        pool.query(`
          SELECT
            COUNT(*) AS total_reviews,
            AVG(rating) AS avg_rating,
            SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) AS positive,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS neutral,
            SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) AS negative
          FROM voyage_reviews
          WHERE reviewee_user_id = $1
        `, [userId]),
        pool.query(`
          SELECT
            TO_CHAR(created_at, 'YYYY-MM') AS month,
            COUNT(*) AS count,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
          FROM voyages
          WHERE (user_id = $1 OR agent_user_id = $1)
            AND created_at >= NOW() - INTERVAL '12 months'
          GROUP BY month ORDER BY month ASC
        `, [userId]),
      ]);

      const b = bids.rows[0];
      const r = reviews.rows[0];

      res.json({
        bids: {
          total: parseInt(b.total_bids) || 0,
          won: parseInt(b.won) || 0,
          lost: parseInt(b.lost) || 0,
          winRate: b.total_bids > 0 ? Math.round((parseInt(b.won) / parseInt(b.total_bids)) * 100) : 0,
          avgResponseHours: b.avg_response_hours ? parseFloat(parseFloat(b.avg_response_hours).toFixed(1)) : null,
        },
        reviews: {
          total: parseInt(r.total_reviews) || 0,
          avgRating: r.avg_rating ? parseFloat(parseFloat(r.avg_rating).toFixed(2)) : null,
          positive: parseInt(r.positive) || 0,
          neutral: parseInt(r.neutral) || 0,
          negative: parseInt(r.negative) || 0,
        },
        monthly: monthly.rows.map(row => ({
          month: row.month,
          count: parseInt(row.count),
          completed: parseInt(row.completed),
        })),
      });
    } catch (err) {
      console.error("Performance report error:", err);
      res.status(500).json({ message: "Failed to generate performance report" });
    }
  });

  // ─── MARITIME DOC TEMPLATES ──────────────────────────────────────────────────

  app.get("/api/maritime-doc-templates", isAuthenticated, async (_req, res) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM maritime_doc_templates ORDER BY category, name`);
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/maritime-doc-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM maritime_doc_templates WHERE id = $1`, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ message: "Template not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/maritime-doc-templates", isAuthenticated, async (req: any, res) => {
    try {
      const { name, code, category, description, fields } = req.body;
      if (!name || !code || !fields) return res.status(400).json({ message: "name, code, fields required" });
      const { rows } = await pool.query(
        `INSERT INTO maritime_doc_templates (name, code, category, description, fields, is_built_in)
         VALUES ($1, $2, $3, $4, $5::jsonb, FALSE) RETURNING *`,
        [name, code, category || "cargo", description || "", JSON.stringify(fields)]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Template code already exists" });
      res.status(500).json({ message: "Failed" });
    }
  });

  // ─── MARITIME DOCUMENTS ───────────────────────────────────────────────────────

  app.post("/api/voyages/:id/maritime-docs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const voyageId = parseInt(req.params.id);
      const { templateId, portCallId } = req.body;
      if (!templateId) return res.status(400).json({ message: "templateId required" });

      const { rows: vRows } = await pool.query(`SELECT * FROM voyages WHERE id = $1`, [voyageId]);
      const voyage = vRows[0];
      if (!voyage) return res.status(404).json({ message: "Voyage not found" });

      const { rows: tRows } = await pool.query(`SELECT * FROM maritime_doc_templates WHERE id = $1`, [templateId]);
      const template = tRows[0];
      if (!template) return res.status(404).json({ message: "Template not found" });

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) as cnt FROM maritime_documents WHERE template_id = $1 AND voyage_id = $2`,
        [templateId, voyageId]
      );
      const seq = parseInt(countRows[0].cnt) + 1;
      const year = new Date().getFullYear();
      const docNumber = `${template.code}-${year}-${String(voyageId).padStart(3, "0")}-${seq}`;

      let portName = voyage.load_port || "";
      if (portCallId) {
        const { rows: pcRows } = await pool.query(`SELECT port_name FROM voyage_port_calls WHERE id = $1`, [portCallId]);
        if (pcRows[0]) portName = pcRows[0].port_name || portName;
      }

      const autoData: Record<string, string> = {
        vesselName: voyage.vessel_name || "",
        voyageNo: `VOY-${voyageId}`,
        loadPort: voyage.load_port || "",
        dischargePort: voyage.discharge_port || "",
        imoNumber: voyage.imo_number || "",
        portOfLoading: voyage.load_port || "",
        portOfDischarge: voyage.discharge_port || "",
        placeOfIssue: portName,
        port: portName,
      };

      const fields: any[] = Array.isArray(template.fields) ? template.fields : [];
      const data: Record<string, any> = {};
      for (const field of fields) {
        if (field.autoFill && autoData[field.autoFill]) {
          data[field.fieldName] = autoData[field.autoFill];
        } else if (field.defaultValue !== undefined && field.defaultValue !== "") {
          data[field.fieldName] = field.defaultValue;
        } else {
          data[field.fieldName] = field.fieldType === "table" ? [] : "";
        }
      }

      const { rows } = await pool.query(
        `INSERT INTO maritime_documents (template_id, voyage_id, port_call_id, user_id, organization_id, document_number, data, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', 1) RETURNING *`,
        [templateId, voyageId, portCallId || null, userId, req.organizationId || null, docNumber, JSON.stringify(data)]
      );

      const { rows: fullRows } = await pool.query(`
        SELECT md.*, mdt.name as template_name, mdt.code as template_code, mdt.category as template_category,
               mdt.fields as template_fields,
               u.first_name || ' ' || u.last_name as creator_name
        FROM maritime_documents md
        JOIN maritime_doc_templates mdt ON md.template_id = mdt.id
        JOIN users u ON md.user_id = u.id
        WHERE md.id = $1
      `, [rows[0].id]);

      res.status(201).json(fullRows[0]);
    } catch (err) {
      console.error("maritime-doc create error:", err);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.get("/api/voyages/:id/maritime-docs", isAuthenticated, async (req: any, res) => {
    try {
      const voyageId = parseInt(req.params.id);
      const { rows } = await pool.query(`
        SELECT md.*, mdt.name as template_name, mdt.code as template_code, mdt.category as template_category,
               u.first_name || ' ' || u.last_name as creator_name
        FROM maritime_documents md
        JOIN maritime_doc_templates mdt ON md.template_id = mdt.id
        JOIN users u ON md.user_id = u.id
        WHERE md.voyage_id = $1 AND md.parent_id IS NULL
        ORDER BY md.created_at DESC
      `, [voyageId]);
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/maritime-docs/:id", isAuthenticated, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT md.*, mdt.name as template_name, mdt.code as template_code, mdt.category as template_category,
               mdt.fields as template_fields, mdt.description as template_description,
               u.first_name || ' ' || u.last_name as creator_name,
               su.first_name || ' ' || su.last_name as signer_name,
               ru.first_name || ' ' || ru.last_name as reviewer_name
        FROM maritime_documents md
        JOIN maritime_doc_templates mdt ON md.template_id = mdt.id
        JOIN users u ON md.user_id = u.id
        LEFT JOIN users su ON md.signed_by_user_id = su.id
        LEFT JOIN users ru ON md.reviewed_by_user_id = ru.id
        WHERE md.id = $1
      `, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ message: "Document not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.patch("/api/maritime-docs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const docId = parseInt(req.params.id);
      const { data, notes } = req.body;

      const { rows: existing } = await pool.query(`SELECT * FROM maritime_documents WHERE id = $1`, [docId]);
      if (!existing[0]) return res.status(404).json({ message: "Document not found" });
      if (existing[0].status === "signed") return res.status(400).json({ message: "Signed documents cannot be edited" });

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (data !== undefined) { updates.push(`data = $${idx++}::jsonb`); values.push(JSON.stringify(data)); }
      if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }
      if (!updates.length) return res.status(400).json({ message: "Nothing to update" });
      values.push(docId);

      const { rows } = await pool.query(
        `UPDATE maritime_documents SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed to update" }); }
  });

  app.patch("/api/maritime-docs/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const docId = parseInt(req.params.id);
      const { status } = req.body;
      const allowed = ["draft", "pending_review", "approved", "void"];
      if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

      const updates: Record<string, any> = { status };
      if (status === "approved") {
        updates.reviewed_by_user_id = userId;
        updates.reviewed_at = new Date().toISOString();
      }

      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(", ");
      const vals = [...Object.values(updates), docId];
      const { rows } = await pool.query(
        `UPDATE maritime_documents SET ${setClauses} WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/maritime-docs/:id/sign", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const docId = parseInt(req.params.id);
      const { signatureText } = req.body;
      if (!signatureText) return res.status(400).json({ message: "signatureText required" });

      const { rows } = await pool.query(
        `UPDATE maritime_documents
         SET status = 'signed', signed_by_user_id = $1, signed_at = NOW(), signature_text = $2
         WHERE id = $3 AND status != 'void' RETURNING *`,
        [userId, signatureText, docId]
      );
      if (!rows[0]) return res.status(404).json({ message: "Document not found or voided" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/maritime-docs/:id/new-version", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const docId = parseInt(req.params.id);

      const { rows: orig } = await pool.query(`SELECT * FROM maritime_documents WHERE id = $1`, [docId]);
      if (!orig[0]) return res.status(404).json({ message: "Document not found" });

      const newVersion = orig[0].version + 1;
      const newDocNumber = orig[0].document_number ? `${orig[0].document_number}-v${newVersion}` : null;

      const { rows } = await pool.query(
        `INSERT INTO maritime_documents (template_id, voyage_id, port_call_id, user_id, organization_id, document_number, data, status, notes, version, parent_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', $8, $9, $10) RETURNING *`,
        [orig[0].template_id, orig[0].voyage_id, orig[0].port_call_id, userId,
         orig[0].organization_id, newDocNumber, JSON.stringify(orig[0].data),
         orig[0].notes, newVersion, orig[0].parent_id ?? orig[0].id]
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // ─── REMINDERS ────────────────────────────────────────────────────────────────

  app.get("/api/reminders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const filter = (req.query.filter as string) || "active";
      let whereClause = "r.user_id = $1";
      if (filter === "active") whereClause += " AND r.is_completed = FALSE AND (r.is_snoozed = FALSE OR r.snoozed_until <= NOW())";
      else if (filter === "completed") whereClause += " AND r.is_completed = TRUE";
      else if (filter === "snoozed") whereClause += " AND r.is_snoozed = TRUE AND r.snoozed_until > NOW()";

      const { rows } = await pool.query(
        `SELECT r.* FROM reminders r WHERE ${whereClause} ORDER BY
          CASE r.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
          r.due_date ASC NULLS LAST, r.created_at DESC
         LIMIT 100`,
        [userId]
      );
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) as cnt FROM reminders WHERE user_id = $1 AND is_completed = FALSE AND (is_snoozed = FALSE OR snoozed_until <= NOW())`,
        [userId]
      );
      res.json({ reminders: rows, pendingCount: parseInt(countRows[0].cnt) });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/reminders/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows } = await pool.query(
        `SELECT COUNT(*) as cnt FROM reminders WHERE user_id = $1 AND is_completed = FALSE AND (is_snoozed = FALSE OR snoozed_until <= NOW())`,
        [userId]
      );
      res.json({ count: parseInt(rows[0].cnt) });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/reminders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { title, message, category, priority, dueDate, entityType, entityId, notes } = req.body;
      if (!title || !message) return res.status(400).json({ message: "title and message required" });
      const { rows } = await pool.query(
        `INSERT INTO reminders (user_id, organization_id, type, category, title, message, entity_type, entity_id, priority, due_date)
         VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [userId, req.organizationId || null, category || "custom", title, message,
         entityType || null, entityId || null, priority || "normal", dueDate || null]
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.patch("/api/reminders/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows } = await pool.query(
        `UPDATE reminders SET is_completed = TRUE, completed_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
        [req.params.id, userId]
      );
      if (!rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.patch("/api/reminders/:id/snooze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { until } = req.body;
      if (!until) return res.status(400).json({ message: "until required" });
      const { rows } = await pool.query(
        `UPDATE reminders SET is_snoozed = TRUE, snoozed_until = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
        [until, req.params.id, userId]
      );
      if (!rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.delete("/api/reminders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      await pool.query(`DELETE FROM reminders WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
      res.status(204).end();
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // ─── REMINDER RULES ───────────────────────────────────────────────────────────

  app.get("/api/reminder-rules", isAuthenticated, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM reminder_rules WHERE organization_id IS NULL AND user_id IS NULL ORDER BY rule_type`
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.patch("/api/reminder-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const { isActive, emailEnabled, triggerCondition } = req.body;
      const updates: string[] = [];
      const vals: any[] = [];
      let i = 1;
      if (isActive !== undefined) { updates.push(`is_active = $${i++}`); vals.push(isActive); }
      if (emailEnabled !== undefined) { updates.push(`email_enabled = $${i++}`); vals.push(emailEnabled); }
      if (triggerCondition !== undefined) { updates.push(`trigger_condition = $${i++}`); vals.push(triggerCondition); }
      if (!updates.length) return res.status(400).json({ message: "Nothing to update" });
      vals.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE reminder_rules SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // ─── PORT COST BENCHMARKS ─────────────────────────────────────────────────────

  // GET /api/benchmarks/ports — all ports that have benchmark data
  app.get("/api/benchmarks/ports", async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          p.id AS port_id, p.name AS port_name, p.code,
          COUNT(DISTINCT b.purpose_of_call) AS purposes,
          SUM(b.sample_count) AS total_samples,
          MIN(b.avg_total_cost) AS min_avg_cost,
          MAX(b.avg_total_cost) AS max_avg_cost,
          MAX(b.last_updated) AS last_updated
        FROM port_cost_benchmarks b
        JOIN ports p ON p.id = b.port_id
        GROUP BY p.id, p.name, p.code
        ORDER BY total_samples DESC
      `);
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // GET /api/benchmarks/ports/:portId — detailed breakdown for a port
  app.get("/api/benchmarks/ports/:portId", async (req, res) => {
    try {
      const portId = parseInt(req.params.portId);
      const { rows } = await pool.query(
        `SELECT b.*, p.name AS port_name, p.code
         FROM port_cost_benchmarks b
         JOIN ports p ON p.id = b.port_id
         WHERE b.port_id = $1
         ORDER BY b.purpose_of_call, b.vessel_size_category`,
        [portId]
      );
      if (!rows.length) return res.status(404).json({ message: "No benchmark data for this port" });
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // GET /api/benchmarks/compare?ports=1,2,3&grt=15000&purpose=loading
  app.get("/api/benchmarks/compare", async (req, res) => {
    try {
      const portIds = ((req.query.ports as string) || "").split(",").map(Number).filter(Boolean);
      if (portIds.length < 1) return res.status(400).json({ message: "At least 1 port required" });
      const grt = parseInt(req.query.grt as string) || 10000;
      const purpose = (req.query.purpose as string) || "loading";

      // Map GRT to category
      let sizeCategory = "medium";
      if (grt < 5000) sizeCategory = "small";
      else if (grt < 20000) sizeCategory = "medium";
      else if (grt < 50000) sizeCategory = "large";
      else sizeCategory = "vlarge";

      const { rows } = await pool.query(
        `SELECT b.*, p.name AS port_name, p.code
         FROM port_cost_benchmarks b
         JOIN ports p ON p.id = b.port_id
         WHERE b.port_id = ANY($1::int[])
           AND b.purpose_of_call = $2
           AND b.vessel_size_category = $3`,
        [portIds, purpose, sizeCategory]
      );
      res.json({ rows, sizeCategory, purpose, grt });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // GET /api/benchmarks/estimate?portId=123&grt=15000&purpose=loading
  app.get("/api/benchmarks/estimate", async (req, res) => {
    try {
      const portId = parseInt(req.query.portId as string);
      if (!portId) return res.status(400).json({ message: "portId required" });
      const grt = parseInt(req.query.grt as string) || 10000;
      const purpose = (req.query.purpose as string) || "loading";

      let sizeCategory = "medium";
      if (grt < 5000) sizeCategory = "small";
      else if (grt < 20000) sizeCategory = "medium";
      else if (grt < 50000) sizeCategory = "large";
      else sizeCategory = "vlarge";

      const { rows } = await pool.query(
        `SELECT b.*, p.name AS port_name
         FROM port_cost_benchmarks b
         JOIN ports p ON p.id = b.port_id
         WHERE b.port_id = $1 AND b.purpose_of_call = $2 AND b.vessel_size_category = $3
         LIMIT 1`,
        [portId, purpose, sizeCategory]
      );
      if (!rows[0]) return res.json({ hasData: false });
      const r = rows[0];
      res.json({
        hasData: true,
        portName: r.port_name,
        sizeCategory,
        purpose,
        grt,
        avgTotalCost: r.avg_total_cost,
        minTotalCost: r.min_total_cost,
        maxTotalCost: r.max_total_cost,
        avgAgencyFee: r.avg_agency_fee,
        avgPilotage: r.avg_pilotage,
        avgTugboat: r.avg_tugboat,
        avgBerthing: r.avg_berthing,
        avgPortDues: r.avg_port_dues,
        sampleCount: r.sample_count,
        lastUpdated: r.last_updated,
        insufficientData: r.sample_count < 3,
      });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/maritime-docs/:id/versions", isAuthenticated, async (req, res) => {
    try {
      const docId = parseInt(req.params.id);
      const { rows: orig } = await pool.query(`SELECT parent_id, id FROM maritime_documents WHERE id = $1`, [docId]);
      if (!orig[0]) return res.status(404).json({ message: "Not found" });
      const rootId = orig[0].parent_id ?? orig[0].id;
      const { rows } = await pool.query(
        `SELECT md.id, md.version, md.status, md.document_number, md.created_at,
                u.first_name || ' ' || u.last_name as creator_name
         FROM maritime_documents md JOIN users u ON md.user_id = u.id
         WHERE md.id = $1 OR md.parent_id = $1 ORDER BY md.version ASC`,
        [rootId]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // ── EMAIL INBOUND SYSTEM ───────────────────────────────────────────────────

  // Webhook — receives inbound emails from email service
  app.post("/api/email/inbound", async (req, res) => {
    try {
      const { from, fromName, to, subject, bodyText, bodyHtml, attachments, secret } = req.body;
      if (process.env.EMAIL_WEBHOOK_SECRET && secret !== process.env.EMAIL_WEBHOOK_SECRET) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!from || !to) return res.status(400).json({ message: "from and to required" });

      const { resolveForwardingEmail, saveInboundEmail, classifyEmailWithAI } = await import("./email-inbound");
      const rule = await resolveForwardingEmail(to);
      const userId = rule?.userId || null;
      const organizationId = rule?.organizationId || null;
      const linkedVoyageId = rule?.linkedVoyageId || null;

      let aiClassification = "general", aiExtractedData = {}, aiSuggestion = "";
      try {
        const ai = await classifyEmailWithAI(subject || "", bodyText || "");
        aiClassification = ai.classification; aiExtractedData = ai.extractedData; aiSuggestion = ai.suggestion;
      } catch {}

      const emailId = await saveInboundEmail({ userId, organizationId, fromEmail: from, fromName: fromName || null,
        toEmail: to, subject, bodyText, bodyHtml, attachments: attachments || [],
        linkedVoyageId, aiClassification, aiExtractedData, aiSuggestion });

      if (userId) {
        await pool.query(`INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1,'email_received',$2,$3,$4)`,
          [userId, `New Email: ${subject || "(no subject)"}`, `From ${fromName || from}`, `/email-inbox`]).catch(() => {});
      }
      res.json({ success: true, emailId });
    } catch (err) { console.error("[email/inbound]", err); res.status(500).json({ message: "Failed" }); }
  });

  // Manual email add for testing
  app.post("/api/email/inbound/manual", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { fromEmail, fromName, subject, bodyText, bodyHtml, attachments, linkedVoyageId } = req.body;
      if (!fromEmail) return res.status(400).json({ message: "fromEmail required" });

      const { saveInboundEmail, classifyEmailWithAI } = await import("./email-inbound");
      const userRow = await pool.query(`SELECT active_organization_id, first_name, last_name FROM users WHERE id = $1`, [userId]);
      const u = userRow.rows[0];
      const orgId = u?.active_organization_id || null;

      const ruleRow = await pool.query(`SELECT forwarding_email FROM email_forwarding_rules WHERE user_id = $1 AND is_active = TRUE LIMIT 1`, [userId]);
      const toEmail = ruleRow.rows[0]?.forwarding_email || `manual@inbound.vesselpda.app`;

      let aiClassification = "general", aiExtractedData = {}, aiSuggestion = "";
      try {
        const ai = await classifyEmailWithAI(subject || "", bodyText || "");
        aiClassification = ai.classification; aiExtractedData = ai.extractedData; aiSuggestion = ai.suggestion;
      } catch {}

      const emailId = await saveInboundEmail({ userId, organizationId: orgId, fromEmail, fromName: fromName || null,
        toEmail, subject, bodyText, bodyHtml, attachments: attachments || [],
        linkedVoyageId: linkedVoyageId || null, aiClassification, aiExtractedData, aiSuggestion });

      res.json({ success: true, emailId });
    } catch (err) { console.error("[email/inbound/manual]", err); res.status(500).json({ message: "Failed" }); }
  });

  // Get inbox emails
  app.get("/api/email/inbox", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await pool.query(`SELECT active_organization_id FROM users WHERE id = $1`, [userId]);
      const orgId = userRow.rows[0]?.active_organization_id || null;
      const showProcessed = req.query.processed === "true";
      const { rows } = await pool.query(
        `SELECT ie.*, v.name AS voyage_name FROM inbound_emails ie
         LEFT JOIN voyages v ON v.id = ie.linked_voyage_id
         WHERE (ie.user_id = $1 OR ie.organization_id = $2) AND ie.is_processed = $3
         ORDER BY ie.received_at DESC LIMIT 100`,
        [userId, orgId, showProcessed]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Get unread count
  app.get("/api/email/inbox/count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const userRow = await pool.query(`SELECT active_organization_id FROM users WHERE id = $1`, [userId]);
      const orgId = userRow.rows[0]?.active_organization_id || null;
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM inbound_emails WHERE (user_id = $1 OR organization_id = $2) AND is_processed = FALSE`,
        [userId, orgId]
      );
      res.json({ count: parseInt(rows[0].count) });
    } catch { res.json({ count: 0 }); }
  });

  // Get single email
  app.get("/api/email/inbox/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows } = await pool.query(
        `SELECT ie.*, v.name AS voyage_name FROM inbound_emails ie
         LEFT JOIN voyages v ON v.id = ie.linked_voyage_id
         WHERE ie.id = $1 AND (ie.user_id = $2 OR ie.organization_id IN (SELECT active_organization_id FROM users WHERE id = $2))`,
        [req.params.id, userId]
      );
      if (!rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Process email
  app.post("/api/email/inbox/:id/process", isAuthenticated, async (req, res) => {
    try {
      const { action, entityId } = req.body;
      const { markEmailProcessed } = await import("./email-inbound");
      await markEmailProcessed(parseInt(req.params.id), action || "manual", entityId);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Dismiss email
  app.post("/api/email/inbox/:id/dismiss", isAuthenticated, async (req, res) => {
    try {
      await pool.query(`UPDATE inbound_emails SET is_processed = TRUE, processed_action = 'dismissed' WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Delete email
  app.delete("/api/email/inbox/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      await pool.query(`DELETE FROM inbound_emails WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Link email to voyage
  app.patch("/api/email/inbox/:id/link-voyage", isAuthenticated, async (req, res) => {
    try {
      const { voyageId } = req.body;
      await pool.query(`UPDATE inbound_emails SET linked_voyage_id = $1 WHERE id = $2`, [voyageId || null, req.params.id]);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Get forwarding rules
  app.get("/api/email/forwarding-rules", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows } = await pool.query(
        `SELECT efr.*, v.name AS voyage_name FROM email_forwarding_rules efr
         LEFT JOIN voyages v ON v.id = efr.linked_voyage_id
         WHERE efr.user_id = $1 ORDER BY efr.created_at DESC`,
        [userId]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Create forwarding rule
  app.post("/api/email/forwarding-rules", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { ruleType, linkedVoyageId } = req.body;
      const userRow = await pool.query(
        `SELECT u.first_name, u.last_name, u.active_organization_id, o.name AS org_name
         FROM users u LEFT JOIN organizations o ON o.id = u.active_organization_id WHERE u.id = $1`, [userId]
      );
      const u = userRow.rows[0];
      const slug = u?.org_name || `${u?.first_name || "user"}${u?.last_name || ""}`;
      const { generateForwardingEmail } = await import("./email-inbound");
      const forwardingEmail = generateForwardingEmail(slug);
      const { rows } = await pool.query(
        `INSERT INTO email_forwarding_rules (user_id, organization_id, forwarding_email, rule_type, linked_voyage_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, u?.active_organization_id || null, forwardingEmail, ruleType || "general", linkedVoyageId || null]
      );
      res.json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Already exists" });
      res.status(500).json({ message: "Failed" });
    }
  });

  // Delete forwarding rule
  app.delete("/api/email/forwarding-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      await pool.query(`DELETE FROM email_forwarding_rules WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Get emails for a voyage
  app.get("/api/voyages/:id/emails", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows } = await pool.query(
        `SELECT ie.* FROM inbound_emails ie
         WHERE ie.linked_voyage_id = $1
           AND (ie.user_id = $2 OR ie.organization_id IN (SELECT active_organization_id FROM users WHERE id = $2))
         ORDER BY ie.received_at DESC`,
        [req.params.id, userId]
      );
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Push notification subscription (infrastructure)
  app.post("/api/push/subscribe", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { endpoint, keys } = req.body;
      if (!endpoint) return res.status(400).json({ message: "endpoint required" });
      await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY, user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL, keys JSONB, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_id, endpoint)
      )`).catch(() => {});
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, endpoint) DO UPDATE SET keys = EXCLUDED.keys`,
        [userId, endpoint, JSON.stringify(keys || {})]
      );
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/sitemap.xml", (_req, res) => {
    const base = "https://vesselpda.com";
    const pages = [
      { url: "/", priority: "1.0", changefreq: "weekly" },
      { url: "/register", priority: "0.9", changefreq: "monthly" },
      { url: "/login", priority: "0.8", changefreq: "monthly" },
      { url: "/directory", priority: "0.8", changefreq: "daily" },
      { url: "/forum", priority: "0.7", changefreq: "daily" },
      { url: "/port-info", priority: "0.7", changefreq: "weekly" },
      { url: "/market-data", priority: "0.6", changefreq: "daily" },
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${base}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
    res.set("Content-Type", "application/xml");
    res.send(xml);
  });

  app.delete("/api/push/subscribe", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { endpoint } = req.body;
      await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]).catch(() => {});
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // ── Compliance Management ──────────────────────────────────────────────────

  app.get("/api/compliance/checklists", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { vesselId, standard } = req.query;
      let q = `SELECT cl.*, v.name AS vessel_name FROM compliance_checklists cl
               LEFT JOIN vessels v ON v.id = cl.vessel_id
               WHERE cl.user_id = $1`;
      const params: any[] = [userId];
      if (vesselId) { params.push(vesselId); q += ` AND cl.vessel_id = $${params.length}`; }
      if (standard) { params.push(standard); q += ` AND cl.standard_code = $${params.length}`; }
      q += ` ORDER BY cl.created_at DESC`;
      const { rows } = await pool.query(q, params);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/compliance/checklists", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { vesselId, organizationId, standardCode, version, notes, nextAuditDate } = req.body;
      const { getStandardTemplate, STANDARD_NAMES } = await import("./migrate-compliance");
      const items = await getStandardTemplate(standardCode);
      const standardName = STANDARD_NAMES[standardCode] || standardCode;
      const { rows: [cl] } = await pool.query(
        `INSERT INTO compliance_checklists (vessel_id, organization_id, user_id, standard_code, standard_name, version, total_items, notes, next_audit_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [vesselId || null, organizationId || null, userId, standardCode, standardName, version || null, items.length, notes || null, nextAuditDate || null]
      );
      if (items.length > 0) {
        for (const item of items) {
          await pool.query(
            `INSERT INTO compliance_items (checklist_id, section_number, section_title, requirement)
             VALUES ($1, $2, $3, $4)`,
            [cl.id, item.sn, item.title, item.req]
          );
        }
      }
      res.json(cl);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/compliance/checklists/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows: [cl] } = await pool.query(
        `SELECT cl.*, v.name AS vessel_name FROM compliance_checklists cl
         LEFT JOIN vessels v ON v.id = cl.vessel_id
         WHERE cl.id = $1 AND cl.user_id = $2`,
        [req.params.id, userId]
      );
      if (!cl) return res.status(404).json({ message: "Not found" });
      const { rows: items } = await pool.query(
        `SELECT * FROM compliance_items WHERE checklist_id = $1 ORDER BY section_number, id`,
        [cl.id]
      );
      res.json({ ...cl, items });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/compliance/checklists/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { status, notes, nextAuditDate, lastAuditDate, auditorName } = req.body;
      const { rows: [cl] } = await pool.query(
        `UPDATE compliance_checklists SET status = COALESCE($3, status), notes = COALESCE($4, notes),
         next_audit_date = COALESCE($5, next_audit_date), last_audit_date = COALESCE($6, last_audit_date),
         auditor_name = COALESCE($7, auditor_name)
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [req.params.id, userId, status || null, notes || null, nextAuditDate || null, lastAuditDate || null, auditorName || null]
      );
      res.json(cl);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/compliance/checklists/:id/items", isAuthenticated, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM compliance_items WHERE checklist_id = $1 ORDER BY section_number, id`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/compliance/items/:itemId", isAuthenticated, async (req, res) => {
    try {
      const { isCompliant, evidence, evidenceFileUrl, responsiblePerson, dueDate, findingType,
              correctiveAction, correctiveActionDueDate, correctiveActionStatus, notes } = req.body;
      const { rows: [item] } = await pool.query(
        `UPDATE compliance_items SET
           is_compliant = COALESCE($2, is_compliant),
           evidence = COALESCE($3, evidence),
           evidence_file_url = COALESCE($4, evidence_file_url),
           responsible_person = COALESCE($5, responsible_person),
           due_date = COALESCE($6, due_date),
           finding_type = COALESCE($7, finding_type),
           corrective_action = COALESCE($8, corrective_action),
           corrective_action_due_date = COALESCE($9, corrective_action_due_date),
           corrective_action_status = COALESCE($10, corrective_action_status),
           notes = COALESCE($11, notes),
           completed_date = CASE WHEN $2 = TRUE AND completed_date IS NULL THEN NOW() WHEN $2 = FALSE THEN NULL ELSE completed_date END,
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.itemId, isCompliant ?? null, evidence ?? null, evidenceFileUrl ?? null,
         responsiblePerson ?? null, dueDate ?? null, findingType ?? null,
         correctiveAction ?? null, correctiveActionDueDate ?? null, correctiveActionStatus ?? null, notes ?? null]
      );
      if (!item) return res.status(404).json({ message: "Not found" });
      const { rows: [stats] } = await pool.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_compliant) AS completed
         FROM compliance_items WHERE checklist_id = $1`,
        [item.checklist_id]
      );
      const total = parseInt(stats.total);
      const completed = parseInt(stats.completed);
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const status = pct === 100 ? "compliant" : pct === 0 ? "not_started" : "in_progress";
      await pool.query(
        `UPDATE compliance_checklists SET completed_items = $2, compliance_percentage = $3, status = $4, total_items = $5
         WHERE id = $1`,
        [item.checklist_id, completed, pct, status, total]
      );
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/compliance/checklists/:id/audits", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { auditType, auditorName, auditorOrganization, auditDate, findings, overallResult, reportFileUrl, nextAuditDate, notes } = req.body;
      const { rows: [audit] } = await pool.query(
        `INSERT INTO compliance_audits (checklist_id, audit_type, auditor_name, auditor_organization, audit_date, findings, overall_result, report_file_url, next_audit_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [req.params.id, auditType, auditorName, auditorOrganization || null,
         auditDate, JSON.stringify(findings || []), overallResult || null,
         reportFileUrl || null, nextAuditDate || null, notes || null]
      );
      await pool.query(
        `UPDATE compliance_checklists SET last_audit_date = $2, auditor_name = $3,
         next_audit_date = COALESCE($4, next_audit_date)
         WHERE id = $1`,
        [req.params.id, auditDate, auditorName, nextAuditDate || null]
      );
      res.json(audit);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/compliance/checklists/:id/audits", isAuthenticated, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM compliance_audits WHERE checklist_id = $1 ORDER BY audit_date DESC`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/compliance/dashboard", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows: checklists } = await pool.query(
        `SELECT cl.*, v.name AS vessel_name FROM compliance_checklists cl
         LEFT JOIN vessels v ON v.id = cl.vessel_id
         WHERE cl.user_id = $1 ORDER BY cl.standard_code, cl.created_at DESC`,
        [userId]
      );
      const { rows: openFindings } = await pool.query(
        `SELECT ci.* FROM compliance_items ci
         JOIN compliance_checklists cl ON cl.id = ci.checklist_id
         WHERE cl.user_id = $1 AND ci.finding_type IN ('non_conformity','major_non_conformity')
           AND ci.corrective_action_status IN ('open','in_progress')`,
        [userId]
      );
      const { rows: upcomingAudits } = await pool.query(
        `SELECT cl.*, v.name AS vessel_name FROM compliance_checklists cl
         LEFT JOIN vessels v ON v.id = cl.vessel_id
         WHERE cl.user_id = $1 AND cl.next_audit_date IS NOT NULL
           AND cl.next_audit_date > NOW() AND cl.next_audit_date < NOW() + INTERVAL '90 days'
         ORDER BY cl.next_audit_date`,
        [userId]
      );
      const byStandard: Record<string, any> = {};
      for (const cl of checklists) {
        if (!byStandard[cl.standard_code] || (cl.compliance_percentage ?? 0) > (byStandard[cl.standard_code].compliance_percentage ?? 0)) {
          byStandard[cl.standard_code] = cl;
        }
      }
      res.json({ checklists, byStandard, openFindings, upcomingAudits });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/compliance/vessels/:vesselId/status", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows } = await pool.query(
        `SELECT cl.*, v.name AS vessel_name FROM compliance_checklists cl
         LEFT JOIN vessels v ON v.id = cl.vessel_id
         WHERE cl.user_id = $1 AND cl.vessel_id = $2 ORDER BY cl.standard_code`,
        [userId, req.params.vesselId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/compliance/expiring", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { rows } = await pool.query(
        `SELECT cl.*, v.name AS vessel_name,
           EXTRACT(DAY FROM cl.next_audit_date - NOW()) AS days_until_audit
         FROM compliance_checklists cl
         LEFT JOIN vessels v ON v.id = cl.vessel_id
         WHERE cl.user_id = $1 AND cl.next_audit_date IS NOT NULL
           AND cl.next_audit_date < NOW() + INTERVAL '90 days'
         ORDER BY cl.next_audit_date`,
        [userId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/compliance/checklists/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      await pool.query(`DELETE FROM compliance_checklists WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return httpServer;
}
