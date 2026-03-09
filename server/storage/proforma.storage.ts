import { db, eq, and, or, desc, isNull } from "./base";
import { vessels, ports, proformas, proformaApprovalLogs } from "@shared/schema";
import type { Vessel, Port, Proforma, InsertProforma } from "@shared/schema";

async function getProformasByUser(userId: string, organizationId?: number): Promise<Proforma[]> {
  const filter = organizationId
    ? or(eq(proformas.userId, userId), eq((proformas as any).organizationId, organizationId))
    : eq(proformas.userId, userId);
  return db.select().from(proformas)
    .where(filter)
    .orderBy(desc(proformas.createdAt));
}

async function getProformasByVoyage(voyageId: number): Promise<Proforma[]> {
  return db.select().from(proformas)
    .where(eq((proformas as any).voyageId, voyageId))
    .orderBy(desc(proformas.createdAt));
}

async function getAllProformas(): Promise<Proforma[]> {
  return db.select().from(proformas).orderBy(desc(proformas.createdAt));
}

async function getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined> {
  const [proforma] = await db.select().from(proformas)
    .where(and(eq(proformas.id, id), eq(proformas.userId, userId)));
  if (!proforma) return undefined;
  const [vessel] = await db.select().from(vessels).where(eq(vessels.id, proforma.vesselId));
  const [port] = await db.select().from(ports).where(eq(ports.id, proforma.portId));
  return { ...proforma, vessel, port };
}

async function getProformaById(id: number): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined> {
  const [proforma] = await db.select().from(proformas).where(eq(proformas.id, id));
  if (!proforma) return undefined;
  const [vessel] = await db.select().from(vessels).where(eq(vessels.id, proforma.vesselId));
  const [port] = await db.select().from(ports).where(eq(ports.id, proforma.portId));
  return { ...proforma, vessel, port };
}

async function createProforma(proforma: InsertProforma): Promise<Proforma> {
  const [created] = await db.insert(proformas).values(proforma).returning();
  return created;
}

async function updateProforma(id: number, data: Partial<Proforma>): Promise<Proforma | undefined> {
  const [row] = await db.update(proformas).set(data as any).where(eq(proformas.id, id)).returning();
  return row;
}

async function duplicateProforma(id: number, userId: string): Promise<Proforma | undefined> {
  const [original] = await db.select().from(proformas).where(and(eq(proformas.id, id), eq(proformas.userId, userId)));
  if (!original) return undefined;
  const { id: _id, createdAt: _createdAt, referenceNumber, ...rest } = original;
  const ts = Date.now().toString().slice(-6);
  const newRef = `${referenceNumber}-COPY-${ts}`;
  const [created] = await db.insert(proformas).values({ ...rest, referenceNumber: newRef, status: "draft" }).returning();
  return created;
}

async function deleteProforma(id: number, userId: string): Promise<boolean> {
  const [updated] = await db.update(proformas)
    .set({ deletedAt: new Date() })
    .where(and(eq(proformas.id, id), eq(proformas.userId, userId), isNull(proformas.deletedAt)))
    .returning();
  return !!updated;
}

async function restoreProforma(id: number): Promise<boolean> {
  const [updated] = await db.update(proformas)
    .set({ deletedAt: null })
    .where(eq(proformas.id, id))
    .returning();
  return !!updated;
}

async function createProformaApprovalLog(data: { proformaId: number; userId: string; action: string; note?: string | null; previousStatus: string; newStatus: string }): Promise<any> {
  const [row] = await db.insert(proformaApprovalLogs).values(data as any).returning();
  return row;
}

async function getProformaApprovalLogs(proformaId: number): Promise<any[]> {
  return db.select().from(proformaApprovalLogs)
    .where(eq(proformaApprovalLogs.proformaId, proformaId))
    .orderBy(desc(proformaApprovalLogs.createdAt));
}

async function getProformasByApprovalStatus(approvalStatus: string): Promise<Proforma[]> {
  return db.select().from(proformas)
    .where(eq(proformas.approvalStatus, approvalStatus))
    .orderBy(desc(proformas.createdAt));
}

async function findProformaByToken(token: string): Promise<Proforma | undefined> {
  const [row] = await db.select().from(proformas).where(eq(proformas.approvalToken, token));
  return row;
}

export const proformaStorage = {
  getProformasByUser,
  getProformasByVoyage,
  getAllProformas,
  getProforma,
  getProformaById,
  createProforma,
  updateProforma,
  duplicateProforma,
  deleteProforma,
  restoreProforma,
  createProformaApprovalLog,
  getProformaApprovalLogs,
  getProformasByApprovalStatus,
  findProformaByToken,
};
