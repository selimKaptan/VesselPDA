import { db, eq, and, asc, desc, cached } from "./base";
import {
  companyProfiles, endorsements, users,
  type CompanyProfile, type InsertCompanyProfile,
  type Endorsement, type InsertEndorsement,
} from "@shared/schema";

async function getCompanyProfileByUser(userId: string): Promise<CompanyProfile | undefined> {
  const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
  return profile;
}

async function getCompanyProfile(id: number): Promise<CompanyProfile | undefined> {
  const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id));
  return profile;
}

async function createCompanyProfile(data: InsertCompanyProfile): Promise<CompanyProfile> {
  const [created] = await db.insert(companyProfiles).values(data as any).returning();
  return created;
}

async function updateCompanyProfile(id: number, data: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(companyProfiles.id, id))
    .returning();
  return updated;
}

async function getPublicCompanyProfiles(): Promise<CompanyProfile[]> {
  return cached("company:public", "long", () =>
    db.select().from(companyProfiles)
      .where(eq(companyProfiles.isPublic, true))
      .orderBy(asc(companyProfiles.companyName))
  );
}

async function getFeaturedCompanyProfiles(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles)
    .where(and(eq(companyProfiles.isPublic, true), eq(companyProfiles.isFeatured, true)))
    .orderBy(asc(companyProfiles.companyName));
}

async function getPendingCompanyProfiles(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles).where(eq(companyProfiles.approvalStatus, "pending"));
}

async function approveCompanyProfile(id: number): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({ approvalStatus: "approved", updatedAt: new Date() } as any)
    .where(eq(companyProfiles.id, id))
    .returning();
  return updated;
}

async function rejectCompanyProfile(id: number): Promise<boolean> {
  const result = await db.delete(companyProfiles)
    .where(eq(companyProfiles.id, id))
    .returning();
  return result.length > 0;
}

async function getAllCompanyProfiles(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles).orderBy(desc(companyProfiles.createdAt));
}

async function requestVerification(profileId: number, userId: string, data: { taxNumber: string; mtoRegistrationNumber?: string; pandiClubName?: string }): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({
      taxNumber: data.taxNumber,
      mtoRegistrationNumber: data.mtoRegistrationNumber ?? null,
      pandiClubName: data.pandiClubName ?? null,
      verificationStatus: "pending",
      verificationRequestedAt: new Date(),
      verificationNote: null,
      updatedAt: new Date(),
    })
    .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.userId, userId)))
    .returning();
  return updated;
}

async function approveVerification(profileId: number, note?: string): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({
      verificationStatus: "verified",
      verificationApprovedAt: new Date(),
      verificationNote: note ?? null,
      updatedAt: new Date(),
    })
    .where(eq(companyProfiles.id, profileId))
    .returning();
  return updated;
}

async function rejectVerification(profileId: number, note: string): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({
      verificationStatus: "rejected",
      verificationNote: note,
      updatedAt: new Date(),
    })
    .where(eq(companyProfiles.id, profileId))
    .returning();
  return updated;
}

async function getPendingVerifications(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles)
    .where(eq(companyProfiles.verificationStatus, "pending"))
    .orderBy(asc(companyProfiles.verificationRequestedAt));
}

async function getEndorsements(companyProfileId: number): Promise<any[]> {
  const rows = await db
    .select({
      id: endorsements.id,
      fromUserId: endorsements.fromUserId,
      relationship: endorsements.relationship,
      message: endorsements.message,
      createdAt: endorsements.createdAt,
      fromFirstName: users.firstName,
      fromLastName: users.lastName,
      fromEmail: users.email,
      fromRole: users.userRole,
    })
    .from(endorsements)
    .leftJoin(users, eq(endorsements.fromUserId, users.id))
    .where(eq(endorsements.toCompanyProfileId, companyProfileId))
    .orderBy(desc(endorsements.createdAt));
  return rows;
}

async function createEndorsement(data: InsertEndorsement): Promise<Endorsement> {
  const [row] = await db.insert(endorsements).values(data).returning();
  return row;
}

async function deleteEndorsement(id: number, userId: string): Promise<boolean> {
  const result = await db.delete(endorsements)
    .where(and(eq(endorsements.id, id), eq(endorsements.fromUserId, userId)));
  return (result as any).rowCount > 0;
}

async function getUserEndorsementForProfile(fromUserId: string, toCompanyProfileId: number): Promise<Endorsement | undefined> {
  const [row] = await db.select().from(endorsements)
    .where(and(eq(endorsements.fromUserId, fromUserId), eq(endorsements.toCompanyProfileId, toCompanyProfileId)));
  return row;
}

async function getAgentsByPort(portId: number): Promise<any[]> {
  const rows = await db
    .select({
      userId: companyProfiles.userId,
      companyName: companyProfiles.companyName,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(companyProfiles)
    .leftJoin(users, eq(companyProfiles.userId, users.id))
    .where(eq(companyProfiles.portId, portId));
  return rows;
}

export const companyStorage = {
  getCompanyProfileByUser,
  getCompanyProfile,
  createCompanyProfile,
  updateCompanyProfile,
  getPublicCompanyProfiles,
  getFeaturedCompanyProfiles,
  getPendingCompanyProfiles,
  approveCompanyProfile,
  rejectCompanyProfile,
  getAllCompanyProfiles,
  requestVerification,
  approveVerification,
  rejectVerification,
  getPendingVerifications,
  getEndorsements,
  createEndorsement,
  deleteEndorsement,
  getUserEndorsementForProfile,
  getAgentsByPort,
};
