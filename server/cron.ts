import { db } from "./db";
import { invoices, vesselCertificates, daAdvances, users, notificationPreferences, vessels } from "@shared/schema";
import { and, eq, lt, gt, lte, isNotNull, sql } from "drizzle-orm";
import { 
  sendInvoiceDueReminder, 
  sendCertificateExpiryWarning, 
  sendDaAdvanceDueReminder 
} from "./email";
import { storage } from "./storage";

export async function checkInvoiceDueDates() {
  console.log("[cron] checkInvoiceDueDates: starting...");
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const dueSoonInvoices = await db.select()
      .from(invoices)
      .where(and(
        eq(invoices.status, "pending"),
        isNotNull(invoices.dueDate),
        isNotNull(invoices.recipientEmail),
        sql`${invoices.dueDate} > ${now}`,
        sql`${invoices.dueDate} <= ${sevenDaysFromNow}`
      ));

    for (const inv of dueSoonInvoices) {
      const dueDate = new Date(inv.dueDate!);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1 || diffDays === 7) {
        const prefs = await storage.getNotificationPreferences(inv.createdByUserId);
        if (prefs?.emailOnInvoiceDue && inv.recipientEmail) {
          await sendInvoiceDueReminder(inv.recipientEmail, {
            recipientName: inv.recipientName || "Valued Customer",
            invoiceTitle: inv.title,
            amount: Number(inv.amount),
            currency: inv.currency,
            dueDate: dueDate.toLocaleDateString("en-GB"),
            invoiceUrl: "https://vesselpda.com/invoices",
            daysRemaining: diffDays
          });
          console.log(`[cron] Sent invoice reminder for ${inv.id} (${diffDays} days left)`);
        }
      }
    }
  } catch (err) {
    console.error("[cron] checkInvoiceDueDates error:", err);
  }
}

export async function checkCertificateExpiry() {
  console.log("[cron] checkCertificateExpiry: starting...");
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    const expiringCerts = await db.select({
      cert: vesselCertificates,
      vesselName: vessels.name,
      userEmail: users.email
    })
    .from(vesselCertificates)
    .innerJoin(vessels, eq(vesselCertificates.vesselId, vessels.id))
    .innerJoin(users, eq(vesselCertificates.userId, users.id))
    .where(and(
      isNotNull(vesselCertificates.expiresAt),
      sql`${vesselCertificates.expiresAt} > ${now}`,
      sql`${vesselCertificates.expiresAt} <= ${thirtyDaysFromNow}`
    ));

    for (const { cert, vesselName, userEmail } of expiringCerts) {
      const expiresAt = new Date(cert.expiresAt!);
      const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 30) {
        const prefs = await storage.getNotificationPreferences(cert.userId);
        if (prefs?.emailOnCertificateExpiry && userEmail) {
          await sendCertificateExpiryWarning(userEmail, {
            vesselName: vesselName || "Unknown Vessel",
            certificateType: cert.certType || cert.name,
            expiryDate: expiresAt.toLocaleDateString("en-GB"),
            viewUrl: "https://vesselpda.com/vessel-certificates"
          });
          console.log(`[cron] Sent certificate expiry warning for ${cert.id} (${diffDays} days left)`);
        }
      }
    }
  } catch (err) {
    console.error("[cron] checkCertificateExpiry error:", err);
  }
}

export async function checkDaAdvanceDue() {
  console.log("[cron] checkDaAdvanceDue: starting...");
  const now = new Date();
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  try {
    const dueAdvances = await db.select({
      advance: daAdvances,
      userEmail: users.email
    })
    .from(daAdvances)
    .innerJoin(users, eq(daAdvances.userId, users.id))
    .where(and(
      eq(daAdvances.status, "pending"),
      isNotNull(daAdvances.dueDate),
      sql`${daAdvances.dueDate} > ${now}`,
      sql`${daAdvances.dueDate} <= ${fourteenDaysFromNow}`
    ));

    for (const { advance, userEmail } of dueAdvances) {
      const dueDate = new Date(advance.dueDate!);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 14) {
        const prefs = await storage.getNotificationPreferences(advance.userId);
        if (prefs?.emailOnDaAdvanceDue && userEmail) {
          await sendDaAdvanceDueReminder(userEmail, {
            advanceTitle: advance.title,
            amount: Number(advance.requestedAmount),
            currency: advance.currency,
            dueDate: dueDate.toLocaleDateString("en-GB"),
            viewUrl: "https://vesselpda.com/da-advances",
            daysRemaining: diffDays
          });
          console.log(`[cron] Sent DA advance reminder for ${advance.id} (${diffDays} days left)`);
        }
      }
    }
  } catch (err) {
    console.error("[cron] checkDaAdvanceDue error:", err);
  }
}
