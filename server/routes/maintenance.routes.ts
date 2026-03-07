import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.get("/vessels/:vesselId/equipment", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const equipment = await storage.getVesselEquipment(vesselId);
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch equipment" });
  }
});

router.post("/vessels/:vesselId/equipment", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user.claims.sub;
    const equipment = await storage.createVesselEquipment({
      ...req.body,
      vesselId,
      userId,
    });
    res.status(201).json(equipment);
  } catch (error) {
    res.status(500).json({ message: "Failed to create equipment" });
  }
});

router.patch("/vessels/:vesselId/equipment/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const equipment = await storage.updateVesselEquipment(id, req.body);
    if (!equipment) return res.status(404).json({ message: "Equipment not found" });
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ message: "Failed to update equipment" });
  }
});

router.delete("/vessels/:vesselId/equipment/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteVesselEquipment(id);
    if (!deleted) return res.status(404).json({ message: "Equipment not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete equipment" });
  }
});

router.get("/vessels/:vesselId/maintenance-jobs", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const jobs = await storage.getMaintenanceJobs(vesselId, req.query as any);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch maintenance jobs" });
  }
});

router.post("/vessels/:vesselId/maintenance-jobs", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const job = await storage.createMaintenanceJob({
      ...req.body,
      vesselId,
    });
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ message: "Failed to create maintenance job" });
  }
});

router.patch("/maintenance-jobs/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = await storage.updateMaintenanceJob(id, req.body);
    if (!job) return res.status(404).json({ message: "Maintenance job not found" });
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: "Failed to update maintenance job" });
  }
});

router.get("/vessels/:vesselId/maintenance-summary", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const summary = await storage.getMaintenanceSummary(vesselId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch maintenance summary" });
  }
});

export default router;
