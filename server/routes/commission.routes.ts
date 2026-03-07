import { Router } from "express";
import { db } from "../db";
import { agentCommissions, voyages, invoices, portExpenses } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.get("/api/commissions", isAuthenticated, async (req, res) => {
  try {
    const commissions = await db.select().from(agentCommissions)
      .where(eq(agentCommissions.userId, req.user.claims.sub))
      .orderBy(desc(agentCommissions.createdAt));
    res.json(commissions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/api/voyages/:id/calculate-commission", isAuthenticated, async (req, res) => {
  const voyageId = parseInt(req.params.id);
  const { commissionType, rate, fixedAmount, currency, notes, invoiceTypes } = req.body;

  try {
    const [voyage] = await db.select().from(voyages).where(eq(voyages.id, voyageId));
    if (!voyage) return res.status(404).json({ message: "Voyage not found" });

    let baseAmount = 0;
    if (commissionType === "percentage") {
      // Calculate based on port expenses of selected types
      const expenses = await db.select().from(portExpenses)
        .where(and(
          eq(portExpenses.voyageId, voyageId),
          // If invoiceTypes is provided, filter by category
          invoiceTypes && invoiceTypes.length > 0 ? inArray(portExpenses.category, invoiceTypes) : undefined
        ));
      
      baseAmount = expenses.reduce((sum, exp) => sum + (exp.amountUsd || exp.amount), 0);
    }

    const calculatedAmount = commissionType === "percentage" 
      ? (baseAmount * (rate || 0)) / 100 
      : (fixedAmount || 0);

    const [commission] = await db.insert(agentCommissions).values({
      userId: req.user.claims.sub,
      voyageId,
      commissionType,
      rate,
      fixedAmount,
      currency: currency || "USD",
      baseAmount,
      calculatedAmount,
      status: "pending",
      notes,
    }).returning();

    res.json(commission);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/api/commissions/:id", isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, notes } = req.body;

  try {
    const [updated] = await db.update(agentCommissions)
      .set({ status, notes })
      .where(and(
        eq(agentCommissions.id, id),
        eq(agentCommissions.userId, req.user.claims.sub)
      ))
      .returning();
    
    if (!updated) return res.status(404).json({ message: "Commission not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
