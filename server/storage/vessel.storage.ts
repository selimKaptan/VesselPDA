import { db, eq, and, or, asc, lte, gte, isNull } from "./base";
import {
  vessels, ports, vesselCertificates, vesselQ88,
  type Vessel, type InsertVessel,
  type VesselCertificate, type InsertVesselCertificate,
  type VesselQ88, type InsertVesselQ88,
} from "@shared/schema";

async function getVesselsByUser(userId: string, organizationId?: number): Promise<Vessel[]> {
  const baseFilter = isNull(vessels.deletedAt);
  if (organizationId) {
    return db.select().from(vessels).where(and(
      or(eq(vessels.userId, userId), eq((vessels as any).organizationId, organizationId)),
      baseFilter
    ));
  }
  return db.select().from(vessels).where(and(eq(vessels.userId, userId), baseFilter));
}

async function getVessel(id: number, userId: string): Promise<Vessel | undefined> {
  const [vessel] = await db.select().from(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId)));
  return vessel;
}

async function getVesselById(id: number): Promise<Vessel | undefined> {
  const [vessel] = await db.select().from(vessels).where(eq(vessels.id, id));
  return vessel;
}

async function createVessel(vessel: InsertVessel): Promise<Vessel> {
  const [created] = await db.insert(vessels).values(vessel).returning();
  return created;
}

async function updateVessel(id: number, userId: string, data: Partial<InsertVessel>): Promise<Vessel | undefined> {
  const [updated] = await db.update(vessels).set(data).where(and(eq(vessels.id, id), eq(vessels.userId, userId))).returning();
  return updated;
}

async function updateVesselById(id: number, data: Partial<InsertVessel>): Promise<Vessel | undefined> {
  const [updated] = await db.update(vessels).set(data).where(eq(vessels.id, id)).returning();
  return updated;
}

async function deleteVessel(id: number, userId: string): Promise<boolean> {
  const [updated] = await db.update(vessels)
    .set({ deletedAt: new Date() })
    .where(and(eq(vessels.id, id), eq(vessels.userId, userId), isNull(vessels.deletedAt)))
    .returning();
  return !!updated;
}

async function deleteVesselById(id: number): Promise<boolean> {
  const [updated] = await db.update(vessels)
    .set({ deletedAt: new Date() })
    .where(and(eq(vessels.id, id), isNull(vessels.deletedAt)))
    .returning();
  return !!updated;
}

async function restoreVessel(id: number): Promise<boolean> {
  const [updated] = await db.update(vessels)
    .set({ deletedAt: null })
    .where(eq(vessels.id, id))
    .returning();
  return !!updated;
}

async function getAllVessels(): Promise<Vessel[]> {
  return db.select().from(vessels);
}

async function getVesselCertificates(vesselId: number): Promise<VesselCertificate[]> {
  return db.select().from(vesselCertificates)
    .where(eq(vesselCertificates.vesselId, vesselId))
    .orderBy(asc(vesselCertificates.createdAt));
}

async function createVesselCertificate(data: InsertVesselCertificate): Promise<VesselCertificate> {
  const now = new Date();
  let status = "valid";
  const issuedAt = data.issuedAt ? new Date(data.issuedAt as any) : null;
  const expiresAt = data.expiresAt ? new Date(data.expiresAt as any) : null;
  if (expiresAt) {
    if (expiresAt < now) status = "expired";
    else if (expiresAt < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) status = "expiring_soon";
  }
  const [row] = await db.insert(vesselCertificates).values({ ...data, issuedAt, expiresAt, status }).returning();
  return row;
}

async function updateVesselCertificate(id: number, data: Partial<InsertVesselCertificate>): Promise<VesselCertificate | undefined> {
  const now = new Date();
  let status: string | undefined;
  const issuedAt = data.issuedAt !== undefined ? (data.issuedAt ? new Date(data.issuedAt as any) : null) : undefined;
  const expiresAt = data.expiresAt !== undefined ? (data.expiresAt ? new Date(data.expiresAt as any) : null) : undefined;
  if (expiresAt !== undefined) {
    if (!expiresAt) {
      status = "valid";
    } else {
      if (expiresAt < now) status = "expired";
      else if (expiresAt < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) status = "expiring_soon";
      else status = "valid";
    }
  }
  const updateData: any = { ...data };
  if (issuedAt !== undefined) updateData.issuedAt = issuedAt;
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
  if (status) updateData.status = status;
  const [row] = await db.update(vesselCertificates).set(updateData).where(eq(vesselCertificates.id, id)).returning();
  return row;
}

async function deleteVesselCertificate(id: number): Promise<boolean> {
  const result = await db.delete(vesselCertificates).where(eq(vesselCertificates.id, id));
  return (result as any).rowCount > 0;
}

async function getExpiringCertificates(userId: string, daysAhead: number, includeExpired = false): Promise<VesselCertificate[]> {
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const conditions = [
    eq(vesselCertificates.userId, userId),
    lte(vesselCertificates.expiresAt, cutoff),
  ];
  if (!includeExpired) {
    conditions.push(gte(vesselCertificates.expiresAt, new Date()));
  }
  return db.select().from(vesselCertificates)
    .where(and(...conditions))
    .orderBy(asc(vesselCertificates.expiresAt));
}

async function getVesselQ88(vesselId: number): Promise<VesselQ88 | undefined> {
  const [row] = await db.select().from(vesselQ88).where(eq(vesselQ88.vesselId, vesselId));
  return row;
}

async function createVesselQ88(data: InsertVesselQ88): Promise<VesselQ88> {
  const [row] = await db.insert(vesselQ88).values(data).returning();
  return row;
}

async function updateVesselQ88(vesselId: number, data: Partial<InsertVesselQ88>): Promise<VesselQ88> {
  const existing = await getVesselQ88(vesselId);
  if (!existing) throw new Error("Q88 not found");
  const [row] = await db
    .update(vesselQ88)
    .set({ ...data, lastUpdated: new Date(), version: (existing.version ?? 1) + 1 })
    .where(eq(vesselQ88.vesselId, vesselId))
    .returning();
  return row;
}

async function getPublicVesselQ88(vesselId: number): Promise<VesselQ88 | undefined> {
  const [row] = await db
    .select()
    .from(vesselQ88)
    .where(and(eq(vesselQ88.vesselId, vesselId), eq(vesselQ88.isPublic, true)));
  return row;
}

async function duplicateVesselQ88(sourceVesselId: number, targetVesselId: number, userId: string): Promise<VesselQ88> {
  const source = await getVesselQ88(sourceVesselId);
  if (!source) throw new Error("Source Q88 not found");
  const { id: _id, createdAt: _ca, ...rest } = source;
  const [row] = await db.insert(vesselQ88).values({
    ...rest,
    vesselId: targetVesselId,
    userId,
    version: 1,
    status: "draft",
    lastUpdated: new Date(),
  }).returning();
  return row;
}

export const vesselStorage = {
  getVesselsByUser,
  getVessel,
  getVesselById,
  createVessel,
  updateVessel,
  updateVesselById,
  deleteVessel,
  deleteVesselById,
  restoreVessel,
  getAllVessels,
  getVesselCertificates,
  createVesselCertificate,
  updateVesselCertificate,
  deleteVesselCertificate,
  getExpiringCertificates,
  getVesselQ88,
  createVesselQ88,
  updateVesselQ88,
  getPublicVesselQ88,
  duplicateVesselQ88,
};
