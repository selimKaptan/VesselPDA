import { Router } from "express";
import { db } from "../db";
import { brokerCommissions } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function parseDateField(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function sanitizeCommissionBody(body: any) {
  return {
    ...body,
    fixtureDate: parseDateField(body.fixtureDate),
    paymentDueDate: parseDateField(body.paymentDueDate),
    paymentReceivedDate: parseDateField(body.paymentReceivedDate),
    commissionRate: body.commissionRate ? parseFloat(body.commissionRate) : undefined,
    grossCommission: body.grossCommission ? parseFloat(body.grossCommission) : undefined,
    deductions: body.deductions ? parseFloat(body.deductions) : 0,
    netCommission: body.netCommission ? parseFloat(body.netCommission) : undefined,
    freightAmount: body.freightAmount ? parseFloat(body.freightAmount) : undefined,
    fixtureId: body.fixtureId ? parseInt(body.fixtureId) : null,
  };
}

router.get("/summary", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const all = await db.select().from(brokerCommissions).where(eq(brokerCommissions.userId, userId));
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const yearlyTotal = all.filter(r => r.createdAt && new Date(r.createdAt).getFullYear() === thisYear).reduce((s, r) => s + (r.netCommission || 0), 0);
    const monthlyTotal = all.filter(r => r.createdAt && new Date(r.createdAt).getFullYear() === thisYear && new Date(r.createdAt).getMonth() === thisMonth).reduce((s, r) => s + (r.netCommission || 0), 0);
    const pending = all.filter(r => r.status === "pending" || r.status === "invoiced" || r.status === "partial").reduce((s, r) => s + (r.netCommission || 0), 0);
    const received = all.filter(r => r.status === "received").reduce((s, r) => s + (r.netCommission || 0), 0);
    res.json({ yearlyTotal, monthlyTotal, pendingPayments: pending, received });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.get("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows = await db.select().from(brokerCommissions).where(eq(brokerCommissions.userId, userId)).orderBy(desc(brokerCommissions.createdAt));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const data = sanitizeCommissionBody(req.body);
    const [row] = await db.insert(brokerCommissions).values({ ...data, userId }).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.patch("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const data = sanitizeCommissionBody(req.body);
    const [row] = await db.update(brokerCommissions).set(data).where(and(eq(brokerCommissions.id, id), eq(brokerCommissions.userId, userId))).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await db.delete(brokerCommissions).where(and(eq(brokerCommissions.id, id), eq(brokerCommissions.userId, userId)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
