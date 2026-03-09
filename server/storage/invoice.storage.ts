import { db, eq, and, isNull, desc, sql } from "./base";
import {
  invoices, invoicePayments,
  type Invoice, type InsertInvoice,
  type InvoicePayment, type InsertInvoicePayment,
} from "@shared/schema";

async function createInvoice(data: InsertInvoice): Promise<Invoice> {
  const [row] = await db.insert(invoices).values({ ...data, status: "pending" }).returning();
  return row;
}

async function deleteInvoice(id: number, userId: string): Promise<boolean> {
  const [updated] = await db.update(invoices)
    .set({ deletedAt: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.createdByUserId, userId), isNull(invoices.deletedAt)))
    .returning();
  return !!updated;
}

async function restoreInvoice(id: number): Promise<boolean> {
  const [updated] = await db.update(invoices)
    .set({ deletedAt: null })
    .where(eq(invoices.id, id))
    .returning();
  return !!updated;
}

async function getInvoicesByUser(userId: string, organizationId?: number): Promise<any[]> {
  const orgClause = organizationId
    ? sql`(i.created_by_user_id = ${userId} OR i.organization_id = ${organizationId})`
    : sql`i.created_by_user_id = ${userId}`;
  const rows = await db.execute(sql`
    SELECT i.*, v.vessel_name, v.port_id, p2.name as port_name_ref
    FROM invoices i
    LEFT JOIN voyages v ON v.id = i.voyage_id
    LEFT JOIN ports p2 ON p2.id = v.port_id
    WHERE ${orgClause}
      AND i.deleted_at IS NULL
    ORDER BY i.created_at DESC
  `);
  const arr: any[] = rows.rows ?? (rows as any);
  return arr.map((r: any) => ({
    id: r.id,
    voyageId: r.voyage_id,
    proformaId: r.proforma_id,
    fdaId: r.fda_id,
    createdByUserId: r.created_by_user_id,
    title: r.title,
    amount: r.amount,
    currency: r.currency,
    dueDate: r.due_date,
    paidAt: r.paid_at,
    status: r.status,
    notes: r.notes,
    invoiceType: r.invoice_type,
    linkedProformaId: r.linked_proforma_id,
    recipientEmail: r.recipient_email,
    recipientName: r.recipient_name,
    createdAt: r.created_at,
    vesselName: r.vessel_name,
    portName: r.port_name_ref,
  }));
}

async function updateInvoiceStatus(id: number, status: string, paidAt?: Date): Promise<void> {
  await db.update(invoices)
    .set({ status, ...(paidAt ? { paidAt } : {}) })
    .where(eq(invoices.id, id));
}

async function getAllPendingInvoicesOverdue(): Promise<Invoice[]> {
  return db.select().from(invoices)
    .where(and(
      eq(invoices.status, "pending"),
      sql`${invoices.dueDate} IS NOT NULL AND ${invoices.dueDate} < NOW()`
    ));
}

async function getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]> {
  return db.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, invoiceId)).orderBy(desc(invoicePayments.paidAt));
}

async function getInvoiceBalance(invoiceId: number): Promise<{ total: number; paid: number; balance: number; status: string }> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) throw new Error("Invoice not found");
  const payments = await getInvoicePayments(invoiceId);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(invoice.amount) - totalPaid;
  let status = invoice.status;
  if (balance <= 0) {
    status = "paid";
  } else if (totalPaid > 0) {
    status = "pending";
  }
  return { total: Number(invoice.amount), paid: totalPaid, balance: Math.max(0, balance), status };
}

async function createInvoicePayment(data: InsertInvoicePayment): Promise<InvoicePayment> {
  const [payment] = await db.insert(invoicePayments).values(data).returning();
  const { total, paid, balance, status } = await getInvoiceBalance(data.invoiceId);
  await db.update(invoices)
    .set({ amountPaid: paid, balance, status, paidAt: status === "paid" ? new Date() : null })
    .where(eq(invoices.id, data.invoiceId));
  return payment;
}

export const invoiceStorage = {
  createInvoice,
  deleteInvoice,
  restoreInvoice,
  getInvoicesByUser,
  updateInvoiceStatus,
  getAllPendingInvoicesOverdue,
  getInvoicePayments,
  getInvoiceBalance,
  createInvoicePayment,
};
