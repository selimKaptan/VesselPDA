import { Router } from "express";
import { db } from "../db";
import { spareParts, sparePartRequisitions, sparePartRequisitionItems } from "../../shared/schema";
import { eq, and, desc, lte, sql } from "drizzle-orm";

const router = Router();

router.get("/vessels/:vesselId", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const parts = await db.select().from(spareParts)
      .where(and(eq(spareParts.vesselId, parseInt(req.params.vesselId)), eq(spareParts.userId, userId)))
      .orderBy(spareParts.description);
    res.json(parts);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/vessels/:vesselId", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [part] = await db.insert(spareParts).values({ ...req.body, vesselId: parseInt(req.params.vesselId), userId }).returning();
    res.json(part);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [updated] = await db.update(spareParts).set({ ...req.body, lastUpdated: new Date() }).where(and(eq(spareParts.id, parseInt(req.params.id)), eq(spareParts.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await db.delete(spareParts).where(and(eq(spareParts.id, parseInt(req.params.id)), eq(spareParts.userId, userId)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/vessels/:vesselId/low-stock", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const parts = await db.select().from(spareParts)
      .where(and(eq(spareParts.vesselId, parseInt(req.params.vesselId)), eq(spareParts.userId, userId)));
    const lowStock = parts.filter(p => (p.quantityOnboard || 0) <= (p.minimumStock || 1));
    res.json(lowStock);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/requisitions", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const reqs = await db.select().from(sparePartRequisitions).where(eq(sparePartRequisitions.userId, userId)).orderBy(desc(sparePartRequisitions.requestedDate));
    res.json(reqs);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/vessels/:vesselId/requisitions", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const reqs = await db.select().from(sparePartRequisitions)
      .where(and(eq(sparePartRequisitions.vesselId, parseInt(req.params.vesselId)), eq(sparePartRequisitions.userId, userId)))
      .orderBy(desc(sparePartRequisitions.requestedDate));
    res.json(reqs);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/vessels/:vesselId/requisitions", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const count = await db.select({ count: sql<number>`count(*)` }).from(sparePartRequisitions).where(eq(sparePartRequisitions.userId, userId));
    const reqNum = `REQ-${new Date().getFullYear()}-${String((count[0]?.count || 0) + 1).padStart(4, "0")}`;
    const [req_] = await db.insert(sparePartRequisitions).values({ ...req.body, vesselId: parseInt(req.params.vesselId), userId, requisitionNumber: req.body.requisitionNumber || reqNum }).returning();
    res.json(req_);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/requisitions/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [updated] = await db.update(sparePartRequisitions).set(req.body).where(and(eq(sparePartRequisitions.id, parseInt(req.params.id)), eq(sparePartRequisitions.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/requisitions/:id/items", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const items = await db.select().from(sparePartRequisitionItems).where(eq(sparePartRequisitionItems.requisitionId, parseInt(req.params.id)));
    res.json(items);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/requisitions/:id/items", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [item] = await db.insert(sparePartRequisitionItems).values({ ...req.body, requisitionId: parseInt(req.params.id) }).returning();
    // Update total cost
    const items = await db.select().from(sparePartRequisitionItems).where(eq(sparePartRequisitionItems.requisitionId, parseInt(req.params.id)));
    const total = items.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
    await db.update(sparePartRequisitions).set({ totalCost: total }).where(eq(sparePartRequisitions.id, parseInt(req.params.id)));
    res.json(item);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/requisitions/items/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await db.delete(sparePartRequisitionItems).where(eq(sparePartRequisitionItems.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export default router;
