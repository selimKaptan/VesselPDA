import { Router } from "express";
import { db } from "../db";
import { crewDocConfig } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows = await db.select().from(crewDocConfig).where(eq(crewDocConfig.userId, userId));
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const existing = await db.select().from(crewDocConfig).where(eq(crewDocConfig.userId, userId));
    if (existing.length > 0) {
      const [row] = await db
        .update(crewDocConfig)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(crewDocConfig.userId, userId))
        .returning();
      return res.json(row);
    }
    const [row] = await db.insert(crewDocConfig).values({ ...req.body, userId }).returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
