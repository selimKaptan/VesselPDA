import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin, vesselBodySchema } from "./shared";
import { saveBase64File } from "../file-storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as datalastic from "../datalastic";
import { syncVesselStatuses } from "../vessel-status-sync";

const router = Router();

// POST /api/vessels/sync-statuses — auto-derive fleet_status from port_call + voyage
router.post("/sync-statuses", isAuthenticated, async (_req: any, res: any) => {
  try {
    const result = await syncVesselStatuses();
    res.json({ success: true, updated: result.updated });
  } catch (error: any) {
    console.error("[vessels:sync-statuses] error:", error?.message);
    res.status(500).json({ message: "Senkronizasyon başarısız" });
  }
});

router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    if (await isAdmin(req)) {
      const vessels = await storage.getAllVessels();
      return res.json(vessels);
    }
    const vessels = await storage.getVesselsByUser(userId, req.organizationId);
    res.json(vessels);
  } catch (error) {
    console.error("[vessels:GET] fetch failed:", error);
    next(error);
  }
});


router.post("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const vesselParsed = vesselBodySchema.safeParse(req.body);
    if (!vesselParsed.success) return res.status(400).json({ error: "Invalid input", details: vesselParsed.error.errors });
    const { name, flag, vesselType, grt, nrt } = req.body;
    if (!name || !flag || !vesselType || !grt || !nrt) {
      return res.status(400).json({ message: "name, flag, vesselType, grt, and nrt are required" });
    }
    const vessel = await storage.createVessel({
      ...req.body,
      userId,
      ...(req.organizationId ? { organizationId: req.organizationId } : {}),
      grt: Number(grt),
      nrt: Number(nrt),
      dwt: req.body.dwt ? Number(req.body.dwt) : null,
      loa: req.body.loa ? Number(req.body.loa) : null,
      beam: req.body.beam ? Number(req.body.beam) : null,
    });
    res.json(vessel);
  } catch (error) {
    console.error("[vessels:POST] create failed:", error);
    next(error);
  }
});


router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const vesselPatchParsed = vesselBodySchema.safeParse(req.body);
    if (!vesselPatchParsed.success) return res.status(400).json({ error: "Invalid input", details: vesselPatchParsed.error.errors });
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


