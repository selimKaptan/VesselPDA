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
  vessels, ports, tariffCategories, tariffRates, proformas,
  forumCategories, forumTopics, forumReplies,
  portTenders, tenderBids, agentReviews, vesselWatchlist,
} from "@shared/schema";
import { users, companyProfiles } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, lte, gte, or, isNull, desc, asc, sql, count, countDistinct, ilike } from "drizzle-orm";

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

  getPorts(): Promise<Port[]>;
  searchPorts(query: string): Promise<Port[]>;
  getPortByCode(code: string): Promise<Port | undefined>;
  getPort(id: number): Promise<Port | undefined>;
  createPort(port: InsertPort): Promise<Port>;

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
  deleteProforma(id: number, userId: string): Promise<boolean>;

  getAllVessels(): Promise<Vessel[]>;
  getAllUsers(): Promise<User[]>;
  getAllCompanyProfiles(): Promise<CompanyProfile[]>;

  getCompanyProfileByUser(userId: string): Promise<CompanyProfile | undefined>;
  getCompanyProfile(id: number): Promise<CompanyProfile | undefined>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(id: number, userId: string, data: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined>;
  getPublicCompanyProfiles(filters?: { companyType?: string; portId?: number }): Promise<CompanyProfile[]>;
  getFeaturedCompanyProfiles(): Promise<CompanyProfile[]>;

  getForumCategories(): Promise<ForumCategory[]>;
  getForumTopics(options?: { categoryId?: number; sort?: string; limit?: number; offset?: number }): Promise<any[]>;
  getForumTopic(id: number): Promise<any | undefined>;
  createForumTopic(topic: InsertForumTopic): Promise<ForumTopic>;
  deleteForumTopic(id: number): Promise<void>;
  getForumReplies(topicId: number): Promise<any[]>;
  createForumReply(reply: InsertForumReply): Promise<ForumReply>;
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

  async getPorts(): Promise<Port[]> {
    return db.select().from(ports);
  }

  async searchPorts(query: string): Promise<Port[]> {
    return db.select().from(ports)
      .where(or(
        ilike(ports.name, `%${query}%`),
        ilike(ports.code, `%${query}%`)
      ))
      .limit(20);
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
      .where(eq(companyProfiles.isActive, true))
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
    const now = new Date();
    return db.select().from(companyProfiles)
      .where(and(
        eq(companyProfiles.isActive, true),
        eq(companyProfiles.isFeatured, true),
      ))
      .orderBy(desc(companyProfiles.createdAt));
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
      query = query.orderBy(desc(forumTopics.isPinned), desc(forumTopics.viewCount));
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
      return { ...t, bidCount: cnt };
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
      })
      .from(tenderBids)
      .innerJoin(portTenders, eq(tenderBids.tenderId, portTenders.id))
      .innerJoin(ports, eq(portTenders.portId, ports.id))
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
}

export const storage = new DatabaseStorage();
