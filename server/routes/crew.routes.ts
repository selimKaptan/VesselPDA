import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

// Existing crew routes are handled by vessel routes mostly, but we add more here

router.get("/:crewId/stcw-certs", isAuthenticated, async (req: any, res) => {
  try {
    const crewId = parseInt(req.params.crewId);
    const certs = await storage.getCrewStcwCerts(crewId);
    res.json(certs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch STCW certificates" });
  }
});

router.post("/:crewId/stcw-certs", isAuthenticated, async (req: any, res) => {
  try {
    const crewId = parseInt(req.params.crewId);
    const cert = await storage.createCrewStcwCert({
      ...req.body,
      crewId,
      issueDate: req.body.issueDate ? new Date(req.body.issueDate) : null,
      expiryDate: new Date(req.body.expiryDate),
    });
    res.status(201).json(cert);
  } catch (error) {
    res.status(500).json({ message: "Failed to create STCW certificate" });
  }
});

router.patch("/stcw-certs/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const cert = await storage.updateCrewStcwCert(id, {
      ...req.body,
      issueDate: req.body.issueDate ? new Date(req.body.issueDate) : undefined,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
    });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    res.json(cert);
  } catch (error) {
    res.status(500).json({ message: "Failed to update certificate" });
  }
});

router.delete("/stcw-certs/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteCrewStcwCert(id);
    if (!deleted) return res.status(404).json({ message: "Certificate not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete certificate" });
  }
});

router.get("/vessels/:vesselId/payroll", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const payroll = await storage.getCrewPayroll(vesselId);
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch crew payroll" });
  }
});

router.post("/vessels/:vesselId/payroll", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user.claims.sub;
    const payroll = await storage.createCrewPayroll({
      ...req.body,
      vesselId,
      userId,
      paidDate: req.body.paidDate ? new Date(req.body.paidDate) : null,
    });
    res.status(201).json(payroll);
  } catch (error) {
    res.status(500).json({ message: "Failed to create payroll entry" });
  }
});

router.patch("/payroll/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const payroll = await storage.updateCrewPayroll(id, {
      ...req.body,
      paidDate: req.body.paidDate ? new Date(req.body.paidDate) : undefined,
    });
    if (!payroll) return res.status(404).json({ message: "Payroll entry not found" });
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: "Failed to update payroll entry" });
  }
});

router.get("/vessels/:vesselId/summary", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const summary = await storage.getCrewSummary(vesselId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch crew summary" });
  }
});

export default router;
