import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { insertPortExpenseSchema } from "@shared/schema";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : undefined;
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
