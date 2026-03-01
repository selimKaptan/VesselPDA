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
  vessels, ports, tariffCategories, tariffRates, proformas,
  forumCategories, forumTopics, forumReplies, forumLikes, forumDislikes,
  portTenders, tenderBids, agentReviews, vesselWatchlist,
  notifications, feedbacks,
  voyages, voyageChecklists, serviceRequests, serviceOffers,
  voyageDocuments, voyageReviews, conversations, messages,
  directNominations, voyageChatMessages,
} from "@shared/schema";
import { users, companyProfiles } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, lte, gte, or, isNull, desc, asc, sql, count, countDistinct, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateActiveRole(userId: string, activeRole: string): Promise<User | undefined>;
  incrementProformaCount(userId: string): Promise<void>;
  updateSubscription(userId: string, plan: string, limit: number): Promise<User | undefined>;

  getVesselsByUser(userId: string): Promise<Vessel[]>;
  getVessel(id: number, userId: string): Promise<Vessel | undefined>;
  createVessel(vessel: InsertVessel): Promise<Vessel>;
  updateVessel(id: number, userId: string, data: Partial<InsertVessel>): Promise<Vessel | undefined>;
  updateVesselById(id: number, data: Partial<InsertVessel>): Promise<Vessel | undefined>;
  deleteVessel(id: number, userId: string): Promise<boolean>;
  deleteVesselById(id: number): Promise<boolean>;

  getPorts(limit?: number): Promise<Port[]>;
  searchPorts(query: string, countryCode?: string): Promise<Port[]>;
  getPortByCode(code: string): Promise<Port | undefined>;
  getPort(id: number): Promise<Port | undefined>;
  createPort(port: InsertPort): Promise<Port>;
  updatePortCoords(id: number, lat: number, lng: number): Promise<void>;

  getTariffCategories(portId: number): Promise<TariffCategory[]>;
  createTariffCategory(cat: InsertTariffCategory): Promise<TariffCategory>;
  getTariffRates(categoryId: number): Promise<TariffRate[]>;
  createTariffRate(rate: InsertTariffRate): Promise<TariffRate>;
  getTariffRateForGrt(categoryId: number, grt: number): Promise<TariffRate | undefined>;

  getProformasByUser(userId: string): Promise<Proforma[]>;
  getAllProformas(): Promise<Proforma[]>;
  getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined>;
  getProformaById(id: number): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined>;
  createProforma(proforma: InsertProforma): Promise<Proforma>;
  duplicateProforma(id: number, userId: string): Promise<Proforma | undefined>;
  deleteProforma(id: number, userId: string): Promise<boolean>;

  getAllVessels(): Promise<Vessel[]>;
  getAllUsers(): Promise<User[]>;
  getAllCompanyProfiles(): Promise<CompanyProfile[]>;
  updateUserSubscription(userId: string, plan: string): Promise<User | undefined>;
  suspendUser(userId: string, suspended: boolean): Promise<User | undefined>;

  getCompanyProfileByUser(userId: string): Promise<CompanyProfile | undefined>;
  getCompanyProfile(id: number): Promise<CompanyProfile | undefined>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(id: number, userId: string, data: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined>;
  getPublicCompanyProfiles(filters?: { companyType?: string; portId?: number }): Promise<CompanyProfile[]>;
  getFeaturedCompanyProfiles(): Promise<CompanyProfile[]>;
  getPendingCompanyProfiles(): Promise<CompanyProfile[]>;
  approveCompanyProfile(id: number): Promise<CompanyProfile | undefined>;
  rejectCompanyProfile(id: number): Promise<boolean>;

  getForumCategories(): Promise<ForumCategory[]>;
  getForumTopics(options?: { categoryId?: number; sort?: string; limit?: number; offset?: number }): Promise<any[]>;
  getForumTopic(id: number): Promise<any | undefined>;
  createForumTopic(topic: InsertForumTopic): Promise<ForumTopic>;
  deleteForumTopic(id: number): Promise<void>;
  getForumReplies(topicId: number): Promise<any[]>;
  createForumReply(reply: InsertForumReply): Promise<ForumReply>;
  getUserTopicLikes(userId: string): Promise<number[]>;
  getUserReplyLikes(userId: string): Promise<number[]>;
  toggleTopicLike(userId: string, topicId: number): Promise<{ liked: boolean; likeCount: number }>;
  toggleReplyLike(userId: string, replyId: number): Promise<{ liked: boolean; likeCount: number }>;
  getUserTopicDislikes(userId: string): Promise<number[]>;
  getUserReplyDislikes(userId: string): Promise<number[]>;
  toggleTopicDislike(userId: string, topicId: number): Promise<{ disliked: boolean; dislikeCount: number }>;
  toggleReplyDislike(userId: string, replyId: number): Promise<{ disliked: boolean; dislikeCount: number }>;
  getTopicParticipants(topicId: number, limit?: number): Promise<any[]>;

  getPortTenders(filters?: { userId?: string; portId?: number; status?: string }): Promise<any[]>;
  getPortTenderById(id: number): Promise<any | undefined>;
  createPortTender(data: InsertPortTender): Promise<PortTender>;
  updatePortTenderStatus(id: number, status: string, nominatedAgentId?: string): Promise<PortTender | undefined>;
  getTenderBids(tenderId: number): Promise<any[]>;
  getTenderBidsByAgent(agentUserId: string): Promise<any[]>;
  createTenderBid(data: InsertTenderBid): Promise<TenderBid>;
  updateTenderBidStatus(id: number, status: string): Promise<TenderBid | undefined>;
  getAgentsByPort(portId: number): Promise<CompanyProfile[]>;
  getTenderCountForAgent(agentUserId: string, portIds: number[]): Promise<number>;

  createReview(data: InsertAgentReview): Promise<AgentReview>;
  getReviewsByCompany(companyProfileId: number): Promise<any[]>;
  getMyReviewForTender(reviewerUserId: string, tenderId: number): Promise<AgentReview | undefined>;

  getVesselWatchlist(userId: string): Promise<VesselWatchlistItem[]>;
  addToWatchlist(item: InsertVesselWatchlist): Promise<VesselWatchlistItem>;
  removeFromWatchlist(id: number, userId: string): Promise<boolean>;

  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: number, userId: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getAllFeedbacks(): Promise<Feedback[]>;

  createVoyage(data: InsertVoyage): Promise<Voyage>;
  getVoyagesByUser(userId: string, role: string, agentUserId?: string): Promise<any[]>;
  getVoyageById(id: number): Promise<any | undefined>;
  getVoyageByTenderId(tenderId: number): Promise<Voyage | undefined>;
  updateVoyageStatus(id: number, status: string): Promise<Voyage | undefined>;
  createChecklistItem(data: InsertVoyageChecklist): Promise<VoyageChecklist>;
  getChecklistByVoyage(voyageId: number): Promise<VoyageChecklist[]>;
  toggleChecklistItem(id: number, voyageId: number): Promise<VoyageChecklist | undefined>;
  deleteChecklistItem(id: number, voyageId: number): Promise<boolean>;

  createServiceRequest(data: InsertServiceRequest): Promise<ServiceRequest>;
  getServiceRequestsByPort(portIds: number[]): Promise<any[]>;
  getServiceRequestsByUser(userId: string): Promise<any[]>;
  getServiceRequestById(id: number): Promise<any | undefined>;
  updateServiceRequestStatus(id: number, status: string): Promise<ServiceRequest | undefined>;
  createServiceOffer(data: InsertServiceOffer): Promise<ServiceOffer>;
  getOffersByRequest(serviceRequestId: number): Promise<any[]>;
  selectServiceOffer(offerId: number, requestId: number): Promise<ServiceOffer | undefined>;
  getProviderOffersByUser(providerUserId: string): Promise<any[]>;
  getProviderCompanyIdByUser(userId: string): Promise<number | null>;

  createVoyageDocument(data: InsertVoyageDocument): Promise<VoyageDocument>;
  getVoyageDocuments(voyageId: number): Promise<any[]>;
  deleteVoyageDocument(id: number, voyageId: number): Promise<boolean>;

  createVoyageReview(data: InsertVoyageReview): Promise<VoyageReview>;
  getVoyageReviews(voyageId: number): Promise<any[]>;
  getMyVoyageReview(voyageId: number, reviewerUserId: string): Promise<VoyageReview | undefined>;

  getVoyageChatMessages(voyageId: number): Promise<any[]>;
  createVoyageChatMessage(data: InsertVoyageChatMessage): Promise<VoyageChatMessage>;

  getOrCreateConversation(user1Id: string, user2Id: string, voyageId?: number, serviceRequestId?: number): Promise<Conversation>;
  getConversationsByUser(userId: string): Promise<any[]>;
  getConversationById(id: number, userId: string): Promise<any | undefined>;
  createMessage(data: InsertMessage): Promise<Message>;
  markConversationRead(conversationId: number, userId: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;

  createNomination(data: InsertDirectNomination): Promise<DirectNomination>;
  getNominationsByNominator(userId: string): Promise<any[]>;
  getNominationsByAgent(userId: string): Promise<any[]>;
  getNominationById(id: number): Promise<any | undefined>;
  updateNominationStatus(id: number, status: string): Promise<DirectNomination | undefined>;
  getPendingNominationCountForAgent(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async incrementProformaCount(userId: string): Promise<void> {
    await db.update(users)
      .set({ proformaCount: sql`${users.proformaCount} + 1` })
      .where(eq(users.id, userId));
  }

  async updateSubscription(userId: string, plan: string, limit: number): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ subscriptionPlan: plan, proformaLimit: limit, proformaCount: 0, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getVesselsByUser(userId: string): Promise<Vessel[]> {
    return db.select().from(vessels).where(eq(vessels.userId, userId));
  }

  async getVessel(id: number, userId: string): Promise<Vessel | undefined> {
    const [vessel] = await db.select().from(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId)));
    return vessel;
  }

  async createVessel(vessel: InsertVessel): Promise<Vessel> {
    const [created] = await db.insert(vessels).values(vessel).returning();
    return created;
  }

  async updateVessel(id: number, userId: string, data: Partial<InsertVessel>): Promise<Vessel | undefined> {
    const [updated] = await db.update(vessels).set(data).where(and(eq(vessels.id, id), eq(vessels.userId, userId))).returning();
    return updated;
  }

  async updateVesselById(id: number, data: Partial<InsertVessel>): Promise<Vessel | undefined> {
    const [updated] = await db.update(vessels).set(data).where(eq(vessels.id, id)).returning();
    return updated;
  }

  async deleteVessel(id: number, userId: string): Promise<boolean> {
    const existing = await db.select().from(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId)));
    if (existing.length === 0) return false;
    await db.delete(proformas).where(eq(proformas.vesselId, id));
    await db.delete(vessels).where(eq(vessels.id, id));
    return true;
  }

  async deleteVesselById(id: number): Promise<boolean> {
    const existing = await db.select().from(vessels).where(eq(vessels.id, id));
    if (existing.length === 0) return false;
    await db.delete(proformas).where(eq(proformas.vesselId, id));
    await db.delete(vessels).where(eq(vessels.id, id));
    return true;
  }

  async getPorts(limit = 100): Promise<Port[]> {
    return db.select().from(ports).limit(limit);
  }

  async searchPorts(query: string, countryCode?: string): Promise<Port[]> {
    const conditions = [
      or(
        ilike(ports.name, `%${query}%`),
        ilike(ports.code, `%${query}%`)
      ),
    ];
    if (countryCode) {
      conditions.push(eq(ports.country, countryCode.toUpperCase()));
    }
    return db.select().from(ports)
      .where(and(...conditions))
      .orderBy(ports.name)
      .limit(30);
  }

  async getPortByCode(code: string): Promise<Port | undefined> {
    const [port] = await db.select().from(ports).where(ilike(ports.code, code));
    return port;
  }

  async getPort(id: number): Promise<Port | undefined> {
    const [port] = await db.select().from(ports).where(eq(ports.id, id));
    return port;
  }

  async createPort(port: InsertPort): Promise<Port> {
    const [created] = await db.insert(ports).values(port).returning();
    return created;
  }

  async updatePortCoords(id: number, lat: number, lng: number): Promise<void> {
    await db.update(ports).set({ latitude: lat, longitude: lng }).where(eq(ports.id, id));
  }

  async getTariffCategories(portId: number): Promise<TariffCategory[]> {
    return db.select().from(tariffCategories).where(eq(tariffCategories.portId, portId));
  }

  async createTariffCategory(cat: InsertTariffCategory): Promise<TariffCategory> {
    const [created] = await db.insert(tariffCategories).values(cat).returning();
    return created;
  }

  async getTariffRates(categoryId: number): Promise<TariffRate[]> {
    return db.select().from(tariffRates).where(eq(tariffRates.categoryId, categoryId));
  }

  async createTariffRate(rate: InsertTariffRate): Promise<TariffRate> {
    const [created] = await db.insert(tariffRates).values(rate).returning();
    return created;
  }

  async getTariffRateForGrt(categoryId: number, grt: number): Promise<TariffRate | undefined> {
    const rates = await db.select().from(tariffRates)
      .where(eq(tariffRates.categoryId, categoryId));
    
    const matching = rates.find(r => 
      grt >= r.minGrt && (r.maxGrt === null || grt <= r.maxGrt)
    );
    return matching || rates[rates.length - 1];
  }

  async getProformasByUser(userId: string): Promise<Proforma[]> {
    return db.select().from(proformas)
      .where(eq(proformas.userId, userId))
      .orderBy(desc(proformas.createdAt));
  }

  async getAllProformas(): Promise<Proforma[]> {
    return db.select().from(proformas).orderBy(desc(proformas.createdAt));
  }

  async getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined> {
    const [proforma] = await db.select().from(proformas)
      .where(and(eq(proformas.id, id), eq(proformas.userId, userId)));
    
    if (!proforma) return undefined;

    const [vessel] = await db.select().from(vessels).where(eq(vessels.id, proforma.vesselId));
    const [port] = await db.select().from(ports).where(eq(ports.id, proforma.portId));

    return { ...proforma, vessel, port };
  }

  async getProformaById(id: number): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined> {
    const [proforma] = await db.select().from(proformas).where(eq(proformas.id, id));
    if (!proforma) return undefined;
    const [vessel] = await db.select().from(vessels).where(eq(vessels.id, proforma.vesselId));
    const [port] = await db.select().from(ports).where(eq(ports.id, proforma.portId));
    return { ...proforma, vessel, port };
  }

  async getAllVessels(): Promise<Vessel[]> {
    return db.select().from(vessels);
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserSubscription(userId: string, plan: string): Promise<User | undefined> {
    const limitMap: Record<string, number> = { free: 1, standard: 10, unlimited: 9999 };
    const limit = limitMap[plan] ?? 1;
    const [updated] = await db.update(users)
      .set({ subscriptionPlan: plan, proformaLimit: limit, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async suspendUser(userId: string, suspended: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ isSuspended: suspended, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getAllCompanyProfiles(): Promise<CompanyProfile[]> {
    return db.select().from(companyProfiles).orderBy(desc(companyProfiles.createdAt));
  }

  async createProforma(proforma: InsertProforma): Promise<Proforma> {
    const [created] = await db.insert(proformas).values(proforma).returning();
    return created;
  }

  async deleteProforma(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(proformas)
      .where(and(eq(proformas.id, id), eq(proformas.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async duplicateProforma(id: number, userId: string): Promise<Proforma | undefined> {
    const [original] = await db.select().from(proformas).where(and(eq(proformas.id, id), eq(proformas.userId, userId)));
    if (!original) return undefined;
    const { id: _id, createdAt: _createdAt, referenceNumber, ...rest } = original;
    const ts = Date.now().toString().slice(-6);
    const newRef = `${referenceNumber}-COPY-${ts}`;
    const [created] = await db.insert(proformas).values({ ...rest, referenceNumber: newRef, status: "draft" }).returning();
    return created;
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ userRole: role, roleConfirmed: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateActiveRole(userId: string, activeRole: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ activeRole, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getCompanyProfileByUser(userId: string): Promise<CompanyProfile | undefined> {
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
    return profile;
  }

  async getCompanyProfile(id: number): Promise<CompanyProfile | undefined> {
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id));
    return profile;
  }

  async createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile> {
    const [created] = await db.insert(companyProfiles).values(profile).returning();
    return created;
  }

  async updateCompanyProfile(id: number, userId: string, data: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined> {
    const [updated] = await db.update(companyProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(companyProfiles.id, id), eq(companyProfiles.userId, userId)))
      .returning();
    return updated;
  }

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
  }

  async getFeaturedCompanyProfiles(): Promise<CompanyProfile[]> {
    return db.select().from(companyProfiles)
      .where(and(
        eq(companyProfiles.isActive, true),
        eq(companyProfiles.isFeatured, true),
        eq(companyProfiles.isApproved, true),
      ))
      .orderBy(desc(companyProfiles.createdAt));
  }

  async getPendingCompanyProfiles(): Promise<CompanyProfile[]> {
    return db.select().from(companyProfiles)
      .where(eq(companyProfiles.isApproved, false))
      .orderBy(desc(companyProfiles.createdAt));
  }

  async approveCompanyProfile(id: number): Promise<CompanyProfile | undefined> {
    const [updated] = await db.update(companyProfiles)
      .set({ isApproved: true, updatedAt: new Date() })
      .where(eq(companyProfiles.id, id))
      .returning();
    return updated;
  }

  async rejectCompanyProfile(id: number): Promise<boolean> {
    const result = await db.delete(companyProfiles)
      .where(eq(companyProfiles.id, id));
    return true;
  }

  async getForumCategories(): Promise<ForumCategory[]> {
    return db.select().from(forumCategories).orderBy(asc(forumCategories.name));
  }

  async getForumTopics(options?: { categoryId?: number; sort?: string; limit?: number; offset?: number }): Promise<any[]> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    let query = db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        content: forumTopics.content,
        isAnonymous: forumTopics.isAnonymous,
        viewCount: forumTopics.viewCount,
        replyCount: forumTopics.replyCount,
        likeCount: forumTopics.likeCount,
        isPinned: forumTopics.isPinned,
        isLocked: forumTopics.isLocked,
        lastActivityAt: forumTopics.lastActivityAt,
        createdAt: forumTopics.createdAt,
        categoryId: forumTopics.categoryId,
        userId: forumTopics.userId,
        categoryName: forumCategories.name,
        categorySlug: forumCategories.slug,
        categoryColor: forumCategories.color,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorImage: users.profileImageUrl,
      })
      .from(forumTopics)
      .innerJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
      .innerJoin(users, eq(forumTopics.userId, users.id))
      .$dynamic();

    if (options?.categoryId) {
      query = query.where(eq(forumTopics.categoryId, options.categoryId));
    }

    if (options?.sort === "popular") {
      query = query.orderBy(desc(forumTopics.isPinned), desc(forumTopics.likeCount), desc(forumTopics.viewCount));
    } else {
      query = query.orderBy(desc(forumTopics.isPinned), desc(forumTopics.lastActivityAt));
    }

    return query.limit(limit).offset(offset);
  }

  async getForumTopic(id: number): Promise<any | undefined> {
    const [topic] = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        content: forumTopics.content,
        isAnonymous: forumTopics.isAnonymous,
        viewCount: forumTopics.viewCount,
        replyCount: forumTopics.replyCount,
        likeCount: forumTopics.likeCount,
        isPinned: forumTopics.isPinned,
        isLocked: forumTopics.isLocked,
        lastActivityAt: forumTopics.lastActivityAt,
        createdAt: forumTopics.createdAt,
        categoryId: forumTopics.categoryId,
        userId: forumTopics.userId,
        categoryName: forumCategories.name,
        categorySlug: forumCategories.slug,
        categoryColor: forumCategories.color,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorImage: users.profileImageUrl,
      })
      .from(forumTopics)
      .innerJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
      .innerJoin(users, eq(forumTopics.userId, users.id))
      .where(eq(forumTopics.id, id));

    if (!topic) return undefined;

    await db.update(forumTopics)
      .set({ viewCount: sql`${forumTopics.viewCount} + 1` })
      .where(eq(forumTopics.id, id));

    return topic;
  }

  async createForumTopic(topic: InsertForumTopic): Promise<ForumTopic> {
    const [created] = await db.insert(forumTopics).values(topic).returning();
    await db.update(forumCategories)
      .set({ topicCount: sql`${forumCategories.topicCount} + 1` })
      .where(eq(forumCategories.id, topic.categoryId));
    return created;
  }

  async deleteForumTopic(id: number): Promise<void> {
    const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, id));
    if (topic) {
      await db.delete(forumReplies).where(eq(forumReplies.topicId, id));
      await db.delete(forumTopics).where(eq(forumTopics.id, id));
      await db.update(forumCategories)
        .set({ topicCount: sql`GREATEST(${forumCategories.topicCount} - 1, 0)` })
        .where(eq(forumCategories.id, topic.categoryId));
    }
  }

  async getForumReplies(topicId: number): Promise<any[]> {
    return db
      .select({
        id: forumReplies.id,
        content: forumReplies.content,
        likeCount: forumReplies.likeCount,
        createdAt: forumReplies.createdAt,
        topicId: forumReplies.topicId,
        userId: forumReplies.userId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorImage: users.profileImageUrl,
      })
      .from(forumReplies)
      .innerJoin(users, eq(forumReplies.userId, users.id))
      .where(eq(forumReplies.topicId, topicId))
      .orderBy(asc(forumReplies.createdAt));
  }

  async createForumReply(reply: InsertForumReply): Promise<ForumReply> {
    const [created] = await db.insert(forumReplies).values(reply).returning();
    await db.update(forumTopics)
      .set({
        replyCount: sql`${forumTopics.replyCount} + 1`,
        lastActivityAt: new Date(),
      })
      .where(eq(forumTopics.id, reply.topicId));
    return created;
  }

  async getTopicParticipants(topicId: number, limit: number = 5): Promise<any[]> {
    const replies = await db
      .select({
        userId: forumReplies.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(forumReplies)
      .innerJoin(users, eq(forumReplies.userId, users.id))
      .where(eq(forumReplies.topicId, topicId))
      .orderBy(desc(forumReplies.createdAt));

    const seen = new Set<string>();
    const unique: any[] = [];
    for (const r of replies) {
      if (!seen.has(r.userId)) {
        seen.add(r.userId);
        unique.push(r);
        if (unique.length >= limit) break;
      }
    }
    return unique;
  }

  async getUserTopicLikes(userId: string): Promise<number[]> {
    const likes = await db.select({ topicId: forumLikes.topicId })
      .from(forumLikes)
      .where(and(eq(forumLikes.userId, userId), isNull(forumLikes.replyId)));
    return likes.map(l => l.topicId!).filter(Boolean);
  }

  async getUserReplyLikes(userId: string): Promise<number[]> {
    const likes = await db.select({ replyId: forumLikes.replyId })
      .from(forumLikes)
      .where(and(eq(forumLikes.userId, userId), isNull(forumLikes.topicId)));
    return likes.map(l => l.replyId!).filter(Boolean);
  }

  async toggleTopicLike(userId: string, topicId: number): Promise<{ liked: boolean; likeCount: number }> {
    const existing = await db.select()
      .from(forumLikes)
      .where(and(eq(forumLikes.userId, userId), eq(forumLikes.topicId, topicId), isNull(forumLikes.replyId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(forumLikes).where(eq(forumLikes.id, existing[0].id));
      const [updated] = await db.update(forumTopics)
        .set({ likeCount: sql`GREATEST(${forumTopics.likeCount} - 1, 0)` })
        .where(eq(forumTopics.id, topicId))
        .returning({ likeCount: forumTopics.likeCount });
      return { liked: false, likeCount: updated?.likeCount ?? 0 };
    } else {
      await db.insert(forumLikes).values({ userId, topicId });
      const [updated] = await db.update(forumTopics)
        .set({ likeCount: sql`${forumTopics.likeCount} + 1` })
        .where(eq(forumTopics.id, topicId))
        .returning({ likeCount: forumTopics.likeCount });
      return { liked: true, likeCount: updated?.likeCount ?? 1 };
    }
  }

  async toggleReplyLike(userId: string, replyId: number): Promise<{ liked: boolean; likeCount: number }> {
    const existing = await db.select()
      .from(forumLikes)
      .where(and(eq(forumLikes.userId, userId), eq(forumLikes.replyId, replyId), isNull(forumLikes.topicId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(forumLikes).where(eq(forumLikes.id, existing[0].id));
      const [updated] = await db.update(forumReplies)
        .set({ likeCount: sql`GREATEST(${forumReplies.likeCount} - 1, 0)` })
        .where(eq(forumReplies.id, replyId))
        .returning({ likeCount: forumReplies.likeCount });
      return { liked: false, likeCount: updated?.likeCount ?? 0 };
    } else {
      await db.insert(forumLikes).values({ userId, replyId });
      const [updated] = await db.update(forumReplies)
        .set({ likeCount: sql`${forumReplies.likeCount} + 1` })
        .where(eq(forumReplies.id, replyId))
        .returning({ likeCount: forumReplies.likeCount });
      return { liked: true, likeCount: updated?.likeCount ?? 1 };
    }
  }

  async getUserTopicDislikes(userId: string): Promise<number[]> {
    const rows = await db.select({ topicId: forumDislikes.topicId })
      .from(forumDislikes)
      .where(and(eq(forumDislikes.userId, userId), isNull(forumDislikes.replyId)));
    return rows.map(r => r.topicId!).filter(Boolean);
  }

  async getUserReplyDislikes(userId: string): Promise<number[]> {
    const rows = await db.select({ replyId: forumDislikes.replyId })
      .from(forumDislikes)
      .where(and(eq(forumDislikes.userId, userId), isNull(forumDislikes.topicId)));
    return rows.map(r => r.replyId!).filter(Boolean);
  }

  async toggleTopicDislike(userId: string, topicId: number): Promise<{ disliked: boolean; dislikeCount: number }> {
    const existing = await db.select()
      .from(forumDislikes)
      .where(and(eq(forumDislikes.userId, userId), eq(forumDislikes.topicId, topicId), isNull(forumDislikes.replyId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(forumDislikes).where(eq(forumDislikes.id, existing[0].id));
      const [updated] = await db.update(forumTopics)
        .set({ dislikeCount: sql`GREATEST(${forumTopics.dislikeCount} - 1, 0)` })
        .where(eq(forumTopics.id, topicId))
        .returning({ dislikeCount: forumTopics.dislikeCount });
      return { disliked: false, dislikeCount: updated?.dislikeCount ?? 0 };
    } else {
      await db.insert(forumDislikes).values({ userId, topicId });
      const [updated] = await db.update(forumTopics)
        .set({ dislikeCount: sql`${forumTopics.dislikeCount} + 1` })
        .where(eq(forumTopics.id, topicId))
        .returning({ dislikeCount: forumTopics.dislikeCount });
      return { disliked: true, dislikeCount: updated?.dislikeCount ?? 1 };
    }
  }

  async toggleReplyDislike(userId: string, replyId: number): Promise<{ disliked: boolean; dislikeCount: number }> {
    const existing = await db.select()
      .from(forumDislikes)
      .where(and(eq(forumDislikes.userId, userId), eq(forumDislikes.replyId, replyId), isNull(forumDislikes.topicId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(forumDislikes).where(eq(forumDislikes.id, existing[0].id));
      const [updated] = await db.update(forumReplies)
        .set({ dislikeCount: sql`GREATEST(${forumReplies.dislikeCount} - 1, 0)` })
        .where(eq(forumReplies.id, replyId))
        .returning({ dislikeCount: forumReplies.dislikeCount });
      return { disliked: false, dislikeCount: updated?.dislikeCount ?? 0 };
    } else {
      await db.insert(forumDislikes).values({ userId, replyId });
      const [updated] = await db.update(forumReplies)
        .set({ dislikeCount: sql`${forumReplies.dislikeCount} + 1` })
        .where(eq(forumReplies.id, replyId))
        .returning({ dislikeCount: forumReplies.dislikeCount });
      return { disliked: true, dislikeCount: updated?.dislikeCount ?? 1 };
    }
  }

  // ─── TENDER SYSTEM ─────────────────────────────────────────────────────────

  async getPortTenders(filters?: { userId?: string; portId?: number; status?: string }): Promise<any[]> {
    const rows = await db
      .select({
        id: portTenders.id,
        userId: portTenders.userId,
        portId: portTenders.portId,
        vesselName: portTenders.vesselName,
        description: portTenders.description,
        cargoInfo: portTenders.cargoInfo,
        grt: portTenders.grt,
        nrt: portTenders.nrt,
        flag: portTenders.flag,
        cargoType: portTenders.cargoType,
        cargoQuantity: portTenders.cargoQuantity,
        previousPort: portTenders.previousPort,
        q88Base64: portTenders.q88Base64,
        expiryHours: portTenders.expiryHours,
        status: portTenders.status,
        nominatedAgentId: portTenders.nominatedAgentId,
        nominatedAt: portTenders.nominatedAt,
        createdAt: portTenders.createdAt,
        portName: ports.name,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
      })
      .from(portTenders)
      .innerJoin(ports, eq(portTenders.portId, ports.id))
      .innerJoin(users, eq(portTenders.userId, users.id))
      .orderBy(desc(portTenders.createdAt));

    let results = rows;
    if (filters?.userId) results = results.filter(r => r.userId === filters.userId);
    if (filters?.portId) results = results.filter(r => r.portId === filters.portId);
    if (filters?.status) results = results.filter(r => r.status === filters.status);

    const withBidCounts = await Promise.all(results.map(async (t) => {
      const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(tenderBids).where(eq(tenderBids.tenderId, t.id));
      const [{ pendingCnt }] = await db.select({ pendingCnt: sql<number>`count(*)::int` }).from(tenderBids).where(and(eq(tenderBids.tenderId, t.id), eq(tenderBids.status, "pending")));
      return { ...t, bidCount: cnt, pendingBidCount: pendingCnt };
    }));
    return withBidCounts;
  }

  async getPortTenderById(id: number): Promise<any | undefined> {
    const [tender] = await db
      .select({
        id: portTenders.id,
        userId: portTenders.userId,
        portId: portTenders.portId,
        vesselName: portTenders.vesselName,
        description: portTenders.description,
        cargoInfo: portTenders.cargoInfo,
        grt: portTenders.grt,
        nrt: portTenders.nrt,
        flag: portTenders.flag,
        cargoType: portTenders.cargoType,
        cargoQuantity: portTenders.cargoQuantity,
        previousPort: portTenders.previousPort,
        q88Base64: portTenders.q88Base64,
        expiryHours: portTenders.expiryHours,
        status: portTenders.status,
        nominatedAgentId: portTenders.nominatedAgentId,
        nominatedAt: portTenders.nominatedAt,
        createdAt: portTenders.createdAt,
        portName: ports.name,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        ownerEmail: users.email,
      })
      .from(portTenders)
      .innerJoin(ports, eq(portTenders.portId, ports.id))
      .innerJoin(users, eq(portTenders.userId, users.id))
      .where(eq(portTenders.id, id));
    return tender;
  }

  async createPortTender(data: InsertPortTender): Promise<PortTender> {
    const [created] = await db.insert(portTenders).values(data).returning();
    return created;
  }

  async updatePortTenderStatus(id: number, status: string, nominatedAgentId?: string): Promise<PortTender | undefined> {
    const updateData: any = { status };
    if (nominatedAgentId) {
      updateData.nominatedAgentId = nominatedAgentId;
      updateData.nominatedAt = new Date();
    }
    const [updated] = await db.update(portTenders).set(updateData).where(eq(portTenders.id, id)).returning();
    return updated;
  }

  async getTenderBids(tenderId: number): Promise<any[]> {
    return db
      .select({
        id: tenderBids.id,
        tenderId: tenderBids.tenderId,
        agentUserId: tenderBids.agentUserId,
        agentCompanyId: tenderBids.agentCompanyId,
        proformaPdfBase64: tenderBids.proformaPdfBase64,
        notes: tenderBids.notes,
        totalAmount: tenderBids.totalAmount,
        currency: tenderBids.currency,
        status: tenderBids.status,
        createdAt: tenderBids.createdAt,
        agentFirstName: users.firstName,
        agentLastName: users.lastName,
        agentEmail: users.email,
        companyName: companyProfiles.companyName,
        companyLogoUrl: companyProfiles.logoUrl,
      })
      .from(tenderBids)
      .innerJoin(users, eq(tenderBids.agentUserId, users.id))
      .leftJoin(companyProfiles, eq(tenderBids.agentCompanyId, companyProfiles.id))
      .where(eq(tenderBids.tenderId, tenderId))
      .orderBy(asc(tenderBids.createdAt));
  }

  async getTenderBidsByAgent(agentUserId: string): Promise<any[]> {
    const shipownerUser = alias(users, "shipowner_user");
    const shipownerProfile = alias(companyProfiles, "shipowner_profile");
    return db
      .select({
        id: tenderBids.id,
        tenderId: tenderBids.tenderId,
        agentUserId: tenderBids.agentUserId,
        proformaPdfBase64: tenderBids.proformaPdfBase64,
        notes: tenderBids.notes,
        totalAmount: tenderBids.totalAmount,
        currency: tenderBids.currency,
        status: tenderBids.status,
        createdAt: tenderBids.createdAt,
        portName: ports.name,
        vesselName: portTenders.vesselName,
        tenderStatus: portTenders.status,
        tenderCreatedAt: portTenders.createdAt,
        expiryHours: portTenders.expiryHours,
        nominatedAt: portTenders.nominatedAt,
        shipownerFirstName: shipownerUser.firstName,
        shipownerLastName: shipownerUser.lastName,
        shipownerCompany: shipownerProfile.companyName,
      })
      .from(tenderBids)
      .innerJoin(portTenders, eq(tenderBids.tenderId, portTenders.id))
      .innerJoin(ports, eq(portTenders.portId, ports.id))
      .leftJoin(shipownerUser, eq(portTenders.userId, shipownerUser.id))
      .leftJoin(shipownerProfile, eq(portTenders.userId, shipownerProfile.userId))
      .where(eq(tenderBids.agentUserId, agentUserId))
      .orderBy(desc(tenderBids.createdAt));
  }

  async createTenderBid(data: InsertTenderBid): Promise<TenderBid> {
    const [created] = await db.insert(tenderBids).values(data).returning();
    return created;
  }

  async updateTenderBidStatus(id: number, status: string): Promise<TenderBid | undefined> {
    const [updated] = await db.update(tenderBids).set({ status }).where(eq(tenderBids.id, id)).returning();
    return updated;
  }

  async getAgentsByPort(portId: number): Promise<CompanyProfile[]> {
    const profiles = await db.select().from(companyProfiles)
      .where(and(eq(companyProfiles.companyType, "agent"), eq(companyProfiles.isActive, true)));
    return profiles.filter(p => (p.servedPorts as number[])?.includes(portId));
  }

  async getTenderCountForAgent(agentUserId: string, portIds: number[]): Promise<number> {
    if (portIds.length === 0) return 0;
    const rows = await db.select({ cnt: sql<number>`count(*)::int` })
      .from(portTenders)
      .where(and(eq(portTenders.status, "open")));
    const allOpen = await db.select().from(portTenders).where(eq(portTenders.status, "open"));
    const relevant = allOpen.filter(t => portIds.includes(t.portId));
    const bidTenderIds = await db.select({ tenderId: tenderBids.tenderId }).from(tenderBids).where(eq(tenderBids.agentUserId, agentUserId));
    const bidSet = new Set(bidTenderIds.map(b => b.tenderId));
    return relevant.filter(t => !bidSet.has(t.id)).length;
  }

  async createReview(data: InsertAgentReview): Promise<AgentReview> {
    const [review] = await db.insert(agentReviews).values(data).returning();
    return review;
  }

  async getReviewsByCompany(companyProfileId: number): Promise<any[]> {
    const rows = await db
      .select({
        id: agentReviews.id,
        companyProfileId: agentReviews.companyProfileId,
        tenderId: agentReviews.tenderId,
        rating: agentReviews.rating,
        comment: agentReviews.comment,
        vesselName: agentReviews.vesselName,
        portName: agentReviews.portName,
        createdAt: agentReviews.createdAt,
        reviewerFirstName: users.firstName,
        reviewerLastName: users.lastName,
        reviewerProfileImage: users.profileImageUrl,
      })
      .from(agentReviews)
      .leftJoin(users, eq(agentReviews.reviewerUserId, users.id))
      .where(eq(agentReviews.companyProfileId, companyProfileId))
      .orderBy(desc(agentReviews.createdAt));
    return rows;
  }

  async getMyReviewForTender(reviewerUserId: string, tenderId: number): Promise<AgentReview | undefined> {
    const [review] = await db.select().from(agentReviews)
      .where(and(eq(agentReviews.reviewerUserId, reviewerUserId), eq(agentReviews.tenderId, tenderId)));
    return review;
  }

  async getVesselWatchlist(userId: string): Promise<VesselWatchlistItem[]> {
    return db.select().from(vesselWatchlist)
      .where(eq(vesselWatchlist.userId, userId))
      .orderBy(desc(vesselWatchlist.addedAt));
  }

  async addToWatchlist(item: InsertVesselWatchlist): Promise<VesselWatchlistItem> {
    const [row] = await db.insert(vesselWatchlist).values(item).returning();
    return row;
  }

  async removeFromWatchlist(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(vesselWatchlist)
      .where(and(eq(vesselWatchlist.id, id), eq(vesselWatchlist.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [row] = await db.insert(notifications).values(data).returning();
    return row;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [row] = await db.select({ cnt: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return row?.cnt ?? 0;
  }

  async markNotificationRead(id: number, userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [row] = await db.insert(feedbacks).values(data).returning();
    return row;
  }

  async getAllFeedbacks(): Promise<Feedback[]> {
    return await db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt));
  }

  // ─── VOYAGES ────────────────────────────────────────────────────────────────

  async createVoyage(data: InsertVoyage): Promise<Voyage> {
    const [row] = await db.insert(voyages).values(data).returning();
    return row;
  }

  async getVoyageByTenderId(tenderId: number): Promise<Voyage | undefined> {
    const [row] = await db.select().from(voyages).where(eq(voyages.tenderId, tenderId)).limit(1);
    return row;
  }

  async getVoyagesByUser(userId: string, role: string): Promise<any[]> {
    let rows: any[];
    if (role === "admin") {
      rows = await db
        .select({
          voyage: voyages,
          portName: ports.name,
          portLat: ports.latitude,
          portLng: ports.longitude,
        })
        .from(voyages)
        .leftJoin(ports, eq(voyages.portId, ports.id))
        .orderBy(desc(voyages.createdAt));
    } else if (role === "agent") {
      rows = await db
        .select({
          voyage: voyages,
          portName: ports.name,
          portLat: ports.latitude,
          portLng: ports.longitude,
        })
        .from(voyages)
        .leftJoin(ports, eq(voyages.portId, ports.id))
        .where(eq(voyages.agentUserId, userId))
        .orderBy(desc(voyages.createdAt));
    } else {
      rows = await db
        .select({
          voyage: voyages,
          portName: ports.name,
          portLat: ports.latitude,
          portLng: ports.longitude,
        })
        .from(voyages)
        .leftJoin(ports, eq(voyages.portId, ports.id))
        .where(eq(voyages.userId, userId))
        .orderBy(desc(voyages.createdAt));
    }
    return rows.map(r => ({ ...r.voyage, portName: r.portName, portLat: r.portLat, portLng: r.portLng }));
  }

  async getVoyageById(id: number): Promise<any | undefined> {
    const [row] = await db
      .select({ voyage: voyages, portName: ports.name })
      .from(voyages)
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(eq(voyages.id, id));
    if (!row) return undefined;
    const checklists = await db.select().from(voyageChecklists)
      .where(eq(voyageChecklists.voyageId, id))
      .orderBy(asc(voyageChecklists.createdAt));
    const requests = await db
      .select({ req: serviceRequests, portName: ports.name })
      .from(serviceRequests)
      .leftJoin(ports, eq(serviceRequests.portId, ports.id))
      .where(eq(serviceRequests.voyageId, id))
      .orderBy(desc(serviceRequests.createdAt));
    return {
      ...row.voyage,
      portName: row.portName,
      checklists,
      serviceRequests: requests.map(r => ({ ...r.req, portName: r.portName })),
    };
  }

  async updateVoyageStatus(id: number, status: string): Promise<Voyage | undefined> {
    const [row] = await db.update(voyages).set({ status }).where(eq(voyages.id, id)).returning();
    return row;
  }

  async createChecklistItem(data: InsertVoyageChecklist): Promise<VoyageChecklist> {
    const [row] = await db.insert(voyageChecklists).values(data).returning();
    return row;
  }

  async getChecklistByVoyage(voyageId: number): Promise<VoyageChecklist[]> {
    return db.select().from(voyageChecklists)
      .where(eq(voyageChecklists.voyageId, voyageId))
      .orderBy(asc(voyageChecklists.createdAt));
  }

  async toggleChecklistItem(id: number, voyageId: number): Promise<VoyageChecklist | undefined> {
    const [existing] = await db.select().from(voyageChecklists)
      .where(and(eq(voyageChecklists.id, id), eq(voyageChecklists.voyageId, voyageId)));
    if (!existing) return undefined;
    const newCompleted = !existing.isCompleted;
    const [row] = await db.update(voyageChecklists)
      .set({ isCompleted: newCompleted, completedAt: newCompleted ? new Date() : null })
      .where(eq(voyageChecklists.id, id))
      .returning();
    return row;
  }

  async deleteChecklistItem(id: number, voyageId: number): Promise<boolean> {
    const result = await db.delete(voyageChecklists)
      .where(and(eq(voyageChecklists.id, id), eq(voyageChecklists.voyageId, voyageId)));
    return (result.rowCount ?? 0) > 0;
  }

  // ─── SERVICE REQUESTS ───────────────────────────────────────────────────────

  async createServiceRequest(data: InsertServiceRequest): Promise<ServiceRequest> {
    const [row] = await db.insert(serviceRequests).values(data).returning();
    return row;
  }

  async getServiceRequestsByPort(portIds: number[]): Promise<any[]> {
    if (portIds.length === 0) return [];
    const rows = await db
      .select({ req: serviceRequests, portName: ports.name })
      .from(serviceRequests)
      .leftJoin(ports, eq(serviceRequests.portId, ports.id))
      .where(and(
        or(...portIds.map(pid => eq(serviceRequests.portId, pid))),
        or(eq(serviceRequests.status, "open"), eq(serviceRequests.status, "offers_received"))
      ))
      .orderBy(desc(serviceRequests.createdAt));
    return rows.map(r => ({ ...r.req, portName: r.portName }));
  }

  async getServiceRequestsByUser(userId: string): Promise<any[]> {
    const rows = await db
      .select({ req: serviceRequests, portName: ports.name })
      .from(serviceRequests)
      .leftJoin(ports, eq(serviceRequests.portId, ports.id))
      .where(eq(serviceRequests.requesterId, userId))
      .orderBy(desc(serviceRequests.createdAt));
    return rows.map(r => ({ ...r.req, portName: r.portName }));
  }

  async getServiceRequestById(id: number): Promise<any | undefined> {
    const [row] = await db
      .select({ req: serviceRequests, portName: ports.name })
      .from(serviceRequests)
      .leftJoin(ports, eq(serviceRequests.portId, ports.id))
      .where(eq(serviceRequests.id, id));
    if (!row) return undefined;
    const offers = await db
      .select({
        offer: serviceOffers,
        providerFirstName: users.firstName,
        providerLastName: users.lastName,
      })
      .from(serviceOffers)
      .leftJoin(users, eq(serviceOffers.providerUserId, users.id))
      .where(eq(serviceOffers.serviceRequestId, id))
      .orderBy(asc(serviceOffers.createdAt));
    return {
      ...row.req,
      portName: row.portName,
      offers: offers.map(o => ({
        ...o.offer,
        providerName: `${o.providerFirstName || ""} ${o.providerLastName || ""}`.trim() || "Provider",
      })),
    };
  }

  async updateServiceRequestStatus(id: number, status: string): Promise<ServiceRequest | undefined> {
    const [row] = await db.update(serviceRequests).set({ status }).where(eq(serviceRequests.id, id)).returning();
    return row;
  }

  async createServiceOffer(data: InsertServiceOffer): Promise<ServiceOffer> {
    const [row] = await db.insert(serviceOffers).values(data).returning();
    await db.update(serviceRequests)
      .set({ status: "offers_received" })
      .where(and(eq(serviceRequests.id, data.serviceRequestId), eq(serviceRequests.status, "open")));
    return row;
  }

  async getOffersByRequest(serviceRequestId: number): Promise<any[]> {
    const rows = await db
      .select({
        offer: serviceOffers,
        providerFirstName: users.firstName,
        providerLastName: users.lastName,
      })
      .from(serviceOffers)
      .leftJoin(users, eq(serviceOffers.providerUserId, users.id))
      .where(eq(serviceOffers.serviceRequestId, serviceRequestId))
      .orderBy(asc(serviceOffers.createdAt));
    return rows.map(o => ({
      ...o.offer,
      providerName: `${o.providerFirstName || ""} ${o.providerLastName || ""}`.trim() || "Provider",
    }));
  }

  async selectServiceOffer(offerId: number, requestId: number): Promise<ServiceOffer | undefined> {
    await db.update(serviceOffers)
      .set({ status: "rejected" })
      .where(and(eq(serviceOffers.serviceRequestId, requestId), eq(serviceOffers.status, "pending")));
    const [row] = await db.update(serviceOffers)
      .set({ status: "selected" })
      .where(eq(serviceOffers.id, offerId))
      .returning();
    await db.update(serviceRequests)
      .set({ status: "selected" })
      .where(eq(serviceRequests.id, requestId));
    return row;
  }

  async getProviderOffersByUser(providerUserId: string): Promise<any[]> {
    const rows = await db
      .select({
        offer: serviceOffers,
        req: serviceRequests,
        portName: ports.name,
      })
      .from(serviceOffers)
      .leftJoin(serviceRequests, eq(serviceOffers.serviceRequestId, serviceRequests.id))
      .leftJoin(ports, eq(serviceRequests.portId, ports.id))
      .where(eq(serviceOffers.providerUserId, providerUserId))
      .orderBy(desc(serviceOffers.createdAt));
    return rows.map(r => ({
      ...r.offer,
      request: { ...r.req, portName: r.portName },
    }));
  }

  async getProviderCompanyIdByUser(userId: string): Promise<number | null> {
    const [row] = await db.select({ id: companyProfiles.id })
      .from(companyProfiles)
      .where(eq(companyProfiles.userId, userId));
    return row?.id ?? null;
  }

  // ─── VOYAGE DOCUMENTS ──────────────────────────────────────────────────────

  async createVoyageDocument(data: InsertVoyageDocument): Promise<VoyageDocument> {
    const [doc] = await db.insert(voyageDocuments).values(data).returning();
    return doc;
  }

  async getVoyageDocuments(voyageId: number): Promise<any[]> {
    const docs = await db
      .select({
        id: voyageDocuments.id,
        voyageId: voyageDocuments.voyageId,
        name: voyageDocuments.name,
        docType: voyageDocuments.docType,
        fileBase64: voyageDocuments.fileBase64,
        notes: voyageDocuments.notes,
        uploadedByUserId: voyageDocuments.uploadedByUserId,
        createdAt: voyageDocuments.createdAt,
        uploaderName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, ${users.lastName}, 'Kullanıcı')`,
      })
      .from(voyageDocuments)
      .leftJoin(users, eq(voyageDocuments.uploadedByUserId, users.id))
      .where(eq(voyageDocuments.voyageId, voyageId))
      .orderBy(desc(voyageDocuments.createdAt));
    return docs;
  }

  async deleteVoyageDocument(id: number, voyageId: number): Promise<boolean> {
    const result = await db
      .delete(voyageDocuments)
      .where(and(eq(voyageDocuments.id, id), eq(voyageDocuments.voyageId, voyageId)))
      .returning();
    return result.length > 0;
  }

  // ─── VOYAGE REVIEWS ────────────────────────────────────────────────────────

  async createVoyageReview(data: InsertVoyageReview): Promise<VoyageReview> {
    const [review] = await db.insert(voyageReviews).values(data).returning();
    return review;
  }

  async getVoyageReviews(voyageId: number): Promise<any[]> {
    const reviews = await db
      .select({
        id: voyageReviews.id,
        voyageId: voyageReviews.voyageId,
        reviewerUserId: voyageReviews.reviewerUserId,
        revieweeUserId: voyageReviews.revieweeUserId,
        rating: voyageReviews.rating,
        comment: voyageReviews.comment,
        createdAt: voyageReviews.createdAt,
        reviewerName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, ${users.lastName}, 'Kullanıcı')`,
      })
      .from(voyageReviews)
      .leftJoin(users, eq(voyageReviews.reviewerUserId, users.id))
      .where(eq(voyageReviews.voyageId, voyageId))
      .orderBy(desc(voyageReviews.createdAt));
    return reviews;
  }

  async getMyVoyageReview(voyageId: number, reviewerUserId: string): Promise<VoyageReview | undefined> {
    const [review] = await db
      .select()
      .from(voyageReviews)
      .where(and(eq(voyageReviews.voyageId, voyageId), eq(voyageReviews.reviewerUserId, reviewerUserId)));
    return review;
  }

  // ─── VOYAGE CHAT ────────────────────────────────────────────────────────────

  async getVoyageChatMessages(voyageId: number): Promise<any[]> {
    const msgs = await db
      .select({
        id: voyageChatMessages.id,
        voyageId: voyageChatMessages.voyageId,
        senderId: voyageChatMessages.senderId,
        content: voyageChatMessages.content,
        createdAt: voyageChatMessages.createdAt,
        senderName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, ${users.lastName}, 'Kullanıcı')`,
      })
      .from(voyageChatMessages)
      .leftJoin(users, eq(voyageChatMessages.senderId, users.id))
      .where(eq(voyageChatMessages.voyageId, voyageId))
      .orderBy(asc(voyageChatMessages.createdAt));
    return msgs;
  }

  async createVoyageChatMessage(data: InsertVoyageChatMessage): Promise<VoyageChatMessage> {
    const [msg] = await db.insert(voyageChatMessages).values(data).returning();
    return msg;
  }

  // ─── MESSAGING ─────────────────────────────────────────────────────────────

  async getOrCreateConversation(user1Id: string, user2Id: string, voyageId?: number, serviceRequestId?: number): Promise<Conversation> {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(
        or(
          and(eq(conversations.user1Id, user1Id), eq(conversations.user2Id, user2Id)),
          and(eq(conversations.user1Id, user2Id), eq(conversations.user2Id, user1Id))
        )
      )
      .limit(1);
    if (existing) return existing;

    const [created] = await db.insert(conversations).values({
      user1Id,
      user2Id,
      voyageId: voyageId ?? null,
      serviceRequestId: serviceRequestId ?? null,
    }).returning();
    return created;
  }

  async getConversationsByUser(userId: string): Promise<any[]> {
    const rows = await db
      .select({
        id: conversations.id,
        user1Id: conversations.user1Id,
        user2Id: conversations.user2Id,
        voyageId: conversations.voyageId,
        serviceRequestId: conversations.serviceRequestId,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId)))
      .orderBy(desc(conversations.lastMessageAt));

    const result = await Promise.all(rows.map(async (conv) => {
      const otherId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      const [otherUser] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, otherId));
      const [lastMsg] = await db.select({ content: messages.content, createdAt: messages.createdAt, senderId: messages.senderId })
        .from(messages).where(eq(messages.conversationId, conv.id)).orderBy(desc(messages.createdAt)).limit(1);
      const [unreadRow] = await db.select({ cnt: count() }).from(messages)
        .where(and(eq(messages.conversationId, conv.id), eq(messages.isRead, false), sql`${messages.senderId} != ${userId}`));
      return {
        ...conv,
        otherUserId: otherId,
        otherUserName: otherUser?.name ?? otherUser?.email ?? "Kullanıcı",
        lastMessage: lastMsg?.content ?? null,
        lastMessageTime: lastMsg?.createdAt ?? conv.createdAt,
        unreadCount: Number(unreadRow?.cnt ?? 0),
      };
    }));
    return result;
  }

  async getConversationById(id: number, userId: string): Promise<any | undefined> {
    const [conv] = await db.select().from(conversations).where(
      and(
        eq(conversations.id, id),
        or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId))
      )
    );
    if (!conv) return undefined;
    const otherId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
    const [otherUser] = await db.select({ name: users.name, email: users.email, id: users.id }).from(users).where(eq(users.id, otherId));
    const msgs = await db.select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      content: messages.content,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
    }).from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    return { ...conv, otherUser, messages: msgs };
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, data.conversationId));
    return msg;
  }

  async markConversationRead(conversationId: number, userId: string): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.conversationId, conversationId), sql`${messages.senderId} != ${userId}`));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const userConvs = await db.select({ id: conversations.id }).from(conversations)
      .where(or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId)));
    if (userConvs.length === 0) return 0;
    const convIds = userConvs.map(c => c.id);
    const [row] = await db.select({ cnt: count() }).from(messages)
      .where(and(
        sql`${messages.conversationId} = ANY(${sql`ARRAY[${sql.join(convIds.map(id => sql`${id}`), sql`, `)}]::integer[]`})`,
        eq(messages.isRead, false),
        sql`${messages.senderId} != ${userId}`
      ));
    return Number(row?.cnt ?? 0);
  }

  // ─── DIRECT NOMINATIONS ────────────────────────────────────────────────────

  async createNomination(data: InsertDirectNomination): Promise<DirectNomination> {
    const [nom] = await db.insert(directNominations).values(data).returning();
    return nom;
  }

  private async _enrichNominations(rows: any[]): Promise<any[]> {
    return Promise.all(rows.map(async (nom) => {
      const [nominator] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, nom.nominatorUserId));
      const [agent] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, nom.agentUserId));
      const [port] = await db.select({ name: ports.name, code: ports.code }).from(ports).where(eq(ports.id, nom.portId));
      let agentCompanyName: string | null = null;
      if (nom.agentCompanyId) {
        const [cp] = await db.select({ companyName: companyProfiles.companyName }).from(companyProfiles).where(eq(companyProfiles.id, nom.agentCompanyId));
        agentCompanyName = cp?.companyName ?? null;
      }
      return {
        ...nom,
        nominatorName: nominator?.name ?? nominator?.email ?? "Kullanıcı",
        agentName: agent?.name ?? agent?.email ?? "Acente",
        agentCompanyName,
        portName: port?.name ?? `Port #${nom.portId}`,
        portCode: port?.code ?? null,
      };
    }));
  }

  async getNominationsByNominator(userId: string): Promise<any[]> {
    const rows = await db.select().from(directNominations)
      .where(eq(directNominations.nominatorUserId, userId))
      .orderBy(desc(directNominations.createdAt));
    return this._enrichNominations(rows);
  }

  async getNominationsByAgent(userId: string): Promise<any[]> {
    const rows = await db.select().from(directNominations)
      .where(eq(directNominations.agentUserId, userId))
      .orderBy(desc(directNominations.createdAt));
    return this._enrichNominations(rows);
  }

  async getNominationById(id: number): Promise<any | undefined> {
    const [row] = await db.select().from(directNominations).where(eq(directNominations.id, id));
    if (!row) return undefined;
    const enriched = await this._enrichNominations([row]);
    return enriched[0];
  }

  async updateNominationStatus(id: number, status: string): Promise<DirectNomination | undefined> {
    const [updated] = await db.update(directNominations)
      .set({ status, respondedAt: new Date() })
      .where(eq(directNominations.id, id))
      .returning();
    return updated;
  }

  async getPendingNominationCountForAgent(userId: string): Promise<number> {
    const [row] = await db.select({ cnt: count() }).from(directNominations)
      .where(and(eq(directNominations.agentUserId, userId), eq(directNominations.status, "pending")));
    return Number(row?.cnt ?? 0);
  }
}

export const storage = new DatabaseStorage();
