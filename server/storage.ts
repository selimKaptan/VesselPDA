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
  type VesselQ88, type InsertVesselQ88,
  type VoyageCrewLogistic, type InsertVoyageCrewLogistic,
  voyageCrewLogistics,
  vessels, ports, tariffCategories, tariffRates, proformas, proformaApprovalLogs,
  forumCategories, forumTopics, forumReplies, forumLikes, forumDislikes,
  portTenders, tenderBids, agentReviews, vesselWatchlist,
  notifications, feedbacks,
  voyages, voyageChecklists, serviceRequests, serviceOffers,
  voyageDocuments, voyageReviews, conversations, messages,
  directNominations, voyageChatMessages, endorsements,
  vesselCertificates, portCallAppointments, fixtures, cargoPositions, bunkerPrices,
  documentTemplates, invoices, portAlerts, vesselCrew, vesselQ88, fdaAccounts,
} from "@shared/schema";
import { users, companyProfiles } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, lte, gte, or, isNull, desc, asc, sql, count, countDistinct, ilike, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { emitToUser } from "./socket";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateUserOnboarding(userId: string, data: { onboardingCompleted?: boolean; onboardingStep?: number }): Promise<User | undefined>;
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

  getPorts(limit?: number, country?: string): Promise<Port[]>;
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
  getProformasByVoyage(voyageId: number): Promise<Proforma[]>;
  getAllProformas(): Promise<Proforma[]>;
  getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined>;
  getProformaById(id: number): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined>;
  createProforma(proforma: InsertProforma): Promise<Proforma>;
  updateProforma(id: number, data: Partial<Proforma>): Promise<Proforma | undefined>;
  duplicateProforma(id: number, userId: string): Promise<Proforma | undefined>;
  deleteProforma(id: number, userId: string): Promise<boolean>;
  createProformaApprovalLog(data: { proformaId: number; userId: string; action: string; note?: string | null; previousStatus: string; newStatus: string }): Promise<any>;
  getProformaApprovalLogs(proformaId: number): Promise<any[]>;
  getProformasByApprovalStatus(approvalStatus: string): Promise<Proforma[]>;
  findProformaByToken(token: string): Promise<Proforma | undefined>;

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
  updateConversationExternalEmail(convId: number, email: string | null, name: string | null, forward: boolean): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;

  createNomination(data: InsertDirectNomination): Promise<DirectNomination>;
  getNominationsByNominator(userId: string): Promise<any[]>;
  getNominationsByAgent(userId: string): Promise<any[]>;
  getNominationById(id: number): Promise<any | undefined>;
  updateNominationStatus(id: number, status: string): Promise<DirectNomination | undefined>;
  getPendingNominationCountForAgent(userId: string): Promise<number>;

  requestVerification(profileId: number, userId: string, data: { taxNumber: string; mtoRegistrationNumber?: string; pandiClubName?: string }): Promise<CompanyProfile | undefined>;
  approveVerification(profileId: number, note?: string): Promise<CompanyProfile | undefined>;
  rejectVerification(profileId: number, note: string): Promise<CompanyProfile | undefined>;
  getPendingVerifications(): Promise<CompanyProfile[]>;

  getEndorsements(companyProfileId: number): Promise<any[]>;
  createEndorsement(data: InsertEndorsement): Promise<Endorsement>;
  deleteEndorsement(id: number, userId: string): Promise<boolean>;
  getUserEndorsementForProfile(fromUserId: string, toCompanyProfileId: number): Promise<Endorsement | undefined>;

  getVesselCertificates(vesselId: number): Promise<VesselCertificate[]>;
  createVesselCertificate(data: InsertVesselCertificate): Promise<VesselCertificate>;
  updateVesselCertificate(id: number, data: Partial<InsertVesselCertificate>): Promise<VesselCertificate | undefined>;
  deleteVesselCertificate(id: number): Promise<boolean>;
  getExpiringCertificates(userId: string, daysAhead: number): Promise<VesselCertificate[]>;

  getVesselCrew(vesselId: number): Promise<VesselCrew[]>;
  getCrewRoster(userId: string): Promise<(VesselCrew & { vesselName: string })[]>;
  createVesselCrewMember(data: InsertVesselCrew): Promise<VesselCrew>;
  updateVesselCrewMember(id: number, data: Partial<InsertVesselCrew>): Promise<VesselCrew | undefined>;
  deleteVesselCrewMember(id: number): Promise<boolean>;

  getPortCallAppointments(voyageId: number): Promise<PortCallAppointment[]>;
  createPortCallAppointment(data: InsertPortCallAppointment): Promise<PortCallAppointment>;
  updatePortCallAppointment(id: number, data: Partial<InsertPortCallAppointment>): Promise<PortCallAppointment | undefined>;
  deletePortCallAppointment(id: number): Promise<boolean>;

  getVoyageCrewLogistics(voyageId: number): Promise<VoyageCrewLogistic[]>;
  saveVoyageCrewLogistics(voyageId: number, crew: InsertVoyageCrewLogistic[]): Promise<VoyageCrewLogistic[]>;

  getFixtures(userId: string): Promise<Fixture[]>;
  getAllFixtures(): Promise<Fixture[]>;
  getFixture(id: number): Promise<Fixture | undefined>;
  createFixture(data: InsertFixture): Promise<Fixture>;
  updateFixture(id: number, data: Partial<InsertFixture & { status?: string; recapText?: string }>): Promise<Fixture | undefined>;
  deleteFixture(id: number): Promise<boolean>;

  getCargoPositions(): Promise<CargoPosition[]>;
  getMyCargoPositions(userId: string): Promise<CargoPosition[]>;
  createCargoPosition(data: InsertCargoPosition): Promise<CargoPosition>;
  updateCargoPosition(id: number, data: Partial<InsertCargoPosition & { status?: string }>): Promise<CargoPosition | undefined>;
  deleteCargoPosition(id: number): Promise<boolean>;
  getBunkerPrices(): Promise<BunkerPrice[]>;
  upsertBunkerPrice(data: InsertBunkerPrice): Promise<BunkerPrice>;
  deleteBunkerPrice(id: number): Promise<boolean>;

  getVesselQ88(vesselId: number): Promise<VesselQ88 | undefined>;
  createVesselQ88(data: InsertVesselQ88): Promise<VesselQ88>;
  updateVesselQ88(vesselId: number, data: Partial<InsertVesselQ88>): Promise<VesselQ88>;
  getPublicVesselQ88(vesselId: number): Promise<VesselQ88 | undefined>;
  duplicateVesselQ88(sourceVesselId: number, targetVesselId: number, userId: string): Promise<VesselQ88>;
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

  async getPorts(limit = 100, country?: string): Promise<Port[]> {
    if (country) {
      return db.select().from(ports)
        .where(eq(ports.country, country))
        .orderBy(ports.name);
    }
    return db.select().from(ports).orderBy(ports.name).limit(limit);
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
    const [created] = await db.insert(ports).values(port as any).returning();
    return created;
  }

  async updatePortCoords(id: number, lat: number, lng: number): Promise<void> {
    await db.update(ports).set({ latitude: lat, longitude: lng }).where(eq(ports.id, id));
  }

  async getTariffCategories(portId: number): Promise<TariffCategory[]> {
    return db.select().from(tariffCategories).where(eq(tariffCategories.portId, portId));
  }

  async createTariffCategory(cat: InsertTariffCategory): Promise<TariffCategory> {
    const [created] = await db.insert(tariffCategories).values(cat as any).returning();
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

  async getProformasByVoyage(voyageId: number): Promise<Proforma[]> {
    return db.select().from(proformas)
      .where(eq((proformas as any).voyageId, voyageId))
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

  async updateProforma(id: number, data: Partial<Proforma>): Promise<Proforma | undefined> {
    const [row] = await db.update(proformas).set(data as any).where(eq(proformas.id, id)).returning();
    return row;
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

  async createProformaApprovalLog(data: { proformaId: number; userId: string; action: string; note?: string | null; previousStatus: string; newStatus: string }): Promise<any> {
    const [row] = await db.insert(proformaApprovalLogs).values(data as any).returning();
    return row;
  }

  async getProformaApprovalLogs(proformaId: number): Promise<any[]> {
    return db.select().from(proformaApprovalLogs)
      .where(eq(proformaApprovalLogs.proformaId, proformaId))
      .orderBy(desc(proformaApprovalLogs.createdAt));
  }

  async getProformasByApprovalStatus(approvalStatus: string): Promise<Proforma[]> {
    return db.select().from(proformas)
      .where(eq(proformas.approvalStatus, approvalStatus))
      .orderBy(desc(proformas.createdAt));
  }

  async findProformaByToken(token: string): Promise<Proforma | undefined> {
    const [row] = await db.select().from(proformas).where(eq(proformas.approvalToken, token));
    return row;
  }

  async updateUserOnboarding(userId: string, data: { onboardingCompleted?: boolean; onboardingStep?: number }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
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
    try { emitToUser(data.userId, "new_notification", row); } catch {}
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
    const voyageRows = rows.map(r => ({ ...r.voyage, portName: r.portName, portLat: r.portLat, portLng: r.portLng }));

    // Enrich with proforma summary (count, total, latest status, latest id)
    const voyageIds = voyageRows.map((v: any) => v.id).filter(Boolean);
    if (voyageIds.length > 0) {
      const proformaRows = await db
        .select({
          voyageId: (proformas as any).voyageId,
          proformaCount: sql<number>`COUNT(*)::int`,
          proformaTotalUsd: sql<number>`COALESCE(SUM(${proformas.totalUsd}), 0)::float`,
          proformaLatestStatus: sql<string>`(array_agg(${proformas.status} ORDER BY ${proformas.id} DESC))[1]`,
          proformaLatestApprovalStatus: sql<string>`(array_agg(${proformas.approvalStatus} ORDER BY ${proformas.id} DESC))[1]`,
          proformaLatestId: sql<number>`MAX(${proformas.id})::int`,
        })
        .from(proformas)
        .where(inArray((proformas as any).voyageId, voyageIds))
        .groupBy((proformas as any).voyageId);

      const pMap = new Map(proformaRows.map((p: any) => [p.voyageId, p]));

      // Enrich with FDA summary
      const fdaRows = await db
        .select({
          voyageId: fdaAccounts.voyageId,
          fdaCount: sql<number>`COUNT(*)::int`,
          fdaTotalActualUsd: sql<number>`COALESCE(SUM(${fdaAccounts.totalActualUsd}), 0)::float`,
          fdaLatestStatus: sql<string>`(array_agg(${fdaAccounts.status} ORDER BY ${fdaAccounts.id} DESC))[1]`,
          fdaLatestId: sql<number>`MAX(${fdaAccounts.id})::int`,
        })
        .from(fdaAccounts)
        .where(inArray(fdaAccounts.voyageId, voyageIds))
        .groupBy(fdaAccounts.voyageId);
      const fMap = new Map(fdaRows.map((f: any) => [f.voyageId, f]));

      // Enrich with invoice summary
      const invoiceRows = await db
        .select({
          voyageId: invoices.voyageId,
          invoiceCount: sql<number>`COUNT(*)::int`,
          invoicePendingCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'pending')::int`,
          invoicePendingTotal: sql<number>`COALESCE(SUM(${invoices.amount}) FILTER (WHERE ${invoices.status} = 'pending'), 0)::float`,
        })
        .from(invoices)
        .where(inArray(invoices.voyageId, voyageIds))
        .groupBy(invoices.voyageId);
      const iMap = new Map(invoiceRows.map((i: any) => [i.voyageId, i]));

      return voyageRows.map((v: any) => {
        const ps = pMap.get(v.id);
        const fs = fMap.get(v.id);
        const is_ = iMap.get(v.id);
        return {
          ...v,
          proformaCount: ps?.proformaCount ?? 0,
          proformaTotalUsd: ps?.proformaTotalUsd ?? 0,
          proformaLatestStatus: ps?.proformaLatestStatus ?? null,
          proformaLatestApprovalStatus: ps?.proformaLatestApprovalStatus ?? null,
          proformaLatestId: ps?.proformaLatestId ?? null,
          fdaCount: fs?.fdaCount ?? 0,
          fdaTotalActualUsd: fs?.fdaTotalActualUsd ?? 0,
          fdaLatestStatus: fs?.fdaLatestStatus ?? null,
          fdaLatestId: fs?.fdaLatestId ?? null,
          invoiceCount: is_?.invoiceCount ?? 0,
          invoicePendingCount: is_?.invoicePendingCount ?? 0,
          invoicePendingTotal: is_?.invoicePendingTotal ?? 0,
        };
      });
    }
    return voyageRows.map((v: any) => ({
      ...v,
      proformaCount: 0,
      proformaTotalUsd: 0,
      proformaLatestStatus: null,
      proformaLatestApprovalStatus: null,
      proformaLatestId: null,
      fdaCount: 0,
      fdaTotalActualUsd: 0,
      fdaLatestStatus: null,
      fdaLatestId: null,
      invoiceCount: 0,
      invoicePendingCount: 0,
      invoicePendingTotal: 0,
    }));
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

  async updateVoyage(id: number, data: Partial<InsertVoyage>): Promise<Voyage | undefined> {
    const [row] = await db.update(voyages).set(data).where(eq(voyages.id, id)).returning();
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
        fileUrl: voyageDocuments.fileUrl,
        fileName: voyageDocuments.fileName,
        fileSize: voyageDocuments.fileSize,
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
    const convRows = await db.execute(sql`
      SELECT id, user1_id, user2_id, voyage_id, service_request_id, last_message_at, created_at,
             external_email, external_email_name, external_email_forward
      FROM conversations
      WHERE user1_id = ${userId} OR user2_id = ${userId}
      ORDER BY last_message_at DESC NULLS LAST
    `);
    const rows: any[] = convRows.rows ?? (convRows as any);

    const result = await Promise.all(rows.map(async (conv: any) => {
      const convId = conv.id;
      const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      const ouRows = await db.execute(sql`SELECT id, first_name, last_name, email FROM users WHERE id = ${otherId} LIMIT 1`);
      const ouArr: any[] = ouRows.rows ?? (ouRows as any);
      const otherUser = ouArr[0];
      const lastMsgRows = await db.execute(sql`
        SELECT content, created_at, sender_id, message_type, file_name
        FROM messages WHERE conversation_id = ${convId}
        ORDER BY created_at DESC LIMIT 1
      `);
      const lastMsgArr: any[] = lastMsgRows.rows ?? (lastMsgRows as any);
      const lastMsg = lastMsgArr[0];
      const unreadRows = await db.execute(sql`
        SELECT COUNT(*)::int as cnt FROM messages
        WHERE conversation_id = ${convId} AND is_read = false AND sender_id != ${userId}
      `);
      const unreadArr: any[] = unreadRows.rows ?? (unreadRows as any);
      const unreadCount = Number(unreadArr[0]?.cnt ?? 0);
      return {
        id: conv.id,
        user1Id: conv.user1_id,
        user2Id: conv.user2_id,
        voyageId: conv.voyage_id,
        serviceRequestId: conv.service_request_id,
        lastMessageAt: conv.last_message_at,
        createdAt: conv.created_at,
        externalEmail: conv.external_email,
        externalEmailName: conv.external_email_name,
        externalEmailForward: conv.external_email_forward,
        otherUserId: otherId,
        otherUserName: otherUser ? ([otherUser.first_name, otherUser.last_name].filter(Boolean).join(" ") || otherUser.email) : "Kullanıcı",
        lastMessage: lastMsg?.content ?? null,
        lastMessageType: lastMsg?.message_type ?? "text",
        lastMessageFileName: lastMsg?.file_name ?? null,
        lastMessageTime: lastMsg?.created_at ?? conv.created_at,
        unreadCount,
      };
    }));
    return result;
  }

  async getConversationById(id: number, userId: string): Promise<any | undefined> {
    const convRows = await db.execute(sql`
      SELECT id, user1_id, user2_id, voyage_id, service_request_id, last_message_at, created_at,
             external_email, external_email_name, external_email_forward
      FROM conversations
      WHERE id = ${id} AND (user1_id = ${userId} OR user2_id = ${userId})
      LIMIT 1
    `);
    const convArr: any[] = convRows.rows ?? (convRows as any);
    const conv = convArr[0];
    if (!conv) return undefined;
    const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
    const ouRows = await db.execute(sql`SELECT id, first_name, last_name, email FROM users WHERE id = ${otherId} LIMIT 1`);
    const ouArr: any[] = ouRows.rows ?? (ouRows as any);
    const ouRaw = ouArr[0];
    const otherUser = ouRaw ? {
      id: ouRaw.id,
      name: [ouRaw.first_name, ouRaw.last_name].filter(Boolean).join(" ") || ouRaw.email,
      email: ouRaw.email,
    } : undefined;
    const msgRows = await db.execute(sql`
      SELECT id, conversation_id, sender_id, content, is_read, created_at,
             message_type, file_url, file_name, file_size, read_at, mentions
      FROM messages WHERE conversation_id = ${id} ORDER BY created_at ASC
    `);
    const msgArr: any[] = msgRows.rows ?? (msgRows as any);
    const msgs = msgArr.map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      content: m.content,
      isRead: m.is_read,
      createdAt: m.created_at,
      messageType: m.message_type ?? "text",
      fileUrl: m.file_url,
      fileName: m.file_name,
      fileSize: m.file_size,
      readAt: m.read_at,
      mentions: m.mentions ? JSON.parse(m.mentions) : null,
    }));
    return {
      id: conv.id,
      user1Id: conv.user1_id,
      user2Id: conv.user2_id,
      voyageId: conv.voyage_id,
      serviceRequestId: conv.service_request_id,
      lastMessageAt: conv.last_message_at,
      createdAt: conv.created_at,
      externalEmail: conv.external_email,
      externalEmailName: conv.external_email_name,
      externalEmailForward: conv.external_email_forward,
      otherUser,
      messages: msgs,
    };
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, data.conversationId));
    return msg;
  }

  async markConversationRead(conversationId: number, userId: string): Promise<void> {
    await db.update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(messages.conversationId, conversationId),
        sql`${messages.senderId} != ${userId}`,
        sql`${messages.readAt} IS NULL`
      ));
  }

  async updateConversationExternalEmail(convId: number, email: string | null, name: string | null, forward: boolean): Promise<void> {
    await db.update(conversations)
      .set({ externalEmail: email, externalEmailName: name, externalEmailForward: forward })
      .where(eq(conversations.id, convId));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const rows = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.user1_id = ${userId} OR c.user2_id = ${userId})
        AND m.is_read = false
        AND m.sender_id != ${userId}
    `);
    const arr: any[] = rows.rows ?? (rows as any);
    return Number(arr[0]?.cnt ?? 0);
  }

  // ─── DIRECT NOMINATIONS ────────────────────────────────────────────────────

  async createNomination(data: InsertDirectNomination): Promise<DirectNomination> {
    const [nom] = await db.insert(directNominations).values(data).returning();
    return nom;
  }

  private async _enrichNominations(rows: any[]): Promise<any[]> {
    return Promise.all(rows.map(async (nom) => {
      const [nominator] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, nom.nominatorUserId));
      const [agent] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, nom.agentUserId));
      const [port] = await db.select({ name: ports.name, code: ports.code }).from(ports).where(eq(ports.id, nom.portId));
      let agentCompanyName: string | null = null;
      if (nom.agentCompanyId) {
        const [cp] = await db.select({ companyName: companyProfiles.companyName }).from(companyProfiles).where(eq(companyProfiles.id, nom.agentCompanyId));
        agentCompanyName = cp?.companyName ?? null;
      }
      return {
        ...nom,
        nominatorName: [nominator?.firstName, nominator?.lastName].filter(Boolean).join(" ") || nominator?.email || "User",
        agentName: [agent?.firstName, agent?.lastName].filter(Boolean).join(" ") || agent?.email || "Agent",
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
  }

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
  }

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
  }

  async getPendingVerifications(): Promise<CompanyProfile[]> {
    return db.select().from(companyProfiles)
      .where(eq(companyProfiles.verificationStatus, "pending"))
      .orderBy(asc(companyProfiles.verificationRequestedAt));
  }

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
  }

  async createEndorsement(data: InsertEndorsement): Promise<Endorsement> {
    const [row] = await db.insert(endorsements).values(data).returning();
    return row;
  }

  async deleteEndorsement(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(endorsements)
      .where(and(eq(endorsements.id, id), eq(endorsements.fromUserId, userId)));
    return (result as any).rowCount > 0;
  }

  async getUserEndorsementForProfile(fromUserId: string, toCompanyProfileId: number): Promise<Endorsement | undefined> {
    const [row] = await db.select().from(endorsements)
      .where(and(eq(endorsements.fromUserId, fromUserId), eq(endorsements.toCompanyProfileId, toCompanyProfileId)));
    return row;
  }

  // ─── VESSEL CERTIFICATES ────────────────────────────────────────────────────

  async getVesselCertificates(vesselId: number): Promise<VesselCertificate[]> {
    return db.select().from(vesselCertificates)
      .where(eq(vesselCertificates.vesselId, vesselId))
      .orderBy(asc(vesselCertificates.createdAt));
  }

  async createVesselCertificate(data: InsertVesselCertificate): Promise<VesselCertificate> {
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

  async updateVesselCertificate(id: number, data: Partial<InsertVesselCertificate>): Promise<VesselCertificate | undefined> {
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

  async deleteVesselCertificate(id: number): Promise<boolean> {
    const result = await db.delete(vesselCertificates).where(eq(vesselCertificates.id, id));
    return (result as any).rowCount > 0;
  }

  async getExpiringCertificates(userId: string, daysAhead: number): Promise<VesselCertificate[]> {
    const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return db.select().from(vesselCertificates)
      .where(and(
        eq(vesselCertificates.userId, userId),
        lte(vesselCertificates.expiresAt, cutoff),
        gte(vesselCertificates.expiresAt, new Date()),
      ))
      .orderBy(asc(vesselCertificates.expiresAt));
  }

  // ─── VESSEL CREW ────────────────────────────────────────────────────────────

  async getVesselCrew(vesselId: number): Promise<VesselCrew[]> {
    return db.select().from(vesselCrew)
      .where(eq(vesselCrew.vesselId, vesselId))
      .orderBy(asc(vesselCrew.createdAt));
  }

  async getCrewRoster(userId: string): Promise<(VesselCrew & { vesselName: string })[]> {
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
      contractEndDate: vesselCrew.contractEndDate,
      passportNumber: vesselCrew.passportNumber,
      passportExpiry: vesselCrew.passportExpiry,
      seamansBookNumber: vesselCrew.seamansBookNumber,
      seamansBookExpiry: vesselCrew.seamansBookExpiry,
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

  async createVesselCrewMember(data: InsertVesselCrew): Promise<VesselCrew> {
    const toDate = (v: any) => v ? new Date(v) : null;
    const [row] = await db.insert(vesselCrew).values({
      ...data,
      contractEndDate: toDate(data.contractEndDate) as any,
      passportExpiry: toDate(data.passportExpiry) as any,
      seamansBookExpiry: toDate(data.seamansBookExpiry) as any,
      medicalFitnessExpiry: toDate((data as any).medicalFitnessExpiry) as any,
    }).returning();
    return row;
  }

  async updateVesselCrewMember(id: number, data: Partial<InsertVesselCrew>): Promise<VesselCrew | undefined> {
    const toDate = (v: any) => (v !== undefined ? (v ? new Date(v) : null) : undefined);
    const updateData: any = { ...data };
    if (data.contractEndDate !== undefined) updateData.contractEndDate = toDate(data.contractEndDate);
    if (data.passportExpiry !== undefined) updateData.passportExpiry = toDate(data.passportExpiry);
    if (data.seamansBookExpiry !== undefined) updateData.seamansBookExpiry = toDate(data.seamansBookExpiry);
    if ((data as any).medicalFitnessExpiry !== undefined) updateData.medicalFitnessExpiry = toDate((data as any).medicalFitnessExpiry);
    const [row] = await db.update(vesselCrew).set(updateData).where(eq(vesselCrew.id, id)).returning();
    return row;
  }

  async deleteVesselCrewMember(id: number): Promise<boolean> {
    const result = await db.delete(vesselCrew).where(eq(vesselCrew.id, id));
    return (result as any).rowCount > 0;
  }

  // ─── PORT CALL APPOINTMENTS ─────────────────────────────────────────────────

  async getPortCallAppointments(voyageId: number): Promise<PortCallAppointment[]> {
    return db.select().from(portCallAppointments)
      .where(eq(portCallAppointments.voyageId, voyageId))
      .orderBy(asc(portCallAppointments.scheduledAt));
  }

  async createPortCallAppointment(data: InsertPortCallAppointment): Promise<PortCallAppointment> {
    const [row] = await db.insert(portCallAppointments).values(data).returning();
    return row;
  }

  async updatePortCallAppointment(id: number, data: Partial<InsertPortCallAppointment>): Promise<PortCallAppointment | undefined> {
    const [row] = await db.update(portCallAppointments).set(data).where(eq(portCallAppointments.id, id)).returning();
    return row;
  }

  async deletePortCallAppointment(id: number): Promise<boolean> {
    const result = await db.delete(portCallAppointments).where(eq(portCallAppointments.id, id));
    return (result as any).rowCount > 0;
  }

  // ─── VOYAGE CREW LOGISTICS ──────────────────────────────────────────────────

  async getVoyageCrewLogistics(voyageId: number): Promise<VoyageCrewLogistic[]> {
    return db.select().from(voyageCrewLogistics)
      .where(eq(voyageCrewLogistics.voyageId, voyageId))
      .orderBy(asc(voyageCrewLogistics.sortOrder));
  }

  async saveVoyageCrewLogistics(voyageId: number, crew: InsertVoyageCrewLogistic[]): Promise<VoyageCrewLogistic[]> {
    await db.delete(voyageCrewLogistics).where(eq(voyageCrewLogistics.voyageId, voyageId));
    if (crew.length === 0) return [];
    const rows = crew.map((c, i) => ({ ...c, voyageId, sortOrder: i }));
    return db.insert(voyageCrewLogistics).values(rows).returning();
  }

  // ─── FIXTURES ───────────────────────────────────────────────────────────────

  async getFixtures(userId: string): Promise<Fixture[]> {
    return db.select().from(fixtures)
      .where(eq(fixtures.userId, userId))
      .orderBy(desc(fixtures.createdAt));
  }

  async getAllFixtures(): Promise<Fixture[]> {
    return db.select().from(fixtures).orderBy(desc(fixtures.createdAt));
  }

  async getFixture(id: number): Promise<Fixture | undefined> {
    const [row] = await db.select().from(fixtures).where(eq(fixtures.id, id));
    return row;
  }

  async createFixture(data: InsertFixture): Promise<Fixture> {
    const [row] = await db.insert(fixtures).values({ ...data, status: "negotiating" }).returning();
    return row;
  }

  async updateFixture(id: number, data: Partial<InsertFixture & { status?: string; recapText?: string }>): Promise<Fixture | undefined> {
    const [row] = await db.update(fixtures).set(data).where(eq(fixtures.id, id)).returning();
    return row;
  }

  async deleteFixture(id: number): Promise<boolean> {
    const result = await db.delete(fixtures).where(eq(fixtures.id, id));
    return (result as any).rowCount > 0;
  }

  // ─── CARGO POSITIONS ────────────────────────────────────────────────────────

  async getCargoPositions(): Promise<CargoPosition[]> {
    return db.select().from(cargoPositions)
      .where(eq(cargoPositions.status, "active"))
      .orderBy(desc(cargoPositions.createdAt));
  }

  async getMyCargoPositions(userId: string): Promise<CargoPosition[]> {
    return db.select().from(cargoPositions)
      .where(eq(cargoPositions.userId, userId))
      .orderBy(desc(cargoPositions.createdAt));
  }

  async createCargoPosition(data: InsertCargoPosition): Promise<CargoPosition> {
    const [row] = await db.insert(cargoPositions).values({ ...data, status: "active" }).returning();
    return row;
  }

  async updateCargoPosition(id: number, data: Partial<InsertCargoPosition & { status?: string }>): Promise<CargoPosition | undefined> {
    const [row] = await db.update(cargoPositions).set(data).where(eq(cargoPositions.id, id)).returning();
    return row;
  }

  async deleteCargoPosition(id: number): Promise<boolean> {
    const result = await db.delete(cargoPositions).where(eq(cargoPositions.id, id));
    return (result as any).rowCount > 0;
  }

  // ─── BUNKER PRICES ──────────────────────────────────────────────────────────

  async getBunkerPrices(): Promise<BunkerPrice[]> {
    return db.select().from(bunkerPrices)
      .orderBy(asc(bunkerPrices.region), asc(bunkerPrices.portName));
  }

  async upsertBunkerPrice(data: InsertBunkerPrice): Promise<BunkerPrice> {
    const [row] = await db.insert(bunkerPrices).values({ ...data, updatedAt: new Date() }).returning();
    return row;
  }

  async deleteBunkerPrice(id: number): Promise<boolean> {
    const result = await db.delete(bunkerPrices).where(eq(bunkerPrices.id, id));
    return (result as any).rowCount > 0;
  }

  // ─── DOCUMENT TEMPLATES ─────────────────────────────────────────────────────

  async getDocumentTemplates(): Promise<DocumentTemplate[]> {
    return db.select().from(documentTemplates).orderBy(asc(documentTemplates.category), asc(documentTemplates.name));
  }

  async signVoyageDocument(docId: number, signatureText: string, signedAt: Date): Promise<void> {
    await db.update(voyageDocuments)
      .set({ signatureText, signedAt })
      .where(eq(voyageDocuments.id, docId));
  }

  async createNewDocumentVersion(parentDoc: any, newData: { name: string; fileBase64: string; notes?: string; uploadedByUserId: string }): Promise<any> {
    const nextVersion = (parentDoc.version || 1) + 1;
    const [row] = await db.insert(voyageDocuments).values({
      voyageId: parentDoc.voyageId,
      name: newData.name || parentDoc.name,
      docType: parentDoc.docType,
      fileBase64: newData.fileBase64,
      notes: newData.notes ?? parentDoc.notes,
      uploadedByUserId: newData.uploadedByUserId,
      version: nextVersion,
      parentDocId: parentDoc.id,
      templateId: parentDoc.templateId,
    }).returning();
    return row;
  }

  // ─── INVOICES ────────────────────────────────────────────────────────────────

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [row] = await db.insert(invoices).values({ ...data, status: "pending" }).returning();
    return row;
  }

  async getInvoicesByUser(userId: string): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT i.*, v.vessel_name, v.port_id, p2.name as port_name_ref
      FROM invoices i
      LEFT JOIN voyages v ON v.id = i.voyage_id
      LEFT JOIN ports p2 ON p2.id = v.port_id
      WHERE i.created_by_user_id = ${userId}
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

  async updateInvoiceStatus(id: number, status: string, paidAt?: Date): Promise<void> {
    await db.update(invoices)
      .set({ status, ...(paidAt ? { paidAt } : {}) })
      .where(eq(invoices.id, id));
  }

  async getAllPendingInvoicesOverdue(): Promise<Invoice[]> {
    return db.select().from(invoices)
      .where(and(
        eq(invoices.status, "pending"),
        sql`${invoices.dueDate} IS NOT NULL AND ${invoices.dueDate} < NOW()`
      ));
  }

  // ─── PORT ALERTS ─────────────────────────────────────────────────────────────

  async getPortAlerts(portId?: number, portName?: string): Promise<PortAlert[]> {
    const conditions: any[] = [eq(portAlerts.isActive, true)];
    if (portId) conditions.push(eq(portAlerts.portId, portId));
    const all = await db.select().from(portAlerts)
      .where(and(...conditions))
      .orderBy(desc(portAlerts.createdAt));
    if (portName && !portId) {
      const lower = portName.toLowerCase();
      return all.filter(a => !a.portName || a.portName.toLowerCase().includes(lower) || lower.includes(a.portName.toLowerCase()));
    }
    return all;
  }

  async getAllPortAlerts(): Promise<PortAlert[]> {
    return db.select().from(portAlerts).orderBy(desc(portAlerts.createdAt));
  }

  async createPortAlert(data: InsertPortAlert): Promise<PortAlert> {
    const [row] = await db.insert(portAlerts).values(data).returning();
    return row;
  }

  async updatePortAlert(id: number, data: Partial<InsertPortAlert>): Promise<void> {
    await db.update(portAlerts).set(data).where(eq(portAlerts.id, id));
  }

  async deletePortAlert(id: number): Promise<boolean> {
    const result = await db.delete(portAlerts).where(eq(portAlerts.id, id));
    return (result as any).rowCount > 0;
  }

  // ─── VESSEL Q88 ─────────────────────────────────────────────────────────────

  async getVesselQ88(vesselId: number): Promise<VesselQ88 | undefined> {
    const [row] = await db.select().from(vesselQ88).where(eq(vesselQ88.vesselId, vesselId));
    return row;
  }

  async createVesselQ88(data: InsertVesselQ88): Promise<VesselQ88> {
    const [row] = await db.insert(vesselQ88).values(data).returning();
    return row;
  }

  async updateVesselQ88(vesselId: number, data: Partial<InsertVesselQ88>): Promise<VesselQ88> {
    const existing = await this.getVesselQ88(vesselId);
    if (!existing) throw new Error("Q88 not found");
    const [row] = await db
      .update(vesselQ88)
      .set({ ...data, lastUpdated: new Date(), version: (existing.version ?? 1) + 1 })
      .where(eq(vesselQ88.vesselId, vesselId))
      .returning();
    return row;
  }

  async getPublicVesselQ88(vesselId: number): Promise<VesselQ88 | undefined> {
    const [row] = await db
      .select()
      .from(vesselQ88)
      .where(and(eq(vesselQ88.vesselId, vesselId), eq(vesselQ88.isPublic, true)));
    return row;
  }

  async duplicateVesselQ88(sourceVesselId: number, targetVesselId: number, userId: string): Promise<VesselQ88> {
    const source = await this.getVesselQ88(sourceVesselId);
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
}

export const storage = new DatabaseStorage();
