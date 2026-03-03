import path from "path";
import multer from "multer";
import { getOrFetchRates, fetchTCMBRates } from "../exchange-rates";
import { config } from "../config";

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
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

// ─── GENERIC FILE UPLOAD ──────────────────────────────────────────────────────

router.post("/files/upload", isAuthenticated, fileUpload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    const { uploadFile } = await import("./file-storage");
    const folder = (req.query.folder as string) || "documents";
    const allowedFolders = ["documents", "certificates", "crew"];
    const safeFolder = allowedFolders.includes(folder) ? folder : "documents";
    const url = uploadFile(req.file.buffer, req.file.originalname, safeFolder);
    res.json({
      url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (e: any) {
    res.status(500).json({ message: "Upload failed", error: e.message });
  }
});
router.get("/ports", async (req, res) => {
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

router.get("/ports/:id", async (req, res) => {
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

router.get("/port-info/:locode", async (req, res) => {
  try {
    const locode = req.params.locode.toUpperCase();
    const dbPort = await storage.getPortByCode(locode);

    let extended: any = null;
    const apiKey = config.VESSEL_API_KEY;
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

router.get("/exchange-rates", async (_req, res) => {
  try {
    const rates = await getOrFetchRates();
    res.json(rates);
  } catch (error: any) {
    console.error("Exchange rate fetch error:", error.message);
    res.status(502).json({ message: "Could not fetch live rates from TCMB. Please enter rates manually.", error: error.message });
  }
});

router.post("/exchange-rates/refresh", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const rates = await fetchTCMBRates();
    res.json({ success: true, rates });
  } catch (error: any) {
    console.error("Exchange rate refresh error:", error.message);
    res.status(502).json({ message: "Could not fetch live rates from TCMB.", error: error.message });
  }
});


export default router;
