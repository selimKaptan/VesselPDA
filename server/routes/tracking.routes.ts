import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin, seededRandom } from "./shared";
import { startAISStream, getPositions, searchVessels, isConnected, getDataSource, getCacheSize } from "../ais-stream";
import { db, pool } from "../db";
import { sql as drizzleSql, eq, desc } from "drizzle-orm";
import * as datalastic from "../datalastic";

const router = Router();

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


router.get("/api/vessel-track/status", isAuthenticated, (_req, res) => {
  res.json({
    connected: isConnected(),
    vesselCount: getCacheSize(),
    source: getDataSource(),
    mode: getDataSource() === "live" ? "live" : "demo",
  });
});


router.get("/api/vessel-track/positions", isAuthenticated, async (_req: any, res: any, next: any) => {
  try {
    const livePositions = getPositions();
    res.json(livePositions);
  } catch (error) {
    console.error("[vessel-track/positions:GET] failed:", error);
    next(error);
  }
});


router.get("/api/vessel-track/search", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const q = (req.query.q as string || "").toLowerCase().trim();
    if (!q) return res.json([]);
    const liveResults = searchVessels(q);
    res.json(liveResults);
  } catch (error) {
    console.error("[vessel-track/search:GET] failed:", error);
    next(error);
  }
});


router.get("/api/vessel-track/watchlist", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const list = await storage.getVesselWatchlist(userId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: "Failed to get watchlist" });
  }
});


router.post("/api/vessel-track/watchlist", isAuthenticated, async (req: any, res) => {
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


router.delete("/api/vessel-track/watchlist/:id", isAuthenticated, async (req: any, res) => {
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


router.get("/api/vessel-track/fleet", isAuthenticated, async (req: any, res) => {
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


router.get("/api/vessel-track/agency-vessels", isAuthenticated, async (req: any, res) => {
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


router.get("/api/vessel-positions/:mmsi/latest", isAuthenticated, async (req, res) => {
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


router.get("/api/vessel-positions/:mmsi", isAuthenticated, async (req, res) => {
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


router.get("/api/vessel-track/history/:mmsi", isAuthenticated, async (req, res) => {
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


router.get("/datalastic-search", isAuthenticated, async (req, res) => {
  const q = (req.query.q as string || "").trim();
  const type = (req.query.type as string || "name") as "name" | "imo" | "mmsi";
  if (!q) return res.status(400).json({ message: "q gerekli" });
  if (!process.env.DATALASTIC_API_KEY) return res.status(503).json({ message: "DATALASTIC_API_KEY yapılandırılmamış." });
  try {
    const results = await datalastic.findVessel(q, type);
    res.json(results.slice(0, 10).map(v => ({
      uuid: v.uuid, name: v.name, imo: v.imo, mmsi: v.mmsi, flag: v.flag,
      vessel_type: v.vessel_type, latitude: v.latitude, longitude: v.longitude,
      speed: v.speed, destination: v.destination,
    })));
  } catch (error: any) {
    console.error("Datalastic search error:", error.message);
    res.status(502).json({ message: "Datalastic arama başarısız." });
  }
});

router.get("/datalastic-track", isAuthenticated, async (req, res) => {
  const imo = (req.query.imo as string || "").trim();
  const mmsi = (req.query.mmsi as string || "").trim();
  if (!imo && !mmsi) return res.status(400).json({ message: "imo veya mmsi gerekli" });
  if (!process.env.DATALASTIC_API_KEY) return res.status(503).json({ message: "DATALASTIC_API_KEY yapılandırılmamış." });
  try {
    const uuid = await datalastic.resolveUuid(imo || null, mmsi || null);
    if (!uuid) return res.status(404).json({ message: "Gemi bulunamadı" });
    const track = await datalastic.getHistoricalTrack(uuid);
    if (!track.length) return res.json({ type: "FeatureCollection", features: [], line: null, count: 0 });
    const pointFeatures = track.map(p => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: { speed: p.speed, course: p.course, timestamp: p.timestamp },
    }));
    const lineCoords = track.map(p => [p.longitude, p.latitude]);
    res.json({
      type: "FeatureCollection",
      count: track.length,
      source: "datalastic",
      features: pointFeatures,
      line: lineCoords.length >= 2 ? {
        type: "Feature",
        geometry: { type: "LineString", coordinates: lineCoords },
        properties: {},
      } : null,
    });
  } catch (error: any) {
    console.error("Datalastic track error:", error.message);
    res.status(502).json({ message: "Rota geçmişi alınamadı." });
  }
});

export default router;
