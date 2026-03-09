import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { validate } from "../middleware/validate";
import { isAdmin } from "./shared";
import { cached, invalidateCache } from "../cache";
import { insertInvoiceSchema, voyageActivities, invoices, insertInvoicePaymentSchema } from "@shared/schema";
import { db } from "../db";
import { sql as drizzleSql, eq, desc, and, lt, gt, lte, isNotNull } from "drizzle-orm";
import { emitToUser } from "../socket";
import { logAction, getClientIp } from "../audit";
import { logVoyageActivity } from "../voyage-activity";
import { sendInvoiceCreatedEmail, sendPaymentReceivedConfirmation } from "../email";
import multer from "multer";
import path from "path";
import fs from "fs";
import { addPdfHeader, addPdfFooter } from "../proforma-pdf";

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


router.post("/api/invoices/bulk-update", isAuthenticated, async (req: any, res) => {
  try {
    const { ids, action } = req.body;
    const userId = req.user?.claims?.sub || req.user?.id;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    if (action === "markPaid") {
      for (const id of ids) {
        const balance = await storage.getInvoiceBalance(id);
        if (balance.balance > 0) {
          await storage.createInvoicePayment({
            invoiceId: id,
            amount: balance.balance,
            currency: "USD",
            paidAt: new Date(),
            paymentMethod: "bank_transfer",
            recordedBy: userId
          });
        }
      }
    } else if (action === "sendReminder") {
      const { sendSingleReminder } = await import("../payment-reminders");
      for (const id of ids) {
        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        if (invoice && invoice.recipientEmail && invoice.status !== "paid" && invoice.status !== "cancelled") {
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
        }
      }
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    res.json({ success: true, count: ids.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Bulk update failed" });
  }
});

router.post("/api/voyages/bulk-close", isAuthenticated, async (req: any, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const { voyages } = await import("@shared/schema");
    await db.update(voyages)
      .set({ status: "completed" })
      .where(sql`${voyages.id} IN (\${ids.join(",")})`);

    res.json({ success: true, count: ids.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Bulk close failed" });
  }
});

router.post("/api/port-expenses/import", isAuthenticated, multer({ storage: multer.memoryStorage() }).single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const userId = req.user?.claims?.sub || req.user?.id;
    const voyageId = req.body.voyageId ? parseInt(req.body.voyageId) : null;
    
    const csvContent = req.file.buffer.toString("utf-8");
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    const importedCount = 0;
    const { portExpenses } = await import("@shared/schema");
    
    const inserts = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(",").map(v => v.trim());
      const data: any = {};
      headers.forEach((header, idx) => {
        data[header] = values[idx];
      });

      inserts.push({
        userId,
        voyageId: voyageId || (data.voyageid ? parseInt(data.voyageid) : null),
        category: data.category || "other",
        description: data.description || null,
        amount: parseFloat(data.amount) || 0,
        currency: data.currency || "USD",
        vendor: data.vendor || null,
        receiptNumber: data.receiptnumber || null,
        expenseDate: data.date ? new Date(data.date) : new Date(),
        isPaid: false
      });
    }

    if (inserts.length > 0) {
      await db.insert(portExpenses).values(inserts);
    }

    res.json({ success: true, count: inserts.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Import failed" });
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
    const fdaIdFilter = req.query.fdaId ? Number(req.query.fdaId) : null;
    let result = items;
    if (voyageIdFilter) result = result.filter((i: any) => i.voyageId === voyageIdFilter);
    if (proformaIdFilter) result = result.filter((i: any) => i.proformaId === proformaIdFilter || i.linkedProformaId === proformaIdFilter);
    if (fdaIdFilter) result = result.filter((i: any) => i.fdaId === fdaIdFilter);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to get invoices" });
  }
});


router.post("/api/invoices", isAuthenticated, validate(insertInvoiceSchema.partial().refine(d => d.title && d.amount, { message: "title and amount required" })), async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { title, amount, currency, dueDate, notes, invoiceType, voyageId, proformaId, fdaId, linkedProformaId, recipientEmail, recipientName, vesselName, portName } = req.body;

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
      fdaId: fdaId ? parseInt(fdaId) : null,
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

    // Fire-and-forget: send invoice notification to recipient
    if (recipientEmail) {
      (async () => {
        try {
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "No due date";
          await sendInvoiceCreatedEmail({
            toEmail: recipientEmail,
            recipientName: recipientName || "Valued Customer",
            vesselName: vesselName || "—",
            portName: portName || "—",
            invoiceTitle: title,
            amount: parseFloat(amount),
            currency: currency || "USD",
            dueDate: dueDateStr,
            invoiceUrl: `${baseUrl}/invoices`,
          });
        } catch (e) { console.warn("[invoice] Invoice created email skipped:", e); }
      })();
    }

    res.status(201).json(invoice);
  } catch {
    res.status(500).json({ message: "Failed to create invoice" });
  }
});


router.delete("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteInvoice(id, userId);
    if (!deleted) return res.status(404).json({ message: "Invoice not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete invoice" });
  }
});

