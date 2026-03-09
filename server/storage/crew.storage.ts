import { db, eq, and, asc, desc, inArray } from "./base";
import {
  vesselCrew, crewStcwCertificates, crewPayroll, vessels,
  type VesselCrew, type InsertVesselCrew,
  type CrewStcwCertificate, type InsertCrewStcwCertificate,
  type CrewStcwCert, type InsertCrewStcwCert,
  type CrewPayroll, type InsertCrewPayroll,
} from "@shared/schema";

async function getVesselCrew(vesselId: number): Promise<VesselCrew[]> {
  return db.select().from(vesselCrew)
    .where(eq(vesselCrew.vesselId, vesselId))
    .orderBy(asc(vesselCrew.createdAt));
}

async function getCrewRoster(userId: string): Promise<(VesselCrew & { vesselName: string })[]> {
  const userVessels = await db.select({ id: vessels.id }).from(vessels).where(eq(vessels.userId, userId));
  if (!userVessels.length) return [];
  const vesselIds = userVessels.map(v => v.id);
  const rows = await db.select({
    id: vesselCrew.id,
    vesselId: vesselCrew.vesselId,
    userId: vesselCrew.userId,
    firstName: vesselCrew.firstName,
    lastName: vesselCrew.lastName,
    rank: vesselCrew.rank,
    nationality: vesselCrew.nationality,
    contractStartDate: vesselCrew.contractStartDate,
    contractEndDate: vesselCrew.contractEndDate,
    monthlySalary: vesselCrew.monthlySalary,
    salaryCurrency: vesselCrew.salaryCurrency,
    seamanBookNumber: vesselCrew.seamanBookNumber,
    seamanBookExpiry: vesselCrew.seamanBookExpiry,
    passportNumber: vesselCrew.passportNumber,
    passportExpiry: vesselCrew.passportExpiry,
    visaType: vesselCrew.visaType,
    visaExpiry: vesselCrew.visaExpiry,
    nextPortJoin: vesselCrew.nextPortJoin,
    reliefDueDate: vesselCrew.reliefDueDate,
    emergencyContactName: vesselCrew.emergencyContactName,
    emergencyContactPhone: vesselCrew.emergencyContactPhone,
    passportFileBase64: vesselCrew.passportFileBase64,
    passportFileName: vesselCrew.passportFileName,
    passportFileUrl: vesselCrew.passportFileUrl,
    seamansBookFileBase64: vesselCrew.seamansBookFileBase64,
    seamansBookFileName: vesselCrew.seamansBookFileName,
    seamansBookFileUrl: vesselCrew.seamansBookFileUrl,
    medicalFitnessExpiry: vesselCrew.medicalFitnessExpiry,
    medicalFitnessFileBase64: vesselCrew.medicalFitnessFileBase64,
    medicalFitnessFileName: vesselCrew.medicalFitnessFileName,
    medicalFitnessFileUrl: vesselCrew.medicalFitnessFileUrl,
    status: vesselCrew.status,
    createdAt: vesselCrew.createdAt,
    vesselName: vessels.name,
  })
  .from(vesselCrew)
  .innerJoin(vessels, eq(vesselCrew.vesselId, vessels.id))
  .where(inArray(vesselCrew.vesselId, vesselIds))
  .orderBy(asc(vessels.name), asc(vesselCrew.createdAt));
  return rows as any;
}

async function createVesselCrewMember(data: InsertVesselCrew): Promise<VesselCrew> {
  const toDate = (v: any) => v ? new Date(v) : null;
  const [row] = await db.insert(vesselCrew).values({
    ...data,
    contractStartDate: toDate(data.contractStartDate) as any,
    contractEndDate: toDate(data.contractEndDate) as any,
    passportExpiry: toDate(data.passportExpiry) as any,
    seamanBookExpiry: toDate(data.seamanBookExpiry) as any,
    visaExpiry: toDate(data.visaExpiry) as any,
    reliefDueDate: toDate(data.reliefDueDate) as any,
    medicalFitnessExpiry: toDate((data as any).medicalFitnessExpiry) as any,
  }).returning();
  return row;
}

async function updateVesselCrewMember(id: number, data: Partial<InsertVesselCrew>): Promise<VesselCrew | undefined> {
  const toDate = (v: any) => (v !== undefined ? (v ? new Date(v) : null) : undefined);
  const updateData: any = { ...data };
  if (data.contractStartDate !== undefined) updateData.contractStartDate = toDate(data.contractStartDate);
  if (data.contractEndDate !== undefined) updateData.contractEndDate = toDate(data.contractEndDate);
  if (data.passportExpiry !== undefined) updateData.passportExpiry = toDate(data.passportExpiry);
  if (data.seamanBookExpiry !== undefined) updateData.seamanBookExpiry = toDate(data.seamanBookExpiry);
  if (data.visaExpiry !== undefined) updateData.visaExpiry = toDate(data.visaExpiry);
  if (data.reliefDueDate !== undefined) updateData.reliefDueDate = toDate(data.reliefDueDate);
  if ((data as any).medicalFitnessExpiry !== undefined) updateData.medicalFitnessExpiry = toDate((data as any).medicalFitnessExpiry);
  const [row] = await db.update(vesselCrew).set(updateData).where(eq(vesselCrew.id, id)).returning();
  return row;
}

