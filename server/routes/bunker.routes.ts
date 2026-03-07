import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.get("/vessels/:vesselId/bunker-orders", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const orders = await storage.getBunkerOrders(vesselId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bunker orders" });
  }
});

router.post("/vessels/:vesselId/bunker-orders", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user.claims.sub;
    const order = await storage.createBunkerOrder({
      ...req.body,
      vesselId,
      userId,
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to create bunker order" });
  }
});

router.patch("/bunker-orders/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await storage.updateBunkerOrder(id, req.body);
    if (!order) return res.status(404).json({ message: "Bunker order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to update bunker order" });
  }
});

router.delete("/bunker-orders/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteBunkerOrder(id);
    if (!deleted) return res.status(404).json({ message: "Bunker order not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete bunker order" });
  }
});

router.get("/vessels/:vesselId/bunker-robs", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const robs = await storage.getBunkerRobs(vesselId);
    res.json(robs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bunker robs" });
  }
});

router.post("/vessels/:vesselId/bunker-robs", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user.claims.sub;
    const rob = await storage.createBunkerRob({
      ...req.body,
      vesselId,
      reportedBy: userId,
    });
    res.status(201).json(rob);
  } catch (error) {
    res.status(500).json({ message: "Failed to create bunker rob" });
  }
});

router.get("/vessels/:vesselId/bunker-stats", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const stats = await storage.getBunkerStats(vesselId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bunker stats" });
  }
});

export default router;
