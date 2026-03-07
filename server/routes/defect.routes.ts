import { Router } from "express";
import { db } from "../db";
import { vesselDefects, pscInspections, pscDeficiencies } from "../../shared/schema";
import { eq, and, desc, ne } from "drizzle-orm";

const router = Router();

// ─── Vessel Defects ───────────────────────────────────────────────────────────
router.get("/defects", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const defects = await db.select().from(vesselDefects).where(eq(vesselDefects.userId, userId)).orderBy(desc(vesselDefects.reportedDate));
    res.json(defects);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/defects/vessels/:vesselId", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const defects = await db.select().from(vesselDefects)
      .where(and(eq(vesselDefects.vesselId, parseInt(req.params.vesselId)), eq(vesselDefects.userId, userId)))
      .orderBy(desc(vesselDefects.reportedDate));
    res.json(defects);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/defects/vessels/:vesselId", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [defect] = await db.insert(vesselDefects).values({ ...req.body, vesselId: parseInt(req.params.vesselId), userId }).returning();
    res.json(defect);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/defects/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const updateData: any = { ...req.body };
    if (req.body.status === "closed") updateData.actualCloseDate = new Date();
    const [updated] = await db.update(vesselDefects).set(updateData).where(and(eq(vesselDefects.id, parseInt(req.params.id)), eq(vesselDefects.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/defects/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await db.delete(vesselDefects).where(and(eq(vesselDefects.id, parseInt(req.params.id)), eq(vesselDefects.userId, userId)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/defects/summary", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const all = await db.select().from(vesselDefects).where(eq(vesselDefects.userId, userId));
    const open = all.filter(d => d.status !== "closed").length;
    const critical = all.filter(d => d.priority === "critical" && d.status !== "closed").length;
    res.json({ total: all.length, open, critical });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ─── PSC Inspections ──────────────────────────────────────────────────────────
router.get("/psc/vessels/:vesselId/inspections", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const inspections = await db.select().from(pscInspections)
      .where(and(eq(pscInspections.vesselId, parseInt(req.params.vesselId)), eq(pscInspections.userId, userId)))
      .orderBy(desc(pscInspections.inspectionDate));
    res.json(inspections);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/psc/vessels/:vesselId/inspections", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [inspection] = await db.insert(pscInspections).values({ ...req.body, vesselId: parseInt(req.params.vesselId), userId }).returning();
    res.json(inspection);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/psc/inspections/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [updated] = await db.update(pscInspections).set(req.body).where(and(eq(pscInspections.id, parseInt(req.params.id)), eq(pscInspections.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/psc/inspections/:id/deficiencies", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const deficiencies = await db.select().from(pscDeficiencies).where(eq(pscDeficiencies.inspectionId, parseInt(req.params.id)));
    res.json(deficiencies);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/psc/inspections/:id/deficiencies", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const inspection = await db.select().from(pscInspections).where(eq(pscInspections.id, parseInt(req.params.id))).limit(1);
    if (!inspection.length) return res.status(404).json({ message: "Inspection not found" });
    const [def] = await db.insert(pscDeficiencies).values({ ...req.body, inspectionId: parseInt(req.params.id), vesselId: inspection[0].vesselId }).returning();
    // Update deficiency count
    const allDefs = await db.select().from(pscDeficiencies).where(eq(pscDeficiencies.inspectionId, parseInt(req.params.id)));
    await db.update(pscInspections).set({ deficiencyCount: allDefs.length }).where(eq(pscInspections.id, parseInt(req.params.id)));
    res.json(def);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/psc/deficiencies/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const updateData: any = { ...req.body };
    if (req.body.status === "rectified") updateData.rectifiedDate = new Date();
    const [updated] = await db.update(pscDeficiencies).set(updateData).where(eq(pscDeficiencies.id, parseInt(req.params.id))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export default router;
