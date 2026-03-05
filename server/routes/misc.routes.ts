import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { cached, invalidateCache } from "../cache";
import { insertInvoiceSchema, voyageActivities, invoices } from "@shared/schema";
import { db } from "../db";
import { sql as drizzleSql, eq, desc, and, lt, gt, lte, isNotNull } from "drizzle-orm";
import { emitToUser } from "../socket";
import { logAction, getClientIp } from "../audit";
import { logVoyageActivity } from "../voyage-activity";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/api/certificates/expiring", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const daysAhead = parseInt(req.query.days as string) || 30;
    const certs = await storage.getExpiringCertificates(userId, daysAhead);
    res.json(certs);
  } catch {
    res.status(500).json({ message: "Failed to fetch expiring certificates" });
  }
});


router.get("/api/document-templates", isAuthenticated, async (_req, res) => {
  try {
    const templates = await cached('document-templates', 'daily', () => storage.getDocumentTemplates());
    res.json(templates);
  } catch {
    res.status(500).json({ message: "Failed to get templates" });
  }
});


router.get("/api/invoices", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const items = await storage.getInvoicesByUser(userId);
    const voyageIdFilter = req.query.voyageId ? Number(req.query.voyageId) : null;
    const proformaIdFilter = req.query.proformaId ? Number(req.query.proformaId) : null;
    let result = items;
    if (voyageIdFilter) result = result.filter((i: any) => i.voyageId === voyageIdFilter);
    if (proformaIdFilter) result = result.filter((i: any) => i.proformaId === proformaIdFilter || i.linkedProformaId === proformaIdFilter);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to get invoices" });
  }
});


router.post("/api/invoices", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { title, amount, currency, dueDate, notes, invoiceType, voyageId, proformaId, linkedProformaId, recipientEmail, recipientName } = req.body;
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
      recipientEmail: recipientEmail || null,
      recipientName: recipientName || null,
    });
    logAction(userId, "create", "invoice", invoice.id, { title, amount: parseFloat(amount), currency: currency || "USD", invoiceType: invoiceType || "invoice" }, getClientIp(req));
    
    if (voyageId) {
      logVoyageActivity({ 
        voyageId: parseInt(voyageId), 
        userId, 
        activityType: 'invoice_created', 
        title: `Invoice created: ${amount} ${currency || 'USD'}` 
      });
    }

    res.status(201).json(invoice);
  } catch {
    res.status(500).json({ message: "Failed to create invoice" });
  }
});


router.patch("/api/invoices/:id/pay", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { paidAt } = req.body;
    const userId = req.user?.claims?.sub || req.user?.id;
    await storage.updateInvoiceStatus(id, "paid", paidAt ? new Date(paidAt) : new Date());
    logAction(userId, "pay", "invoice", id, { status: "paid" }, getClientIp(req));
    
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (invoice && invoice.voyageId) {
      logVoyageActivity({ 
        voyageId: invoice.voyageId, 
        userId, 
        activityType: 'invoice_paid', 
        title: 'Invoice paid' 
      });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to mark invoice paid" });
  }
});


router.patch("/api/invoices/:id/cancel", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.updateInvoiceStatus(id, "cancelled");
    logAction(req.user?.claims?.sub || req.user?.id, "cancel", "invoice", id, { status: "cancelled" }, getClientIp(req));
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to cancel invoice" });
  }
});

router.get("/api/invoices/alerts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const overdueRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.createdByUserId, userId),
          eq(invoices.status, "pending"),
          isNotNull(invoices.dueDate),
          lt(invoices.dueDate, now)
        )
      );

    const upcomingRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.createdByUserId, userId),
          eq(invoices.status, "pending"),
          isNotNull(invoices.dueDate),
          gt(invoices.dueDate, now),
          lte(invoices.dueDate, sevenDaysFromNow)
        )
      );

    const overdueTotal = overdueRows.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const upcomingTotal = upcomingRows.reduce((sum, inv) => sum + Number(inv.amount), 0);

    res.json({
      overdueCount: overdueRows.length,
      overdueTotal: parseFloat(overdueTotal.toFixed(2)),
      upcomingCount: upcomingRows.length,
      upcomingTotal: parseFloat(upcomingTotal.toFixed(2)),
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch invoice alerts" });
  }
});

router.post("/api/invoices/:id/send-reminder", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const id = parseInt(req.params.id);

    const [invoice] = await db.select().from(invoices).where(
      and(eq(invoices.id, id), eq(invoices.createdByUserId, userId))
    ).limit(1);

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (!invoice.recipientEmail) return res.status(400).json({ message: "No recipient email on this invoice" });
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return res.status(400).json({ message: "Cannot send reminder for paid/cancelled invoice" });
    }

    const { sendSingleReminder } = await import("../payment-reminders");
    await sendSingleReminder({
      id: invoice.id,
      title: invoice.title,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      recipientEmail: invoice.recipientEmail,
      recipientName: invoice.recipientName,
      status: invoice.status,
    });

    res.json({ message: "Reminder sent", to: invoice.recipientEmail });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to send reminder" });
  }
});


router.get("/api/user/recent-activity", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const activities = await db
      .select({
        id: voyageActivities.id,
        voyageId: voyageActivities.voyageId,
        activityType: voyageActivities.activityType,
        title: voyageActivities.title,
        createdAt: voyageActivities.createdAt,
      })
      .from(voyageActivities)
      .where(eq(voyageActivities.userId, userId))
      .orderBy(desc(voyageActivities.createdAt))
      .limit(limit);
    res.json({ activities });
  } catch (error) {
    console.error("recent-activity error:", error);
    res.status(500).json({ message: "Failed to fetch recent activity" });
  }
});

router.get("/api/port-alerts", async (req, res) => {
  try {
    const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
    const portName = req.query.portName as string | undefined;
    const alerts = await storage.getPortAlerts(portId, portName);
    res.json(alerts);
  } catch {
    res.status(500).json({ message: "Failed to get port alerts" });
  }
});


router.post("/api/port-alerts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const { portId, portName, alertType, severity, title, message, isActive, startsAt, endsAt } = req.body;
    if (!portName || !title || !message) return res.status(400).json({ message: "portName, title, message required" });

    const alert = await storage.createPortAlert({
      portId: portId ? parseInt(portId) : null,
      portName,
      alertType: alertType || "other",
      severity: severity || "info",
      title,
      message,
      isActive: isActive !== false,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      createdByUserId: userId,
    });
    res.status(201).json(alert);
  } catch {
    res.status(500).json({ message: "Failed to create port alert" });
  }
});


router.patch("/api/port-alerts/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.updatePortAlert(id, req.body);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to update port alert" });
  }
});


router.delete("/api/port-alerts/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.deletePortAlert(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete port alert" });
  }
});


export default router;