async function deleteVesselCrewMember(id: number): Promise<boolean> {
  const result = await db.delete(vesselCrew).where(eq(vesselCrew.id, id));
  return (result as any).rowCount > 0;
}

async function getCrewStcwCertificates(crewId: number): Promise<CrewStcwCertificate[]> {
  return db.select().from(crewStcwCertificates)
    .where(eq(crewStcwCertificates.crewId, crewId))
    .orderBy(asc(crewStcwCertificates.expiryDate));
}

async function createCrewStcwCertificate(data: InsertCrewStcwCertificate): Promise<CrewStcwCertificate> {
  const toDate = (v: any) => v ? new Date(v) : null;
  const [row] = await db.insert(crewStcwCertificates).values({
    ...data,
    issueDate: toDate(data.issueDate) as any,
    expiryDate: toDate(data.expiryDate) as any,
  }).returning();
  return row;
}

async function updateCrewStcwCertificate(id: number, data: Partial<InsertCrewStcwCertificate>): Promise<CrewStcwCertificate | undefined> {
  const toDate = (v: any) => (v !== undefined ? (v ? new Date(v) : null) : undefined);
  const updateData: any = { ...data };
  if (data.issueDate !== undefined) updateData.issueDate = toDate(data.issueDate);
  if (data.expiryDate !== undefined) updateData.expiryDate = toDate(data.expiryDate);
  const [row] = await db.update(crewStcwCertificates).set(updateData).where(eq(crewStcwCertificates.id, id)).returning();
  return row;
}

async function deleteCrewStcwCertificate(id: number): Promise<boolean> {
  const result = await db.delete(crewStcwCertificates).where(eq(crewStcwCertificates.id, id));
  return (result as any).rowCount > 0;
}

async function getCrewStcwCerts(crewId: number): Promise<CrewStcwCert[]> {
  return db.select().from(crewStcwCertificates).where(eq(crewStcwCertificates.crewId, crewId)).orderBy(asc(crewStcwCertificates.expiryDate));
}

async function createCrewStcwCert(data: InsertCrewStcwCert): Promise<CrewStcwCert> {
  const [row] = await db.insert(crewStcwCertificates).values(data).returning();
  return row;
}

async function updateCrewStcwCert(id: number, data: Partial<InsertCrewStcwCert>): Promise<CrewStcwCert | undefined> {
  const [row] = await db.update(crewStcwCertificates).set(data).where(eq(crewStcwCertificates.id, id)).returning();
  return row;
}

async function deleteCrewStcwCert(id: number): Promise<boolean> {
  const [deleted] = await db.delete(crewStcwCertificates).where(eq(crewStcwCertificates.id, id)).returning();
  return !!deleted;
}

async function getCrewPayroll(vesselId: number): Promise<CrewPayroll[]> {
  return db.select().from(crewPayroll)
    .where(eq(crewPayroll.vesselId, vesselId))
    .orderBy(desc(crewPayroll.periodYear), desc(crewPayroll.periodMonth));
}

async function createCrewPayroll(data: InsertCrewPayroll): Promise<CrewPayroll> {
  const toDate = (v: any) => v ? new Date(v) : null;
  const [row] = await db.insert(crewPayroll).values({
    ...data,
    paidDate: toDate(data.paidDate) as any,
  }).returning();
  return row;
}

async function updateCrewPayroll(id: number, data: Partial<InsertCrewPayroll>): Promise<CrewPayroll | undefined> {
  const toDate = (v: any) => (v !== undefined ? (v ? new Date(v) : null) : undefined);
  const updateData: any = { ...data };
  if (data.paidDate !== undefined) updateData.paidDate = toDate(data.paidDate);
  const [row] = await db.update(crewPayroll).set(updateData).where(eq(crewPayroll.id, id)).returning();
  return row;
}

async function getCrewSummary(vesselId: number): Promise<any> {
  const crew = await getVesselCrew(vesselId);
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const certs = await db.select().from(crewStcwCertificates).where(eq(crewStcwCertificates.vesselId, vesselId));
  return {
    totalCrew: crew.length,
    expiringCerts: certs.filter(c => new Date(c.expiryDate) >= now && new Date(c.expiryDate) <= thirtyDays).length,
    expiredCerts: certs.filter(c => new Date(c.expiryDate) < now).length,
  };
}

export const crewStorage = {
  getVesselCrew,
  getCrewRoster,
  createVesselCrewMember,
  updateVesselCrewMember,
  deleteVesselCrewMember,
  getCrewStcwCertificates,
  createCrewStcwCertificate,
  updateCrewStcwCertificate,
  deleteCrewStcwCertificate,
  getCrewStcwCerts,
  createCrewStcwCert,
  updateCrewStcwCert,
  deleteCrewStcwCert,
  getCrewPayroll,
  createCrewPayroll,
  updateCrewPayroll,
  getCrewSummary,
};
