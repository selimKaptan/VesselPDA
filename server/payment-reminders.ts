import { db, pool } from "./db";
import { invoices } from "@shared/schema";
import { and, eq, lt, gt, isNull, lte, isNotNull, sql } from "drizzle-orm";
import { invoiceReminderTemplate, invoiceOverdueTemplate } from "./email-templates";

async function sendEmail(params: { to: string; subject: string; html: string }) {
  const { getResendCredentials } = await import("./email");
  const { Resend } = await import("resend");
  const creds = await getResendCredentials();
  if (!creds) throw new Error("No Resend credentials available");
  const resend = new Resend(creds.apiKey);
  await resend.emails.send({
    from: `VesselPDA <${creds.fromEmail}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

export async function sendSingleReminder(invoice: {
  id: number;
  title: string;
  amount: number;
  currency: string;
  dueDate: Date | null;
  recipientEmail: string | null;
  recipientName: string | null;
  status: string;
}) {
  if (!invoice.recipientEmail) throw new Error("No recipient email");
  if (!invoice.dueDate) throw new Error("No due date");
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    throw new Error("Cannot send reminder for paid/cancelled invoice");
  }

  const now = new Date();
  const dueDate = new Date(invoice.dueDate);
  const isOverdue = dueDate < now;
  const recipientName = invoice.recipientName || "Dear Sir/Madam";
  const dueDateStr = dueDate.toLocaleDateString("en-GB");

  if (isOverdue) {
    const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const { subject, html } = invoiceOverdueTemplate({
      recipientName,
      invoiceTitle: invoice.title,
      amount: Number(invoice.amount),
      currency: invoice.currency || "USD",
      dueDate: dueDateStr,
      daysOverdue,
      invoiceUrl: "https://vesselpda.com/invoices",
    });
    await sendEmail({ to: invoice.recipientEmail, subject, html });
    await db.update(invoices).set({ overdueReminderSentAt: now }).where(eq(invoices.id, invoice.id));
  } else {
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const { subject, html } = invoiceReminderTemplate({
      recipientName,
      invoiceTitle: invoice.title,
      amount: Number(invoice.amount),
      currency: invoice.currency || "USD",
      dueDate: dueDateStr,
      daysUntilDue,
      invoiceUrl: "https://vesselpda.com/invoices",
    });
    await sendEmail({ to: invoice.recipientEmail, subject, html });
    await db.update(invoices).set({ reminderSentAt: now }).where(eq(invoices.id, invoice.id));
  }
}

export async function checkAndSendReminders(): Promise<{
  upcomingReminders: number;
  overdueReminders: number;
  weeklyReminders: number;
  error?: string;
}> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let upcomingCount = 0;
  let overdueCount = 0;
  let weeklyCount = 0;

  try {
    const upcomingInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "pending"),
          isNotNull(invoices.dueDate),
          lte(invoices.dueDate, threeDaysFromNow),
          gt(invoices.dueDate, now),
          isNull(invoices.reminderSentAt),
          isNotNull(invoices.recipientEmail)
        )
      );

    for (const invoice of upcomingInvoices) {
      if (!invoice.recipientEmail || !invoice.dueDate) continue;
      try {
        const dueDate = new Date(invoice.dueDate);
        const daysUntilDue = Math.max(
          1,
          Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );
        const { subject, html } = invoiceReminderTemplate({
          recipientName: invoice.recipientName || "Dear Sir/Madam",
          invoiceTitle: invoice.title,
          amount: Number(invoice.amount),
          currency: invoice.currency || "USD",
          dueDate: dueDate.toLocaleDateString("en-GB"),
          daysUntilDue,
          invoiceUrl: "https://vesselpda.com/invoices",
        });
        await sendEmail({ to: invoice.recipientEmail, subject, html });
        await db.update(invoices).set({ reminderSentAt: now }).where(eq(invoices.id, invoice.id));
        upcomingCount++;
        console.log(`[reminders] Upcoming reminder sent for invoice ${invoice.id}`);
      } catch (e) {
        console.error(`[reminders] Failed to send reminder for invoice ${invoice.id}:`, e);
      }
    }

    const overdueInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "pending"),
          isNotNull(invoices.dueDate),
          lt(invoices.dueDate, now),
          isNull(invoices.overdueReminderSentAt),
          isNotNull(invoices.recipientEmail)
        )
      );

    for (const invoice of overdueInvoices) {
      if (!invoice.recipientEmail || !invoice.dueDate) continue;
      try {
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.max(
          1,
          Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        const { subject, html } = invoiceOverdueTemplate({
          recipientName: invoice.recipientName || "Dear Sir/Madam",
          invoiceTitle: invoice.title,
          amount: Number(invoice.amount),
          currency: invoice.currency || "USD",
          dueDate: dueDate.toLocaleDateString("en-GB"),
          daysOverdue,
          invoiceUrl: "https://vesselpda.com/invoices",
        });
        await sendEmail({ to: invoice.recipientEmail, subject, html });
        await db.update(invoices).set({ overdueReminderSentAt: now }).where(eq(invoices.id, invoice.id));

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            invoice.createdByUserId,
            "invoice_overdue",
            "Invoice Overdue",
            `Invoice "${invoice.title}" is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`,
            "/invoices",
          ]
        );

        overdueCount++;
        console.log(`[reminders] Overdue reminder sent for invoice ${invoice.id}`);
      } catch (e) {
        console.error(`[reminders] Failed to send overdue reminder for invoice ${invoice.id}:`, e);
      }
    }

    const weeklyOverdueInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "pending"),
          isNotNull(invoices.dueDate),
          lt(invoices.dueDate, now),
          isNotNull(invoices.overdueReminderSentAt),
          lt(invoices.overdueReminderSentAt, sevenDaysAgo),
          isNotNull(invoices.recipientEmail)
        )
      );

    for (const invoice of weeklyOverdueInvoices) {
      if (!invoice.recipientEmail || !invoice.dueDate) continue;
      try {
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.max(
          1,
          Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        const { subject, html } = invoiceOverdueTemplate({
          recipientName: invoice.recipientName || "Dear Sir/Madam",
          invoiceTitle: invoice.title,
          amount: Number(invoice.amount),
          currency: invoice.currency || "USD",
          dueDate: dueDate.toLocaleDateString("en-GB"),
          daysOverdue,
          invoiceUrl: "https://vesselpda.com/invoices",
        });
        await sendEmail({ to: invoice.recipientEmail, subject, html });
        await db.update(invoices).set({ overdueReminderSentAt: now }).where(eq(invoices.id, invoice.id));
        weeklyCount++;
        console.log(`[reminders] Weekly overdue reminder sent for invoice ${invoice.id}`);
      } catch (e) {
        console.error(`[reminders] Failed to send weekly overdue reminder for invoice ${invoice.id}:`, e);
      }
    }

    return {
      upcomingReminders: upcomingCount,
      overdueReminders: overdueCount,
      weeklyReminders: weeklyCount,
    };
  } catch (error: any) {
    console.error("[reminders] Payment reminder check failed:", error);
    return {
      upcomingReminders: upcomingCount,
      overdueReminders: overdueCount,
      weeklyReminders: weeklyCount,
      error: error.message,
    };
  }
}
