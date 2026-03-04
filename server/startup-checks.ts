import { db } from "./db";
import { vesselCertificates, notifications, invoices } from "@shared/schema";
import { and, eq, lte, sql } from "drizzle-orm";

async function checkCertificateExpiry() {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const expiring = await db.select().from(vesselCertificates)
    .where(and(
      sql`${vesselCertificates.expiresAt} IS NOT NULL`,
      lte(vesselCertificates.expiresAt, thirtyDaysFromNow),
      sql`${vesselCertificates.expiresAt} > NOW()`
    ));

  for (const cert of expiring) {
    const existingRows = await db.execute(sql`
      SELECT id FROM notifications
      WHERE user_id = ${cert.userId}
        AND type = 'cert_expiry'
        AND link = '/vessel-certificates'
        AND message LIKE ${`%${cert.name}%`}
        AND created_at > ${sevenDaysAgo.toISOString()}
      LIMIT 1
    `);
    const existing: any[] = (existingRows.rows ?? existingRows) as any[];
    if (existing.length > 0) continue;

    const daysLeft = Math.ceil((new Date(cert.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    await db.insert(notifications).values({
      userId: cert.userId,
      type: "cert_expiry",
      title: "Certificate Expiry Warning",
      message: `${cert.name} — expires in ${daysLeft} days`,
      link: "/vessel-certificates",
    });
  }

  if (expiring.length > 0) {
    console.log(`[startup-checks] Sent ${expiring.length} certificate expiry notifications`);
  }
}

async function checkOverdueInvoices() {
  const overdue = await db.select().from(invoices)
    .where(and(
      eq(invoices.status, "pending"),
      sql`${invoices.dueDate} IS NOT NULL AND ${invoices.dueDate} < NOW()`
    ));

  for (const inv of overdue) {
    await db.update(invoices).set({ status: "overdue" }).where(eq(invoices.id, inv.id));

    await db.insert(notifications).values({
      userId: inv.createdByUserId,
      type: "invoice_overdue",
      title: "Overdue Invoice",
      message: `${inv.title} — payment is overdue`,
      link: "/invoices",
    });
  }

  if (overdue.length > 0) {
    console.log(`[startup-checks] Marked ${overdue.length} invoices as overdue`);
  }
}

export async function runStartupChecks() {
  await checkCertificateExpiry();
  await checkOverdueInvoices();
}
