import { startAISStream, getPositions, searchVessels, isConnected, getCacheSize } from "../ais-stream";
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

router.get("/vessels", isAuthenticated, async (req: any, res) => {
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

router.post("/vessels", isAuthenticated, async (req: any, res) => {
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

router.patch("/vessels/:id", isAuthenticated, async (req: any, res) => {
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

router.delete("/vessels/:id", isAuthenticated, async (req: any, res) => {
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

router.get("/vessels/lookup", isAuthenticated, async (req, res) => {
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

router.get("/vessel-track/status", isAuthenticated, (_req, res) => {
  const liveCount = getCacheSize();
  const live = isConnected() || liveCount > 0;
  res.json({
    connected: isConnected(),
    vesselCount: live ? liveCount : MOCK_AIS_DATA.length,
    mode: live ? "live" : "demo",
  });
});

router.get("/vessel-track/positions", isAuthenticated, async (_req, res) => {
  const livePositions = getPositions();
  res.json(livePositions.length > 0 ? livePositions : MOCK_AIS_DATA);
});

router.get("/vessel-track/search", isAuthenticated, async (req, res) => {
  const q = (req.query.q as string || "").toLowerCase().trim();
  if (!q) return res.json([]);
  const liveResults = searchVessels(q);
  if (liveResults.length > 0) return res.json(liveResults);
  const results = MOCK_AIS_DATA.filter(v =>
    v.name.toLowerCase().includes(q) || v.mmsi.includes(q)
  );
  res.json(results);
});

router.get("/vessel-track/watchlist", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const list = await storage.getVesselWatchlist(userId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: "Failed to get watchlist" });
  }
});

router.post("/vessel-track/watchlist", isAuthenticated, async (req: any, res) => {
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

router.delete("/vessel-track/watchlist/:id", isAuthenticated, async (req: any, res) => {
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

router.get("/vessel-track/fleet", isAuthenticated, async (req: any, res) => {
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

router.get("/vessel-track/agency-vessels", isAuthenticated, async (req: any, res) => {
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

router.get("/vessel-positions/:mmsi/latest", isAuthenticated, async (req, res) => {
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

router.get("/vessel-positions/:mmsi", isAuthenticated, async (req, res) => {
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

router.get("/vessel-track/history/:mmsi", isAuthenticated, async (req, res) => {
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

router.get("/tenders/:id/bids/:bidId/pdf", isAuthenticated, async (req: any, res) => {
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

// ─── VESSEL CERTIFICATES ────────────────────────────────────────────────────

router.get("/vessels/:vesselId/certificates", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const certs = await storage.getVesselCertificates(vesselId);
    res.json(certs);
  } catch {
    res.status(500).json({ message: "Failed to fetch certificates" });
  }
});

router.post("/vessels/:vesselId/certificates", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user?.claims?.sub || req.user?.id;
    const cert = await storage.createVesselCertificate({ ...req.body, vesselId, userId });
    res.status(201).json(cert);
  } catch {
    res.status(500).json({ message: "Failed to create certificate" });
  }
});

router.patch("/vessels/:vesselId/certificates/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateVesselCertificate(id, req.body);
    if (!updated) return res.status(404).json({ message: "Certificate not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update certificate" });
  }
});

router.delete("/vessels/:vesselId/certificates/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteVesselCertificate(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete certificate" });
  }
});

router.get("/certificates/expiring", isAuthenticated, async (req: any, res) => {
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

router.get("/vessels/:vesselId/crew", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const crew = await storage.getVesselCrew(vesselId);
    res.json(crew);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew" });
  }
});

router.post("/vessels/:vesselId/crew", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user?.claims?.sub || req.user?.id;
    const member = await storage.createVesselCrewMember({ ...req.body, vesselId, userId });
    res.status(201).json(member);
  } catch {
    res.status(500).json({ message: "Failed to create crew member" });
  }
});

router.patch("/vessels/:vesselId/crew/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateVesselCrewMember(id, req.body);
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update crew member" });
  }
});

router.delete("/vessels/:vesselId/crew/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteVesselCrewMember(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete crew member" });
  }
});


export default router;
