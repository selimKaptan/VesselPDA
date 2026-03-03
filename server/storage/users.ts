import {
  type User, type UpsertUser,
  type Vessel, type InsertVessel,
  type Port, type InsertPort,
  type TariffCategory, type InsertTariffCategory,
  type TariffRate, type InsertTariffRate,
  type Proforma, type InsertProforma,
  type CompanyProfile, type InsertCompanyProfile,
  type ForumCategory, type InsertForumCategory,
  type ForumTopic, type InsertForumTopic,
  type ForumReply, type InsertForumReply,
  type PortTender, type InsertPortTender,
  type TenderBid, type InsertTenderBid,
  type AgentReview, type InsertAgentReview,
  type VesselWatchlistItem, type InsertVesselWatchlist,
  type Notification, type InsertNotification,
  type Feedback, type InsertFeedback,
  type Voyage, type InsertVoyage,
  type VoyageChecklist, type InsertVoyageChecklist,
  type ServiceRequest, type InsertServiceRequest,
  type ServiceOffer, type InsertServiceOffer,
  type VoyageDocument, type InsertVoyageDocument,
  type VoyageReview, type InsertVoyageReview,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type DirectNomination, type InsertDirectNomination,
  type VoyageChatMessage, type InsertVoyageChatMessage,
  type Endorsement, type InsertEndorsement,
  type VesselCertificate, type InsertVesselCertificate,
  type VesselCrew, type InsertVesselCrew,
  type PortCallAppointment, type InsertPortCallAppointment,
  type Fixture, type InsertFixture,
  type CargoPosition, type InsertCargoPosition,
  type BunkerPrice, type InsertBunkerPrice,
  type DocumentTemplate, type InsertDocumentTemplate,
  type Invoice, type InsertInvoice,
  type PortAlert, type InsertPortAlert,
  vessels, ports, tariffCategories, tariffRates, proformas,
  forumCategories, forumTopics, forumReplies, forumLikes, forumDislikes,
  portTenders, tenderBids, agentReviews, vesselWatchlist,
  notifications, feedbacks,
  voyages, voyageChecklists, serviceRequests, serviceOffers,
  voyageDocuments, voyageReviews, conversations, messages,
  directNominations, voyageChatMessages, endorsements,
  vesselCertificates, portCallAppointments, fixtures, cargoPositions, bunkerPrices,
  documentTemplates, invoices, portAlerts, vesselCrew,
} from "@shared/schema";
import { users, companyProfiles } from "@shared/models/auth";
import { db } from "../db";
import { eq, and, lte, gte, or, isNull, desc, asc, sql, count, countDistinct, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { emitToUser } from "../socket";

export const usersMethods = {
async getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
},

async incrementProformaCount(userId: string): Promise<void> {
  await db.update(users)
    .set({ proformaCount: sql`${users.proformaCount} + 1` })
    .where(eq(users.id, userId));
},

async updateSubscription(userId: string, plan: string, limit: number): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ subscriptionPlan: plan, proformaLimit: limit, proformaCount: 0, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
},

async getAllVessels(): Promise<Vessel[]> {
  return db.select().from(vessels);
},

async getAllUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(desc(users.createdAt));
},

async updateUserSubscription(userId: string, plan: string): Promise<User | undefined> {
  const limitMap: Record<string, number> = { free: 1, standard: 10, unlimited: 9999 };
  const limit = limitMap[plan] ?? 1;
  const [updated] = await db.update(users)
    .set({ subscriptionPlan: plan, proformaLimit: limit, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
},

async suspendUser(userId: string, suspended: boolean): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ isSuspended: suspended, updatedAt: new Date() } as any)
    .where(eq(users.id, userId))
    .returning();
  return updated;
},

async getAllCompanyProfiles(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles).orderBy(desc(companyProfiles.createdAt));
},

async updateUserRole(userId: string, role: string): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ userRole: role, roleConfirmed: true, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
},

async updateActiveRole(userId: string, activeRole: string): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ activeRole, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
},

async getCompanyProfileByUser(userId: string): Promise<CompanyProfile | undefined> {
  const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
  return profile;
},

