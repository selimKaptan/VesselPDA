import { Router } from "express";
import { db } from "../db";
import { voyageEstimations } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function sanitizeEstimation(body: any) {
  const numFields = ["dwt", "speedLaden", "speedBallast", "consumptionLaden", "consumptionBallast",
    "consumptionPort", "fuelPrice", "cargoQuantity", "freightRate", "distanceLaden", "distanceBallast",
    "portDaysLoad", "portDaysDischarge", "portCostLoad", "portCostDischarge", "canalCost", "miscCosts",
    "addressCommission", "brokerCommissionPct", "grossFreight", "totalVoyageCosts", "netProfit",
    "voyageDays", "tce", "breakevenFreight"];
  const result: any = { ...body };
  for (const f of numFields) {
    if (result[f] !== undefined && result[f] !== null && result[f] !== "") {
      result[f] = parseFloat(result[f]);
    } else if (result[f] === "") {
      result[f] = null;
    }
  }
  result.vesselId = body.vesselId ? parseInt(body.vesselId) : null;
  return result;
}

router.get("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows = await db.select().from(voyageEstimations).where(eq(voyageEstimations.userId, userId)).orderBy(desc(voyageEstimations.createdAt));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const data = sanitizeEstimation(req.body);
    const [row] = await db.insert(voyageEstimations).values({ ...data, userId }).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.patch("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const data = sanitizeEstimation(req.body);
    const [row] = await db.update(voyageEstimations).set(data).where(and(eq(voyageEstimations.id, id), eq(voyageEstimations.userId, userId))).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await db.delete(voyageEstimations).where(and(eq(voyageEstimations.id, id), eq(voyageEstimations.userId, userId)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
