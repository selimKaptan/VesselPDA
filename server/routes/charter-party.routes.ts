import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const cps = await storage.getCharterParties(userId);
    res.json(cps);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch charter parties" });
  }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const cp = await storage.createCharterParty({
      ...req.body,
      userId,
      cpDate: req.body.cpDate ? new Date(req.body.cpDate) : null,
      commencementDate: req.body.commencementDate ? new Date(req.body.commencementDate) : null,
      redeliveryDate: req.body.redeliveryDate ? new Date(req.body.redeliveryDate) : null,
    });
    res.status(201).json(cp);
  } catch (error) {
    res.status(500).json({ message: "Failed to create charter party" });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const cp = await storage.updateCharterParty(id, {
      ...req.body,
      cpDate: req.body.cpDate ? new Date(req.body.cpDate) : undefined,
      commencementDate: req.body.commencementDate ? new Date(req.body.commencementDate) : undefined,
      redeliveryDate: req.body.redeliveryDate ? new Date(req.body.redeliveryDate) : undefined,
    });
    if (!cp) return res.status(404).json({ message: "Charter party not found" });
    res.json(cp);
  } catch (error) {
    res.status(500).json({ message: "Failed to update charter party" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteCharterParty(id);
    if (!deleted) return res.status(404).json({ message: "Charter party not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete charter party" });
  }
});

router.get("/:id/hire-payments", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const payments = await storage.getHirePayments(id);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch hire payments" });
  }
});

router.post("/:id/hire-payments", isAuthenticated, async (req: any, res) => {
  try {
    const charterPartyId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const payment = await storage.createHirePayment({
      ...req.body,
      charterPartyId,
      userId,
      periodFrom: new Date(req.body.periodFrom),
      periodTo: new Date(req.body.periodTo),
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      paidDate: req.body.paidDate ? new Date(req.body.paidDate) : null,
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: "Failed to create hire payment" });
  }
});

router.patch("/hire-payments/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const payment = await storage.updateHirePayment(id, {
      ...req.body,
      periodFrom: req.body.periodFrom ? new Date(req.body.periodFrom) : undefined,
      periodTo: req.body.periodTo ? new Date(req.body.periodTo) : undefined,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      paidDate: req.body.paidDate ? new Date(req.body.paidDate) : undefined,
    });
    if (!payment) return res.status(404).json({ message: "Hire payment not found" });
    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: "Failed to update hire payment" });
  }
});

router.get("/:id/off-hire", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const events = await storage.getOffHireEvents(id);
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch off-hire events" });
  }
});

router.post("/:id/off-hire", isAuthenticated, async (req: any, res) => {
  try {
    const charterPartyId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const event = await storage.createOffHireEvent({
      ...req.body,
      charterPartyId,
      userId,
      startDatetime: new Date(req.body.startDatetime),
      endDatetime: req.body.endDatetime ? new Date(req.body.endDatetime) : null,
    });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: "Failed to create off-hire event" });
  }
});

router.patch("/off-hire-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await storage.updateOffHireEvent(id, {
      ...req.body,
      startDatetime: req.body.startDatetime ? new Date(req.body.startDatetime) : undefined,
      endDatetime: req.body.endDatetime ? new Date(req.body.endDatetime) : undefined,
    });
    if (!event) return res.status(404).json({ message: "Off-hire event not found" });
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: "Failed to update off-hire event" });
  }
});

export default router;