router.post("/api/invoices/:id/restore", isAuthenticated, async (req: any, res) => {
  try {
    const role = req.user?.userRole ?? req.user?.activeRole;
    if (role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    const restored = await storage.restoreInvoice(id);
    if (!restored) return res.status(404).json({ message: "Invoice not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to restore invoice" });
  }
});

router.patch("/api/invoices/:id/status", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, amount, notes } = req.body;
    const userId = req.user?.claims?.sub || req.user?.id;

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Ensure only the creator or admin can update the status
    if (invoice.createdByUserId !== userId) {
      const user = await storage.getUser(userId);
      if (user?.userRole !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const updateData: any = { status };
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (notes !== undefined) updateData.notes = notes;

    await db.update(invoices).set(updateData).where(eq(invoices.id, id));
    
    logAction(userId, "update_status", "invoice", id, { status }, getClientIp(req));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to update invoice status" });
  }
});

router.get("/api/invoices/statement", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { counterparty, from, to } = req.query;

    let query = db.select().from(invoices).where(eq(invoices.createdByUserId, userId));

    const results = await query;
    let filtered = results;

    if (counterparty) {
      filtered = filtered.filter(inv => 
        (inv.recipientName && inv.recipientName.toLowerCase().includes((counterparty as string).toLowerCase())) ||
        (inv.recipientEmail && inv.recipientEmail.toLowerCase().includes((counterparty as string).toLowerCase()))
      );
    }

    if (from) {
      const fromDate = new Date(from as string);
      filtered = filtered.filter(inv => inv.createdAt && new Date(inv.createdAt) >= fromDate);
    }

    if (to) {
      const toDate = new Date(to as string);
      filtered = filtered.filter(inv => inv.createdAt && new Date(inv.createdAt) <= toDate);
    }

    // Calculate running balance if needed, or just return the invoices
    res.json(filtered);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch statement" });
  }
});

router.patch("/api/invoices/:id/pay", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { paidAt, amount, paymentMethod, reference, notes } = req.body;
    const userId = req.user?.claims?.sub || req.user?.id;

    if (amount) {
      // Partial payment
      const payment = await storage.createInvoicePayment({
        invoiceId: id,
        amount: parseFloat(amount),
        currency: "USD", // Should probably match invoice currency
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        paymentMethod: paymentMethod || "bank_transfer",
        reference: reference || null,
        notes: notes || null,
        recordedBy: userId
      });
      logAction(userId, "pay", "invoice_payment", payment.id, { amount: parseFloat(amount) }, getClientIp(req));
    } else {
      // Full payment (legacy behavior, but now recorded as a payment)
      const balance = await storage.getInvoiceBalance(id);
      if (balance.balance > 0) {
        await storage.createInvoicePayment({
          invoiceId: id,
          amount: balance.balance,
          currency: "USD",
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          paymentMethod: paymentMethod || "bank_transfer",
          recordedBy: userId
        });
      }
    }

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (invoice && invoice.voyageId) {
      logVoyageActivity({ 
        voyageId: invoice.voyageId, 
        userId, 
        activityType: 'invoice_paid', 
        title: invoice.status === 'paid' ? 'Invoice fully paid' : `Partial payment recorded: ${amount} ${invoice.currency}`
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to record payment" });
  }
});

router.get("/api/invoices/:id/payments", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const payments = await storage.getInvoicePayments(id);
    res.json(payments);
  } catch {
    res.status(500).json({ message: "Failed to get payments" });
  }
});

