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
  vessels, ports, tariffCategories, tariffRates, proformas,
  forumCategories, forumTopics, forumReplies,
} from "@shared/schema";
import { users, companyProfiles } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, lte, gte, or, isNull, desc, asc, sql, count, countDistinct } from "drizzle-orm";

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
  deleteVessel(id: number, userId: string): Promise<boolean>;

  getPorts(): Promise<Port[]>;
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

  async deleteVessel(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId))).returning();
    return result.length > 0;
  }

  async getPorts(): Promise<Port[]> {
    return db.select().from(ports);
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
}

export const storage = new DatabaseStorage();
