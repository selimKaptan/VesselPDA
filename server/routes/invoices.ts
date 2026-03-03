import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

// ─── INVOICES ────────────────────────────────────────────────────────────────

router.get("/invoices", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const items = await storage.getInvoicesByUser(userId);
    res.json(items);
  } catch {
    res.status(500).json({ message: "Failed to get invoices" });
  }
});

router.post("/invoices", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { title, amount, currency, dueDate, notes, invoiceType, voyageId, proformaId, linkedProformaId } = req.body;
    if (!title || !amount) return res.status(400).json({ message: "title and amount required" });

    const invoice = await storage.createInvoice({
      createdByUserId: userId,
      title,
      amount: parseFloat(amount),
      currency: currency || "USD",
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      invoiceType: invoiceType || "invoice",
      voyageId: voyageId ? parseInt(voyageId) : null,
      proformaId: proformaId ? parseInt(proformaId) : null,
      linkedProformaId: linkedProformaId ? parseInt(linkedProformaId) : null,
    });
    logAction(userId, "create", "invoice", invoice.id, { title, amount: parseFloat(amount), currency: currency || "USD", invoiceType: invoiceType || "invoice" }, getClientIp(req));
    res.status(201).json(invoice);
  } catch {
    res.status(500).json({ message: "Failed to create invoice" });
  }
});

router.patch("/invoices/:id/pay", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { paidAt } = req.body;
    await storage.updateInvoiceStatus(id, "paid", paidAt ? new Date(paidAt) : new Date());
    logAction(req.user?.claims?.sub || req.user?.id, "pay", "invoice", id, { status: "paid" }, getClientIp(req));
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to mark invoice paid" });
  }
});

router.patch("/invoices/:id/cancel", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.updateInvoiceStatus(id, "cancelled");
    logAction(req.user?.claims?.sub || req.user?.id, "cancel", "invoice", id, { status: "cancelled" }, getClientIp(req));
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to cancel invoice" });
  }
});


export default router;
