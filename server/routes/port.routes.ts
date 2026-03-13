import { Router } from "express";
import { storage } from "../storage";
import { getOrFetchRates, fetchTCMBRates } from "../exchange-rates";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { cached, invalidateCache } from "../cache";
import { findPorts, isDatalasticConfigured } from "../datalastic";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/api/ports/countries", async (_req, res, next) => {
  try {
    const countries = await cached("ports:countries", "long", async () => {
      const result = await db.execute(sql`SELECT DISTINCT country FROM ports WHERE country IS NOT NULL AND country != '' ORDER BY country`);
      return (result as any).rows.map((r: any) => r.country as string);
    });
    res.json(countries);
  } catch (err) {
    next(err);
  }
});

router.get("/api/ports", async (req: any, res: any, next: any) => {
  try {
    const q = req.query.q as string | undefined;
    const country = req.query.country as string | undefined;
    const cacheKey = `ports:list:${country || 'all'}:${q ? q.trim().toLowerCase() : ''}`;
    const portList = await cached(cacheKey, 'short', async () => {
      if (q && q.trim().length > 0) {
        const dbPorts = await storage.searchPorts(q.trim(), country);

        if (isDatalasticConfigured() && dbPorts.length < 3) {
          try {
            const datalasticPorts = await findPorts(q.trim());
            const existingLocodes = new Set(
              dbPorts.map((p: any) => (p.code || "").toUpperCase()).filter(Boolean)
            );
            const existingNames = new Set(
              dbPorts.map((p: any) => (p.name || "").toLowerCase()).filter(Boolean)
            );
            const extra = datalasticPorts
              .filter(dp => {
                const locode = (dp.locode || "").toUpperCase();
                const name = (dp.name || "").toLowerCase();
                return !existingLocodes.has(locode) && !existingNames.has(name);
              })
              .slice(0, 5)
              .map((dp, idx) => ({
                id: -(idx + 1),
                name: dp.name || "",
                code: dp.locode || "",
                country: dp.country || "",
                lat: dp.latitude ?? null,
                lng: dp.longitude ?? null,
                source: "datalastic",
              }));
            return [...dbPorts, ...extra];
          } catch {
            return dbPorts;
          }
        }

        return dbPorts;
      }
      if (country) {
        return await storage.getPorts(undefined, country);
      }
      return await storage.getPorts(100);
    });
    res.json(portList);
  } catch (error) {
    console.error("[ports:GET] fetch failed:", error);
    next(error);
  }
});


router.get("/api/ports/:id", async (req, res) => {
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


router.get("/api/port-info/:locode", async (req, res) => {
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


router.get("/api/exchange-rates", async (_req, res) => {
  try {
    const rates = await getOrFetchRates();
    res.json(rates);
  } catch (error: any) {
    console.error("Exchange rate fetch error:", error.message);
    res.status(502).json({ message: "Could not fetch live rates from TCMB. Please enter rates manually.", error: error.message });
  }
});


router.post("/api/exchange-rates/refresh", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const rates = await fetchTCMBRates();
    res.json({ success: true, rates });
  } catch (error: any) {
    console.error("Exchange rate refresh error:", error.message);
    res.status(502).json({ message: "Could not fetch live rates from TCMB.", error: error.message });
  }
});


router.get("/api/service-ports", async (req, res) => {
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


export default router;