router.delete("/:id", isAuthenticated, async (req: any, res) => {
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

router.post("/:id/restore", isAuthenticated, async (req: any, res) => {
  try {
    const admin = await isAdmin(req);
    if (!admin) return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    const restored = await storage.restoreVessel(id);
    if (!restored) return res.status(404).json({ message: "Vessel not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to restore vessel" });
  }
});


function mapDatalasticVessel(d: datalastic.DatalasticVessel, fallbackImo?: string) {
  const typeMap: Record<string, string> = {
    "bulk carrier": "Bulk Carrier", "container": "Container Ship",
    "tanker": "Tanker", "ro-ro": "Ro-Ro", "passenger": "Passenger",
    "chemical": "Chemical Tanker", "lpg": "LPG Carrier",
    "lng": "LNG Carrier", "reefer": "Reefer",
    "general cargo": "General Cargo", "cargo": "General Cargo",
    "tug": "Tug", "supply": "Supply Vessel", "fishing": "Fishing Vessel",
  };
  const rawType = (d.vessel_type || "").toLowerCase();
  const mappedType = Object.entries(typeMap).find(([k]) => rawType.includes(k))?.[1] || "General Cargo";
  return {
    datalasticUuid: d.uuid,
    name: d.name || "",
    flag: d.flag || "Turkey",
    vesselType: mappedType,
    imoNumber: d.imo ? String(d.imo) : fallbackImo || "",
    mmsi: d.mmsi ? String(d.mmsi) : null,
    callSign: d.call_sign || null,
    yearBuilt: d.year_built || null,
    grt: d.grt || null,
    nrt: d.nrt || null,
    dwt: d.dwt || null,
    loa: d.loa || null,
    beam: d.beam || null,
    enginePower: d.engine_power || null,
    engineType: d.engine_type || null,
    classificationSociety: d.classification_society || null,
  };
}

function isNetworkError(err: any): boolean {
  const msg = (err?.message || err?.cause?.message || "").toLowerCase();
  return msg.includes("fetch failed") || msg.includes("enotfound") ||
    msg.includes("could not resolve") || msg.includes("econnrefused") ||
    msg.includes("etimedout") || msg.includes("network");
}

async function zylaVesselLookup(imo: string): Promise<any | null> {
  const apiKey = process.env.VESSEL_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://vessel-information.p.rapidapi.com/vessel?imo=${imo}`,
      {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "vessel-information.p.rapidapi.com",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`Zyla Labs vessel lookup failed: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
      return null;
    }
    const raw = await response.json();
    if (!raw) return null;
    const data = raw.data ?? raw.vessel ?? raw.result ?? raw;
    if (!data || typeof data !== "object" || data.message) return null;
    const typeMap: Record<string, string> = {
      "bulk": "Bulk Carrier", "container": "Container Ship", "tanker": "Tanker",
      "ro-ro": "Ro-Ro", "passenger": "Passenger", "chemical": "Chemical Tanker",
      "lpg": "LPG Carrier", "lng": "LNG Carrier", "cargo": "General Cargo",
      "tug": "Tug", "supply": "Supply Vessel", "fishing": "Fishing Vessel",
    };
    const rawType = (data.vessel_type || data.type || "").toLowerCase();
    const vesselType = Object.entries(typeMap).find(([k]) => rawType.includes(k))?.[1] || "General Cargo";
    return {
      name: data.name || data.vessel_name || "",
      flag: data.flag || data.country || "Turkey",
      vesselType,
      imoNumber: imo,
      mmsi: data.mmsi ? String(data.mmsi) : null,
      callSign: data.call_sign || data.callsign || null,
      yearBuilt: data.year_built || data.built || null,
      grt: data.gross_tonnage || data.grt || null,
      nrt: data.net_tonnage || data.nrt || null,
      dwt: data.deadweight || data.dwt || null,
      loa: data.length || data.loa || null,
      beam: data.beam || data.width || null,
      datalasticUuid: null,
      enginePower: null,
      engineType: null,
      classificationSociety: data.class_society || null,
    };
  } catch (err: any) {
    console.error("Zyla Labs vessel lookup error:", err.message);
    return null;
  }
}

router.get("/lookup", isAuthenticated, async (req, res) => {
  const imo = (req.query.imo as string || "").replace(/\D/g, "");
  if (!imo || imo.length < 5) {
    return res.status(400).json({ message: "Geçerli bir IMO numarası girin (5–7 rakam)" });
  }

  if (process.env.DATALASTIC_API_KEY) {
    try {
      const results = await datalastic.findVessel(imo, "imo");
      if (results.length) {
        const d = results[0];
        let specs = d;
        // Enrich with uuid-based full record
        if (d.uuid) {
          const full = await datalastic.getVesselByUuid(d.uuid).catch(() => null);
          if (full) specs = { ...d, ...full };
        }
        // Enrich with vessel_info for technical specs (GRT/NRT/DWT/LOA/Beam)
        const info = await datalastic.getVesselInfo({ imo }).catch(() => null);
        if (info) {
          specs = {
            ...specs,
            grt: info.gross_tonnage ?? info.grt ?? specs.grt,
            nrt: info.net_tonnage ?? info.nrt ?? specs.nrt,
            dwt: info.deadweight ?? info.dwt ?? specs.dwt,
            loa: info.length_overall ?? info.loa ?? info.length ?? specs.loa,
            beam: info.beam ?? info.breadth ?? info.width ?? specs.beam,
            year_built: info.year_built ?? info.built ?? specs.year_built,
            call_sign: info.call_sign ?? info.callsign ?? specs.call_sign,
          };
        }
        const mapped = mapDatalasticVessel(specs, imo);
        if (!mapped.grt && process.env.VESSEL_API_KEY) {
          const zyla = await zylaVesselLookup(imo);
          if (zyla) {
            if (!mapped.grt  && zyla.grt)  mapped.grt  = zyla.grt;
            if (!mapped.nrt  && zyla.nrt)  mapped.nrt  = zyla.nrt;
            if (!mapped.dwt  && zyla.dwt)  mapped.dwt  = zyla.dwt;
            if (!mapped.loa  && zyla.loa)  mapped.loa  = zyla.loa;
            if (!mapped.beam && zyla.beam) mapped.beam = zyla.beam;
          }
        }
        return res.json(mapped);
      }
    } catch (error: any) {
      if (!isNetworkError(error)) {
        console.error("Vessel lookup (Datalastic) error:", error.message);
        return res.status(502).json({ message: "Sorgulama başarısız. Tekrar deneyin veya bilgileri manuel girin." });
      }
      console.warn("Datalastic unreachable, falling back to Zyla Labs:", error.message);
    }
  }

  const zylaData = await zylaVesselLookup(imo);
  if (zylaData) return res.json(zylaData);

  return res.status(502).json({ message: "Gemi bilgisi alınamadı. İnternet bağlantısını kontrol edin veya bilgileri manuel girin." });
});

router.get("/finder", isAuthenticated, async (req, res) => {
  const q = (req.query.q as string || "").trim();
  const type = (req.query.type as string || "imo") as "name" | "imo" | "mmsi";
  if (!q || q.length < 2) return res.status(400).json({ message: "En az 2 karakter girin" });
  if (type === "name") {
    return res.status(400).json({ message: "Datalastic ad aramasını desteklemiyor. IMO veya MMSI ile arayın." });
  }
  if (!process.env.DATALASTIC_API_KEY) return res.status(503).json({ message: "DATALASTIC_API_KEY yapılandırılmamış." });
  try {
    const results = await datalastic.findVessel(q, type);
    if (!results.length) return res.json([]);

    // Enrich first result with vessel_info for technical specs (GRT/NRT/DWT/LOA/Beam)
    const enriched = await Promise.all(
      results.slice(0, 15).map(async (d, i) => {
        let specs = d;
        // Only enrich first result or exact IMO match to avoid excess API calls
        const isExact = type === "imo" || i === 0;
        if (isExact && d.imo) {
          const info = await datalastic.getVesselInfo({ imo: String(d.imo) }).catch(() => null);
          if (info) {
            specs = {
              ...specs,
              grt: info.gross_tonnage ?? info.grt ?? specs.grt,
              nrt: info.net_tonnage ?? info.nrt ?? specs.nrt,
              dwt: info.deadweight ?? info.dwt ?? specs.dwt,
              loa: info.length_overall ?? info.loa ?? info.length ?? specs.loa,
              beam: info.beam ?? info.breadth ?? info.width ?? specs.beam,
              year_built: info.year_built ?? info.built ?? specs.year_built,
              call_sign: info.call_sign ?? info.callsign ?? specs.call_sign,
            };
          }
        }
        return mapDatalasticVessel(specs);
      })
    );
    res.json(enriched);
  } catch (error: any) {
    console.error("Vessel finder error:", error.message);
    res.status(502).json({ message: "Arama başarısız. IMO numarası veya MMSI kullanın." });
  }
});

router.get("/live-position", isAuthenticated, async (req, res) => {
  const imo  = (req.query.imo  as string || "").trim();
  const mmsi = (req.query.mmsi as string || "").trim();
  if (!imo && !mmsi) return res.status(400).json({ message: "imo veya mmsi gerekli" });
  if (!process.env.DATALASTIC_API_KEY) return res.status(503).json({ message: "DATALASTIC_API_KEY yapılandırılmamış." });
  try {
    // 1. Önce gemi bul → uuid
    const vessels = await datalastic.findVessel(imo || mmsi, imo ? "imo" : "mmsi");
    if (!vessels.length) return res.status(404).json({ message: "Gemi bulunamadı" });
    const vessel = vessels[0];
    const uuid   = vessel.uuid;

    // 2. Canlı pozisyon (getCurrentPosition artık normalize ediyor)
    let livePosition: any = null;
    if (uuid) {
      livePosition = await datalastic.getCurrentPosition(uuid);
    }

    // 3. Koordinat doğrulama
    if (livePosition) {
      const { latitude: lat, longitude: lng } = livePosition;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        livePosition.latitude  = null;
        livePosition.longitude = null;
      }
    }

    // 4. findVessel verisinden de fallback koordinat al
    const finalLat = livePosition?.latitude  ?? vessel.latitude;
    const finalLng = livePosition?.longitude ?? vessel.longitude;

    res.json({
      uuid,
      name:               vessel.name,
      imo:                vessel.imo,
      mmsi:               vessel.mmsi,
      flag:               vessel.flag,
      vesselType:         vessel.vessel_type,
      latitude:           finalLat,
      longitude:          finalLng,
      speed:              livePosition?.speed             ?? vessel.speed,
      course:             livePosition?.course            ?? vessel.course,
      heading:            livePosition?.heading           ?? vessel.heading,
      destination:        livePosition?.destination       ?? vessel.destination,
      eta:                livePosition?.eta               ?? vessel.eta,
      navigation_status:  livePosition?.navigation_status ?? vessel.status,
      port_name:          livePosition?.port_name         ?? null,
      country:            livePosition?.country           ?? null,
      timestamp:          livePosition?.timestamp         ?? null,
      source:             "datalastic",
    });
  } catch (error: any) {
    console.error("Live position error:", error.message);
    res.status(502).json({ message: "Konum alınamadı." });
  }
});

router.get("/port-call-history", isAuthenticated, async (req, res) => {
  const imo = (req.query.imo as string || "").trim();
  if (!imo) return res.status(400).json({ message: "imo gerekli" });
  if (!process.env.DATALASTIC_API_KEY) return res.status(503).json({ message: "DATALASTIC_API_KEY yapılandırılmamış." });
  try {
    const uuid = await datalastic.resolveUuid(imo);
    if (!uuid) return res.status(404).json({ message: "Gemi bulunamadı" });
    const calls = await datalastic.getPortCalls(uuid);
    res.json(calls.slice(0, 20));
  } catch (error: any) {
    console.error("Port call history error:", error.message);
    res.status(502).json({ message: "Liman geçmişi alınamadı." });
  }
});

router.get("/:vesselId/datalastic-inspections", isAuthenticated, async (req: any, res) => {
  const vesselId = parseInt(req.params.vesselId);
  if (!process.env.DATALASTIC_API_KEY) return res.status(503).json({ message: "DATALASTIC_API_KEY yapılandırılmamış." });
  try {
    const vessel = await storage.getVesselById(vesselId);
    if (!vessel) return res.status(404).json({ message: "Gemi bulunamadı" });
    let uuid = (vessel as any).datalasticUuid;
    if (!uuid) {
      uuid = await datalastic.resolveUuid(vessel.imoNumber, (vessel as any).mmsi, vessel.name);
    }
    if (!uuid) return res.status(404).json({ message: "Datalastic'te bu gemi bulunamadı" });
    const inspections = await datalastic.getInspections(uuid);
    res.json(inspections);
  } catch (error: any) {
    console.error("Datalastic inspections error:", error.message);
    res.status(502).json({ message: "Denetim kayıtları alınamadı." });
  }
});

router.get("/:vesselId/datalastic-track", isAuthenticated, async (req: any, res) => {
  const vesselId = parseInt(req.params.vesselId);
  if (!process.env.DATALASTIC_API_KEY) return res.status(503).json({ message: "DATALASTIC_API_KEY yapılandırılmamış." });
  try {
    const vessel = await storage.getVesselById(vesselId);
    if (!vessel) return res.status(404).json({ message: "Gemi bulunamadı" });
    let uuid = (vessel as any).datalasticUuid;
    if (!uuid) {
      uuid = await datalastic.resolveUuid(vessel.imoNumber, (vessel as any).mmsi, vessel.name);
    }
    if (!uuid) return res.status(404).json({ message: "Datalastic'te bu gemi bulunamadı" });
    const track = await datalastic.getHistoricalTrack(uuid);
    if (!track.length) return res.json({ type: "FeatureCollection", features: [], line: null, count: 0 });
    const pointFeatures = track.map((p: datalastic.DatalasticTrackPoint) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: { speed: p.speed, course: p.course, timestamp: p.timestamp },
    }));
    const lineCoords = track.map((p: datalastic.DatalasticTrackPoint) => [p.longitude, p.latitude]);
    res.json({
      type: "FeatureCollection",
      count: track.length,
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


router.get("/:vesselId/certificates", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const certs = await storage.getVesselCertificates(vesselId);
    res.json(certs);
  } catch {
    res.status(500).json({ message: "Failed to fetch certificates" });
  }
});


router.post("/:vesselId/certificates", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user?.claims?.sub || req.user?.id;
    const { fileBase64, ...certData } = req.body;

    let resolvedFileUrl = certData.fileUrl || null;
    if (fileBase64 && !certData.fileUrl) {
      try {
        resolvedFileUrl = saveBase64File(fileBase64, "certificates");
      } catch (err) {
        console.error("[vessel-certs] Failed to save certificate file to disk:", err);
      }
    }

    const cert = await storage.createVesselCertificate({
      ...certData,
      vesselId,
      userId,
      fileBase64: null,
      fileUrl: resolvedFileUrl,
    });
    res.status(201).json(cert);
  } catch {
    res.status(500).json({ message: "Failed to create certificate" });
  }
});


router.patch("/:vesselId/certificates/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateVesselCertificate(id, req.body);
    if (!updated) return res.status(404).json({ message: "Certificate not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update certificate" });
  }
});


router.delete("/:vesselId/certificates/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteVesselCertificate(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete certificate" });
  }
});


router.get("/:vesselId/vault-stats", isAuthenticated, async (req: any, res) => {
  try {
    const STATUTORY_COUNT = 18;
    const vesselId = parseInt(req.params.vesselId);
    const certs = await storage.getVesselCertificates(vesselId);
    const statutory = certs.filter((c: any) => c.category === "statutory" && c.vaultDocType);
    const uploadedKeys = new Set(statutory.map((c: any) => c.vaultDocType));
    const uploaded = uploadedKeys.size;
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expired = statutory.filter((c: any) => c.expiresAt && new Date(c.expiresAt) < now).length;
    const expiring = statutory.filter((c: any) => c.expiresAt && new Date(c.expiresAt) >= now && new Date(c.expiresAt) <= thirtyDays).length;
    res.json({ total: STATUTORY_COUNT, uploaded, expired, expiring, missing: STATUTORY_COUNT - uploaded });
  } catch {
    res.status(500).json({ message: "Failed to fetch vault stats" });
  }
});


router.get("/crew-roster", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const roster = await storage.getCrewRoster(userId);
    res.json(roster);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew roster" });
  }
});


router.get("/:vesselId/crew", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const crew = await storage.getVesselCrew(vesselId);
    res.json(crew);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew" });
  }
});


router.post("/:vesselId/crew", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user?.claims?.sub || req.user?.id;
    const { passportFileBase64, seamansBookFileBase64, medicalFitnessFileBase64, ...crewData } = req.body;

    // Save passport and seaman book files to filesystem
    let passportFileUrl: string | null = null;
    let passportBase64ToStore: string | null = null;
    if (passportFileBase64) {
      try {
        passportFileUrl = saveBase64File(passportFileBase64, "crew");
      } catch {
        passportBase64ToStore = passportFileBase64;
      }
    }

    let seamansBookFileUrl: string | null = null;
    let seamansBase64ToStore: string | null = null;
    if (seamansBookFileBase64) {
      try {
        seamansBookFileUrl = saveBase64File(seamansBookFileBase64, "crew");
      } catch {
        seamansBase64ToStore = seamansBookFileBase64;
      }
    }

    let medicalFitnessFileUrl: string | null = null;
    let medicalBase64ToStore: string | null = null;
    if (medicalFitnessFileBase64) {
      try {
        medicalFitnessFileUrl = saveBase64File(medicalFitnessFileBase64, "crew");
      } catch {
        medicalBase64ToStore = medicalFitnessFileBase64;
      }
    }

    const member = await storage.createVesselCrewMember({
      ...crewData,
      vesselId,
      userId,
      passportFileBase64: passportBase64ToStore,
      passportFileUrl,
      seamansBookFileBase64: seamansBase64ToStore,
      seamansBookFileUrl,
      medicalFitnessFileBase64: medicalBase64ToStore,
      medicalFitnessFileUrl,
    } as any);
    res.status(201).json(member);
  } catch {
    res.status(500).json({ message: "Failed to create crew member" });
  }
});


router.patch("/:vesselId/crew/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const vesselId = parseInt(req.params.vesselId);
    const { passportFileBase64, seamansBookFileBase64, medicalFitnessFileBase64, ...patchData } = req.body;

    if (passportFileBase64) {
      try { patchData.passportFileUrl = saveBase64File(passportFileBase64, "crew"); }
      catch { patchData.passportFileBase64 = passportFileBase64; }
    }
    if (seamansBookFileBase64) {
      try { patchData.seamansBookFileUrl = saveBase64File(seamansBookFileBase64, "crew"); }
      catch { patchData.seamansBookFileBase64 = seamansBookFileBase64; }
    }
    if (medicalFitnessFileBase64) {
      try { patchData.medicalFitnessFileUrl = saveBase64File(medicalFitnessFileBase64, "crew"); }
      catch { patchData.medicalFitnessFileBase64 = medicalFitnessFileBase64; }
    }

    const updated = await storage.updateVesselCrewMember(id, patchData);
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update crew member" });
  }
});


router.delete("/:vesselId/crew/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteVesselCrewMember(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete crew member" });
  }
});


export default router;
