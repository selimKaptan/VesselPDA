import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { portCalls, vessels, voyages } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { syncVesselStatuses } from "../vessel-status-sync";

const router = Router();

// GET /api/port-calls - Fetch user's port calls
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { status, vesselId } = req.query;

    let query = db.select().from(portCalls).where(eq(portCalls.userId, userId));

    const results = await query.orderBy(desc(portCalls.createdAt));
    
    // Manual filtering for status and vesselId if provided
    let filtered = results;
    if (status) {
      filtered = filtered.filter(pc => pc.status === status);
    }
    if (vesselId) {
      filtered = filtered.filter(pc => pc.vesselId === parseInt(vesselId));
    }

    res.json(filtered);
  } catch (error) {
    console.error("[port-calls:GET] fetch failed:", error);
    res.status(500).json({ message: "Failed to fetch port calls" });
  }
});

// POST /api/port-calls - Create new port call
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const data = { ...req.body, userId };

    if (data.eta) data.eta = new Date(data.eta);
    if (data.actualArrival) data.actualArrival = new Date(data.actualArrival);
    if (data.norTendered) data.norTendered = new Date(data.norTendered);
    if (data.berthingTime) data.berthingTime = new Date(data.berthingTime);
    if (data.operationsStart) data.operationsStart = new Date(data.operationsStart);
    if (data.operationsEnd) data.operationsEnd = new Date(data.operationsEnd);
    if (data.departure) data.departure = new Date(data.departure);

    const [portCall] = await db.insert(portCalls).values(data).returning();
    res.status(201).json(portCall);
  } catch (error) {
    console.error("[port-calls:POST] create failed:", error);
    res.status(500).json({ message: "Failed to create port call" });
  }
});

// PATCH /api/port-calls/:id - Update port call
router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const data = { ...req.body };

    if (data.eta) data.eta = new Date(data.eta);
    if (data.actualArrival) data.actualArrival = new Date(data.actualArrival);
    if (data.norTendered) data.norTendered = new Date(data.norTendered);
    if (data.berthingTime) data.berthingTime = new Date(data.berthingTime);
    if (data.operationsStart) data.operationsStart = new Date(data.operationsStart);
    if (data.operationsEnd) data.operationsEnd = new Date(data.operationsEnd);
    if (data.departure) data.departure = new Date(data.departure);

    const [updated] = await db
      .update(portCalls)
      .set(data)
      .where(and(eq(portCalls.id, id), eq(portCalls.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ message: "Port call not found" });

    if (data.status !== undefined && updated.vesselId) {
      syncVesselStatuses([updated.vesselId]).catch(() => {});
    }

    res.json(updated);
  } catch (error) {
    console.error("[port-calls:PATCH] update failed:", error);
    res.status(500).json({ message: "Failed to update port call" });
  }
});

// DELETE /api/port-calls/:id - Delete port call
router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;

    const [deleted] = await db
      .delete(portCalls)
      .where(and(eq(portCalls.id, id), eq(portCalls.userId, userId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Port call not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[port-calls:DELETE] delete failed:", error);
    res.status(500).json({ message: "Failed to delete port call" });
  }
});

// GET /api/port-calls/stats - Port call statistics
router.get("/stats", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const allCalls = await db.select().from(portCalls).where(eq(portCalls.userId, userId));
    
    const active = allCalls.filter(pc => ["arrived", "in_port", "operations"].includes(pc.status || "")).length;
    const expected = allCalls.filter(pc => pc.status === "expected").length;
    
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = allCalls.filter(pc => pc.createdAt && pc.createdAt >= firstDayOfMonth).length;

    res.json({
      active,
      expected,
      thisMonth,
      total: allCalls.length
    });
  } catch (error) {
    console.error("[port-calls:STATS] fetch failed:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// GET /api/port-calls/:id - Get single port call
router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [portCall] = await db.select().from(portCalls).where(eq(portCalls.id, id));
    if (!portCall) return res.status(404).json({ message: "Port call not found" });
    res.json(portCall);
  } catch (error) {
    console.error("[port-calls:GET/:id] fetch failed:", error);
    res.status(500).json({ message: "Failed to fetch port call" });
  }
});

export default router;
