import { Router } from "express";
import { db } from "../db";
import { cargoOrders, vesselOpenings } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function pd(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function sanitizeCargoOrder(body: any) {
  return {
    ...body,
    laycanFrom: pd(body.laycanFrom),
    laycanTo: pd(body.laycanTo),
    quantity: body.quantity ? parseFloat(body.quantity) : null,
    freightIdea: body.freightIdea ? parseFloat(body.freightIdea) : null,
    dwtMin: body.dwtMin ? parseFloat(body.dwtMin) : null,
    dwtMax: body.dwtMax ? parseFloat(body.dwtMax) : null,
    matchedFixtureId: body.matchedFixtureId ? parseInt(body.matchedFixtureId) : null,
  };
}

function sanitizeVesselOpening(body: any) {
  return {
    ...body,
    openDate: pd(body.openDate),
    dwt: body.dwt ? parseFloat(body.dwt) : null,
    builtYear: body.builtYear ? parseInt(body.builtYear) : null,
    hireIdea: body.hireIdea ? parseFloat(body.hireIdea) : null,
    vesselId: body.vesselId ? parseInt(body.vesselId) : null,
    matchedFixtureId: body.matchedFixtureId ? parseInt(body.matchedFixtureId) : null,
  };
}

// Summary
router.get("/summary", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const allCargoOrders = await db.select().from(cargoOrders).where(eq(cargoOrders.userId, userId));
    const allVesselOpenings = await db.select().from(vesselOpenings).where(eq(vesselOpenings.userId, userId));
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    res.json({
      openCargoOrders: allCargoOrders.filter(r => r.status === "open").length,
      openVesselPositions: allVesselOpenings.filter(r => r.status === "open").length,
      fixedThisWeek: allCargoOrders.filter(r => r.status === "fixed" && r.createdAt && new Date(r.createdAt) >= weekAgo).length,
      failedOrders: allCargoOrders.filter(r => r.status === "failed" || r.status === "cancelled").length,
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Cargo Orders
router.get("/cargo-orders", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows = await db.select().from(cargoOrders).where(eq(cargoOrders.userId, userId)).orderBy(desc(cargoOrders.createdAt));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post("/cargo-orders", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const data = sanitizeCargoOrder(req.body);
    const [row] = await db.insert(cargoOrders).values({ ...data, userId }).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.patch("/cargo-orders/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const data = sanitizeCargoOrder(req.body);
    const [row] = await db.update(cargoOrders).set(data).where(and(eq(cargoOrders.id, id), eq(cargoOrders.userId, userId))).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete("/cargo-orders/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await db.delete(cargoOrders).where(and(eq(cargoOrders.id, id), eq(cargoOrders.userId, userId)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Vessel Openings
router.get("/vessel-openings", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows = await db.select().from(vesselOpenings).where(eq(vesselOpenings.userId, userId)).orderBy(desc(vesselOpenings.createdAt));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post("/vessel-openings", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const data = sanitizeVesselOpening(req.body);
    const [row] = await db.insert(vesselOpenings).values({ ...data, userId }).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.patch("/vessel-openings/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const data = sanitizeVesselOpening(req.body);
    const [row] = await db.update(vesselOpenings).set(data).where(and(eq(vesselOpenings.id, id), eq(vesselOpenings.userId, userId))).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete("/vessel-openings/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await db.delete(vesselOpenings).where(and(eq(vesselOpenings.id, id), eq(vesselOpenings.userId, userId)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
