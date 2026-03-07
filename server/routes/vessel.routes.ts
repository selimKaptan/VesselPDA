import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin, vesselBodySchema } from "./shared";
import { saveBase64File } from "../file-storage";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    if (await isAdmin(req)) {
      const vessels = await storage.getAllVessels();
      return res.json(vessels);
    }
    const vessels = await storage.getVesselsByUser(userId);
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


router.get("/lookup", isAuthenticated, async (req, res) => {
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

    // Save base64 certificate file to filesystem; old DB records stay untouched
    let resolvedFileUrl = certData.fileUrl || null;
    let base64ToStore: string | null = null;
    if (fileBase64 && !certData.fileUrl) {
      try {
        resolvedFileUrl = saveBase64File(fileBase64, "certificates");
      } catch {
        base64ToStore = fileBase64;
      }
    }

    const cert = await storage.createVesselCertificate({
      ...certData,
      vesselId,
      userId,
      fileBase64: base64ToStore,
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
