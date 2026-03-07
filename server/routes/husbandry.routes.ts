import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { insertHusbandryOrderSchema, insertCrewChangeSchema } from "@shared/schema";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const orders = await storage.getHusbandryOrders(userId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch husbandry orders" });
  }
});

router.get("/vessels/:vesselId", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const orders = await storage.getVesselHusbandryOrders(vesselId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vessel husbandry orders" });
  }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const data = insertHusbandryOrderSchema.parse({
      ...req.body,
      userId
    });
    const order = await storage.createHusbandryOrder(data);
    res.status(201).json(order);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to create husbandry order" });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await storage.updateHusbandryOrder(id, req.body);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to update husbandry order" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteHusbandryOrder(id);
    if (!success) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete husbandry order" });
  }
});

router.get("/:id/crew-changes", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const changes = await storage.getCrewChanges(id);
    res.json(changes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch crew changes" });
  }
});

router.post("/:id/crew-changes", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = insertCrewChangeSchema.parse({
      ...req.body,
      husbandryOrderId: id
    });
    const change = await storage.createCrewChange(data);
    res.status(201).json(change);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to create crew change" });
  }
});

router.patch("/crew-changes/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const change = await storage.updateCrewChange(id, req.body);
    if (!change) return res.status(404).json({ message: "Crew change not found" });
    res.json(change);
  } catch (error) {
    res.status(500).json({ message: "Failed to update crew change" });
  }
});

export default router;
