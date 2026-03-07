import { Router } from "express";
import { db } from "../db";
import { ciiRecords, euEtsRecords, dcsReports } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/vessels/:vesselId/cii", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const records = await db.select().from(ciiRecords)
      .where(and(eq(ciiRecords.vesselId, parseInt(req.params.vesselId)), eq(ciiRecords.userId, userId)))
      .orderBy(desc(ciiRecords.reportingYear));
    res.json(records);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/vessels/:vesselId/cii", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [record] = await db.insert(ciiRecords).values({ ...req.body, vesselId: parseInt(req.params.vesselId), userId }).returning();
    res.json(record);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/cii/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [updated] = await db.update(ciiRecords).set(req.body).where(and(eq(ciiRecords.id, parseInt(req.params.id)), eq(ciiRecords.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/cii/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await db.delete(ciiRecords).where(and(eq(ciiRecords.id, parseInt(req.params.id)), eq(ciiRecords.userId, userId)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/vessels/:vesselId/eu-ets", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const records = await db.select().from(euEtsRecords)
      .where(and(eq(euEtsRecords.vesselId, parseInt(req.params.vesselId)), eq(euEtsRecords.userId, userId)))
      .orderBy(desc(euEtsRecords.reportingYear));
    res.json(records);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/vessels/:vesselId/eu-ets", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [record] = await db.insert(euEtsRecords).values({ ...req.body, vesselId: parseInt(req.params.vesselId), userId }).returning();
    res.json(record);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/eu-ets/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [updated] = await db.update(euEtsRecords).set(req.body).where(and(eq(euEtsRecords.id, parseInt(req.params.id)), eq(euEtsRecords.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/eu-ets/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await db.delete(euEtsRecords).where(and(eq(euEtsRecords.id, parseInt(req.params.id)), eq(euEtsRecords.userId, userId)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/vessels/:vesselId/dcs", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const reports = await db.select().from(dcsReports)
      .where(and(eq(dcsReports.vesselId, parseInt(req.params.vesselId)), eq(dcsReports.userId, userId)))
      .orderBy(desc(dcsReports.reportingYear));
    res.json(reports);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/vessels/:vesselId/dcs", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [report] = await db.insert(dcsReports).values({ ...req.body, vesselId: parseInt(req.params.vesselId), userId }).returning();
    res.json(report);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/dcs/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [updated] = await db.update(dcsReports).set(req.body).where(and(eq(dcsReports.id, parseInt(req.params.id)), eq(dcsReports.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/dcs/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await db.delete(dcsReports).where(and(eq(dcsReports.id, parseInt(req.params.id)), eq(dcsReports.userId, userId)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/fleet-summary", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const currentYear = new Date().getFullYear();
    const cii = await db.select().from(ciiRecords).where(and(eq(ciiRecords.userId, userId), eq(ciiRecords.reportingYear, currentYear)));
    const ets = await db.select().from(euEtsRecords).where(and(eq(euEtsRecords.userId, userId), eq(euEtsRecords.reportingYear, currentYear)));
    res.json({ ciiRecords: cii, euEtsRecords: ets, year: currentYear });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export default router;
