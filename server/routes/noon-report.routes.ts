import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.get("/vessels/:vesselId/noon-reports", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const { voyageId, from, to } = req.query;
    const reports = await storage.getNoonReports(vesselId, {
      voyageId: voyageId ? parseInt(voyageId as string) : undefined,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch noon reports" });
  }
});

router.post("/vessels/:vesselId/noon-reports", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user.claims.sub;
    const report = await storage.createNoonReport({
      ...req.body,
      vesselId,
      userId,
      reportDate: new Date(req.body.reportDate),
      eta: req.body.eta ? new Date(req.body.eta) : null,
    });
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: "Failed to create noon report" });
  }
});

router.patch("/noon-reports/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const report = await storage.updateNoonReport(id, {
      ...req.body,
      reportDate: req.body.reportDate ? new Date(req.body.reportDate) : undefined,
      eta: req.body.eta ? new Date(req.body.eta) : undefined,
    });
    if (!report) return res.status(404).json({ message: "Noon report not found" });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Failed to update noon report" });
  }
});

router.delete("/noon-reports/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteNoonReport(id);
    if (!deleted) return res.status(404).json({ message: "Noon report not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete noon report" });
  }
});

router.get("/vessels/:vesselId/performance-stats", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const stats = await storage.getVesselPerformanceStats(vesselId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch performance stats" });
  }
});

export default router;