router.post("/api/invoices/:id/payments", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const data = insertInvoicePaymentSchema.parse({
      ...req.body,
      invoiceId: id,
      recordedBy: userId
    });

    const payment = await storage.createInvoicePayment(data);
    logAction(userId, "create", "invoice_payment", payment.id, { amount: data.amount }, getClientIp(req));

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (invoice && invoice.voyageId) {
      logVoyageActivity({ 
        voyageId: invoice.voyageId, 
        userId, 
        activityType: 'invoice_paid', 
        title: invoice.status === 'paid' ? 'Invoice fully paid' : `Partial payment recorded: ${data.amount} ${invoice.currency}`
      });
    }

    // Send payment confirmation email
    if (invoice && invoice.createdByUserId) {
      (async () => {
        try {
          const prefs = await storage.getNotificationPreferences(invoice.createdByUserId);
          if (prefs?.emailOnPaymentReceived) {
            const user = await storage.getUser(invoice.createdByUserId);
            const balance = await storage.getInvoiceBalance(id);
            if (user?.email) {
              await sendPaymentReceivedConfirmation(user.email, {
                invoiceTitle: invoice.title,
                paidAmount: parseFloat(data.amount),
                currency: invoice.currency,
                remainingBalance: balance.balance,
                recipientName: `\${user.firstName || ""} \${user.lastName || ""}`.trim() || user.username,
                viewUrl: `\${req.protocol}://\${req.get("host")}/invoices`
              });
            }
          }
        } catch (e) {
          console.warn("[payment] Payment confirmation email failed:", e);
        }
      })();
    }

    res.status(201).json(payment);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to create payment" });
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

router.get("/api/invoices/:id/pdf", isAuthenticated, async (req: any, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const userId = req.user?.claims?.sub || req.user?.id;
    const companyProfile = userId ? await storage.getCompanyProfileByUser(userId) : null;

    const PDFDocumentModule = await import("pdfkit");
    const PDFDocument = (PDFDocumentModule as any).default || PDFDocumentModule;
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>(async (resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
      try {
        await addPdfHeader(doc, companyProfile || null, "INVOICE");

        doc.fontSize(9).font("Helvetica").fillColor("#333");
        doc.text(`Reference: #INV-${invoice.id}`, 50, doc.y, { width: 240 });
        doc.text(`Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}`, 50, doc.y + 2, { width: 240 });
        if (invoice.dueDate) {
          doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString("en-GB")}`, 50, doc.y + 2, { width: 240 });
        }
        doc.text(`Status: ${(invoice.status || "pending").toUpperCase()}`, 50, doc.y + 2, { width: 240 });
        doc.fillColor("#000").moveDown(1);

        if (invoice.recipientName || invoice.recipientEmail) {
          doc.font("Helvetica-Bold").fontSize(9).text("BILL TO:", 50, doc.y);
          doc.font("Helvetica").fontSize(9);
          if (invoice.recipientName) doc.text(invoice.recipientName, 50, doc.y + 2);
          if (invoice.recipientEmail) doc.text(invoice.recipientEmail, 50, doc.y + 2);
          doc.moveDown(1);
        }

        doc.font("Helvetica-Bold").fontSize(8);
        const y = doc.y;
        doc.rect(50, y, 495, 16).fill("#e8edf4");
        doc.fillColor("#1e3a5f");
        doc.text("DESCRIPTION", 54, y + 4, { width: 320 });
        doc.text("AMOUNT", 374, y + 4, { width: 80, align: "right" });
        doc.text("CURRENCY", 459, y + 4, { width: 80, align: "right" });
        doc.y = y + 20;
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fillColor("#333").font("Helvetica").fontSize(9);
        const iy = doc.y;
        doc.text(invoice.title || `Invoice #${invoice.id}`, 54, iy, { width: 320 });
        doc.font("Helvetica-Bold").fillColor("#1e3a5f");
        doc.text(Number(invoice.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 }), 374, iy, { width: 80, align: "right" });
        doc.fillColor("#333").font("Helvetica");
        doc.text(invoice.currency || "USD", 459, iy, { width: 80, align: "right" });
        doc.moveDown(1);

        doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1.5).stroke().lineWidth(1);
        doc.moveDown(0.5);
        doc.font("Helvetica-Bold").fontSize(10);
        const ty = doc.y;
        doc.text("TOTAL DUE", 54, ty);
        doc.fillColor("#1e3a5f").text(
          `${invoice.currency || "USD"} ${Number(invoice.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
          374, ty, { width: 165, align: "right" }
        );
        doc.fillColor("#000").moveDown(2);

        if (invoice.notes) {
          doc.font("Helvetica-Bold").fontSize(8).text("NOTES:", 50, doc.y);
          doc.font("Helvetica").fontSize(8).text(invoice.notes, 50, doc.y + 2, { width: 495 });
          doc.moveDown(1);
        }

        const cp = companyProfile as any;
        if (cp && (cp.bankName || cp.bankIban || cp.bankSwift)) {
          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor("#b0b8c4").stroke().lineWidth(1).strokeColor("black");
          doc.moveDown(0.5);
          const bankY = doc.y;
          doc.rect(50, bankY, 495, 14).fill("#e8edf4");
          doc.fillColor("#1e3a5f").fontSize(8.5).font("Helvetica-Bold").text("BANK DETAILS", 54, bankY + 3);
          doc.y = bankY + 18;
          doc.fillColor("#333").fontSize(8).font("Helvetica");
          const bankFields: [string, string][] = [
            ["Bank", cp.bankName || ""],
            ["Beneficiary", cp.bankAccountName || cp.companyName || ""],
            ["IBAN", cp.bankIban || ""],
            ["SWIFT / BIC", cp.bankSwift || ""],
            ["Branch", cp.bankBranchName || ""],
          ];
          for (const [label, val] of bankFields) {
            if (!val) continue;
            doc.text(`${label}: `, 54, doc.y, { continued: true }).font("Helvetica-Bold").text(val);
            doc.font("Helvetica").moveDown(0.25);
          }
        }

        addPdfFooter(doc, companyProfile || null);
        doc.end();
      } catch (err) { reject(err); }
    });

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Invoice-${invoiceId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
});


export default router;
