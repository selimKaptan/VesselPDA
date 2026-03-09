import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { insertPortExpenseSchema, portExpenses, fdaAccounts } from "@shared/schema";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : undefined;
    const fdaId = req.query.fdaId ? parseInt(req.query.fdaId as string) : undefined;
    const portCallId = req.query.portCallId ? parseInt(req.query.portCallId as string) : undefined;

    if (fdaId) {
      const expenses = await storage.getPortExpensesByFda(fdaId);
      return res.json(expenses);
    }
    if (portCallId) {
      const expenses = await db.select().from(portExpenses).where(eq(portExpenses.portCallId, portCallId)).orderBy(desc(portExpenses.expenseDate));
      return res.json(expenses);
    }
    if (voyageId) {
      const expenses = await storage.getPortExpensesByVoyage(voyageId);
      return res.json(expenses);
    }
    const expenses = await storage.getPortExpensesByUser(userId);
    res.json(expenses);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const parsed = insertPortExpenseSchema.safeParse({
      ...req.body,
      userId,
      expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : new Date(),
    });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: parsed.error.errors });
    }
    const expense = await storage.createPortExpense(parsed.data);
    res.status(201).json(expense);

    // Adım 3: fdaId yoksa voyage'ın FDA'sını otomatik bul ve bağla
    if (!expense.fdaId && expense.voyageId) {
      try {
        const [fda] = await db.select().from(fdaAccounts)
          .where(eq(fdaAccounts.voyageId, expense.voyageId))
          .orderBy(desc(fdaAccounts.createdAt))
          .limit(1);
        if (fda) {
          await db.update(portExpenses).set({ fdaId: fda.id }).where(eq(portExpenses.id, expense.id));
          expense.fdaId = fda.id;
        }
      } catch (err) {
        console.error("[port-expense] Auto FDA link failed:", err);
      }
    }

    // Adım 2: Bağlı FDA varsa actual totalleri güncelle
    if (expense.fdaId) {
      try {
        const [fda] = await db.select().from(fdaAccounts).where(eq(fdaAccounts.id, expense.fdaId));
        if (fda) {
          const expenses = await storage.getPortExpensesByFda(expense.fdaId);
          const totalActualUsd = expenses.reduce((sum, e) => sum + (e.amountUsd || (e as any).amount || 0), 0);
          const varianceUsd = totalActualUsd - (fda.totalEstimatedUsd || 0);
          const variancePercent = fda.totalEstimatedUsd
            ? (varianceUsd / fda.totalEstimatedUsd) * 100
            : 0;

          await db.update(fdaAccounts).set({
            totalActualUsd,
            varianceUsd,
            variancePercent: Math.round(variancePercent * 10) / 10,
            updatedAt: new Date(),
          }).where(eq(fdaAccounts.id, expense.fdaId));

          // Varyans %10'u aştıysa uyarı bildirimi
          if (Math.abs(variancePercent) > 10) {
            storage.createNotification({
              userId: fda.userId,
              type: "fda_variance_alert",
              title: "FDA Variance Alert",
              message: `FDA ${fda.referenceNumber || `#${fda.id}`}: Actual expenses deviate ${variancePercent.toFixed(1)}% from PDA estimate.`,
              link: `/fda/${fda.id}`,
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[port-expense] FDA sync failed:", err);
      }
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertPortExpenseSchema.partial().safeParse({
      ...req.body,
      expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : undefined,
    });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid expense data", errors: parsed.error.errors });
    }
    const updated = await storage.updatePortExpense(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Expense not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePortExpense(id);
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
