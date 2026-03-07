import { Router } from "express";
import { db } from "../db";
import { insurancePolicies, insuranceClaims } from "../../shared/schema";
import { eq, and, desc, lte, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/policies", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const policies = await db.select().from(insurancePolicies).where(eq(insurancePolicies.userId, userId)).orderBy(desc(insurancePolicies.coverageTo));
    res.json(policies);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/vessels/:vesselId/policies", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const policies = await db.select().from(insurancePolicies)
      .where(and(eq(insurancePolicies.vesselId, parseInt(req.params.vesselId)), eq(insurancePolicies.userId, userId)))
      .orderBy(desc(insurancePolicies.coverageTo));
    res.json(policies);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/policies", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [policy] = await db.insert(insurancePolicies).values({ ...req.body, userId }).returning();
    res.json(policy);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/policies/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [updated] = await db.update(insurancePolicies).set(req.body).where(and(eq(insurancePolicies.id, parseInt(req.params.id)), eq(insurancePolicies.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/policies/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await db.delete(insurancePolicies).where(and(eq(insurancePolicies.id, parseInt(req.params.id)), eq(insurancePolicies.userId, userId)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/policies/:id/claims", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const claims = await db.select().from(insuranceClaims).where(and(eq(insuranceClaims.policyId, parseInt(req.params.id)), eq(insuranceClaims.userId, userId))).orderBy(desc(insuranceClaims.incidentDate));
    res.json(claims);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/policies/:id/claims", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const policy = await db.select().from(insurancePolicies).where(eq(insurancePolicies.id, parseInt(req.params.id))).limit(1);
    if (!policy.length) return res.status(404).json({ message: "Policy not found" });
    const [claim] = await db.insert(insuranceClaims).values({ ...req.body, policyId: parseInt(req.params.id), vesselId: policy[0].vesselId, userId }).returning();
    res.json(claim);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/claims/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const updateData: any = { ...req.body };
    if (req.body.status === "settled" || req.body.status === "rejected" || req.body.status === "withdrawn") {
      updateData.closedAt = new Date();
    }
    const [updated] = await db.update(insuranceClaims).set(updateData).where(and(eq(insuranceClaims.id, parseInt(req.params.id)), eq(insuranceClaims.userId, userId))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/claims", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const claims = await db.select().from(insuranceClaims).where(eq(insuranceClaims.userId, userId)).orderBy(desc(insuranceClaims.incidentDate));
    res.json(claims);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/summary", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const policies = await db.select().from(insurancePolicies).where(eq(insurancePolicies.userId, userId));
    const claims = await db.select().from(insuranceClaims).where(eq(insuranceClaims.userId, userId));
    const activePolicies = policies.filter(p => p.status === "active").length;
    const expiringSoon = policies.filter(p => p.status === "active" && new Date(p.coverageTo) <= thirtyDaysLater).length;
    const openClaims = claims.filter(c => c.status === "reported" || c.status === "investigating").length;
    const totalPremium = policies.filter(p => p.status === "active").reduce((sum, p) => sum + (p.premiumAmount || 0), 0);
    res.json({ activePolicies, expiringSoon, openClaims, totalPremium, policies, claims });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export default router;
