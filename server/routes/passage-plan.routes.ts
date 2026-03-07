import { Router } from "express";
import { db } from "../db";
import { passagePlans, passageWaypoints } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function pd(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function sanitizePlan(body: any) {
  return {
    ...body,
    departureDate: pd(body.departureDate),
    arrivalDate: pd(body.arrivalDate),
    totalDistanceNm: body.totalDistanceNm ? parseFloat(body.totalDistanceNm) : null,
    totalDays: body.totalDays ? parseFloat(body.totalDays) : null,
    vesselId: body.vesselId ? parseInt(body.vesselId) : null,
    voyageId: body.voyageId ? parseInt(body.voyageId) : null,
  };
}

function sanitizeWaypoint(body: any) {
  return {
    ...body,
    etd: pd(body.etd),
    eta: pd(body.eta),
    latitude: body.latitude !== undefined && body.latitude !== "" ? parseFloat(body.latitude) : null,
    longitude: body.longitude !== undefined && body.longitude !== "" ? parseFloat(body.longitude) : null,
    courseToNext: body.courseToNext ? parseFloat(body.courseToNext) : null,
    distanceToNextNm: body.distanceToNextNm ? parseFloat(body.distanceToNextNm) : null,
    speedKnots: body.speedKnots ? parseFloat(body.speedKnots) : null,
    sequence: body.sequence !== undefined ? parseInt(body.sequence) : 0,
    planId: parseInt(body.planId),
  };
}

router.get("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows = await db.select().from(passagePlans).where(eq(passagePlans.userId, userId)).orderBy(desc(passagePlans.createdAt));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const data = sanitizePlan(req.body);
    const [row] = await db.insert(passagePlans).values({ ...data, userId }).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.patch("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const data = sanitizePlan(req.body);
    const [row] = await db.update(passagePlans).set(data).where(and(eq(passagePlans.id, id), eq(passagePlans.userId, userId))).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await db.delete(passageWaypoints).where(eq(passageWaypoints.planId, id));
    await db.delete(passagePlans).where(and(eq(passagePlans.id, id), eq(passagePlans.userId, userId)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.get("/:id/waypoints", async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db.select().from(passageWaypoints).where(eq(passageWaypoints.planId, id)).orderBy(passageWaypoints.sequence);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post("/:id/waypoints", async (req: any, res) => {
  try {
    const planId = parseInt(req.params.id);
    const data = sanitizeWaypoint({ ...req.body, planId });
    const [row] = await db.insert(passageWaypoints).values(data).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.patch("/:id/waypoints/:wid", async (req: any, res) => {
  try {
    const wid = parseInt(req.params.wid);
    const data = sanitizeWaypoint(req.body);
    const { planId: _planId, ...updateData } = data;
    const [row] = await db.update(passageWaypoints).set(updateData).where(eq(passageWaypoints.id, wid)).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete("/:id/waypoints/:wid", async (req: any, res) => {
  try {
    const wid = parseInt(req.params.wid);
    await db.delete(passageWaypoints).where(eq(passageWaypoints.id, wid));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