async getCompanyProfile(id: number): Promise<CompanyProfile | undefined> {
  const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id));
  return profile;
},

async createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile> {
  const [created] = await db.insert(companyProfiles).values(profile).returning();
  return created;
},

async updateCompanyProfile(id: number, userId: string, data: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(companyProfiles.id, id), eq(companyProfiles.userId, userId)))
    .returning();
  return updated;
},

async getPublicCompanyProfiles(filters?: { companyType?: string; portId?: number }): Promise<CompanyProfile[]> {
  let results = await db.select().from(companyProfiles)
    .where(and(eq(companyProfiles.isActive, true), eq(companyProfiles.isApproved, true)))
    .orderBy(desc(companyProfiles.isFeatured), desc(companyProfiles.createdAt));
   if (filters?.companyType && filters.companyType !== "all") {
    results = results.filter(p => p.companyType === filters.companyType);
  }
  if (filters?.portId) {
    results = results.filter(p => (p.servedPorts as number[])?.includes(filters.portId!));
  }
  return results;
},

async getFeaturedCompanyProfiles(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles)
    .where(and(
      eq(companyProfiles.isActive, true),
      eq(companyProfiles.isFeatured, true),
      eq(companyProfiles.isApproved, true),
    ))
    .orderBy(desc(companyProfiles.createdAt));
},

async getPendingCompanyProfiles(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles)
    .where(eq(companyProfiles.isApproved, false))
    .orderBy(desc(companyProfiles.createdAt));
},

async approveCompanyProfile(id: number): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({ isApproved: true, updatedAt: new Date() })
    .where(eq(companyProfiles.id, id))
    .returning();
  return updated;
},

async rejectCompanyProfile(id: number): Promise<boolean> {
  const result = await db.delete(companyProfiles)
    .where(eq(companyProfiles.id, id));
  return true;
},

async createNotification(data: InsertNotification): Promise<Notification> {
  const [row] = await db.insert(notifications).values(data).returning();
  try { emitToUser(data.userId, "new_notification", row); } catch {}
  return row;
},

async getNotifications(userId: string): Promise<Notification[]> {
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
},

async getUnreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return row?.cnt ?? 0;
},

async markNotificationRead(id: number, userId: string): Promise<void> {
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
},

async markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
},

async createFeedback(data: InsertFeedback): Promise<Feedback> {
  const [row] = await db.insert(feedbacks).values(data).returning();
  return row;
},

async getAllFeedbacks(): Promise<Feedback[]> {
  return await db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt));
},

async requestVerification(profileId: number, userId: string, data: { taxNumber: string; mtoRegistrationNumber?: string; pandiClubName?: string }): Promise<CompanyProfile | undefined> {
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
},

async approveVerification(profileId: number, note?: string): Promise<CompanyProfile | undefined> {
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
},

async rejectVerification(profileId: number, note: string): Promise<CompanyProfile | undefined> {
  const [updated] = await db.update(companyProfiles)
    .set({
      verificationStatus: "rejected",
      verificationNote: note,
      updatedAt: new Date(),
    })
    .where(eq(companyProfiles.id, profileId))
    .returning();
  return updated;
},

async getPendingVerifications(): Promise<CompanyProfile[]> {
  return db.select().from(companyProfiles)
    .where(eq(companyProfiles.verificationStatus, "pending"))
    .orderBy(asc(companyProfiles.verificationRequestedAt));
},

async getEndorsements(companyProfileId: number): Promise<any[]> {
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
},

async createEndorsement(data: InsertEndorsement): Promise<Endorsement> {
  const [row] = await db.insert(endorsements).values(data).returning();
  return row;
},

async deleteEndorsement(id: number, userId: string): Promise<boolean> {
  const result = await db.delete(endorsements)
    .where(and(eq(endorsements.id, id), eq(endorsements.fromUserId, userId)));
  return (result as any).rowCount > 0;
},

async getUserEndorsementForProfile(fromUserId: string, toCompanyProfileId: number): Promise<Endorsement | undefined> {
  const [row] = await db.select().from(endorsements)
    .where(and(eq(endorsements.fromUserId, fromUserId), eq(endorsements.toCompanyProfileId, toCompanyProfileId)));
  return row;
},
};
