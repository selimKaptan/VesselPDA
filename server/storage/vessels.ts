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

export const vesselsMethods = {
async getVesselsByUser(userId: string, organizationId?: number | null): Promise<Vessel[]> {
  if (organizationId) {
    return db.select().from(vessels).where(eq(vessels.organizationId, organizationId)).orderBy(desc(vessels.createdAt));
  }
  return db.select().from(vessels).where(eq(vessels.userId, userId));
},

async getVessel(id: number, userId: string, organizationId?: number | null): Promise<Vessel | undefined> {
  if (organizationId) {
    const [vessel] = await db.select().from(vessels).where(and(eq(vessels.id, id), eq(vessels.organizationId, organizationId)));
    return vessel;
  }
  const [vessel] = await db.select().from(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId)));
  return vessel;
},

async createVessel(vessel: InsertVessel): Promise<Vessel> {
  const [created] = await db.insert(vessels).values(vessel).returning();
  return created;
},

async updateVessel(id: number, userId: string, data: Partial<InsertVessel>): Promise<Vessel | undefined> {
  const [updated] = await db.update(vessels).set(data).where(and(eq(vessels.id, id), eq(vessels.userId, userId))).returning();
  return updated;
},

async updateVesselById(id: number, data: Partial<InsertVessel>): Promise<Vessel | undefined> {
  const [updated] = await db.update(vessels).set(data).where(eq(vessels.id, id)).returning();
  return updated;
},

async deleteVessel(id: number, userId: string): Promise<boolean> {
  const existing = await db.select().from(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId)));
  if (existing.length === 0) return false;
  await db.delete(proformas).where(eq(proformas.vesselId, id));
  await db.delete(vessels).where(eq(vessels.id, id));
  return true;
},

async deleteVesselById(id: number): Promise<boolean> {
  const existing = await db.select().from(vessels).where(eq(vessels.id, id));
  if (existing.length === 0) return false;
  await db.delete(proformas).where(eq(proformas.vesselId, id));
  await db.delete(vessels).where(eq(vessels.id, id));
  return true;
},

async getPorts(limit = 100, country?: string): Promise<Port[]> {
  if (country) {
    return db.select().from(ports)
      .where(eq(ports.country, country))
      .orderBy(ports.name);
  }
  return db.select().from(ports).orderBy(ports.name).limit(limit);
},

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
},

async getPortByCode(code: string): Promise<Port | undefined> {
  const [port] = await db.select().from(ports).where(ilike(ports.code, code));
  return port;
},

async getPort(id: number): Promise<Port | undefined> {
  const [port] = await db.select().from(ports).where(eq(ports.id, id));
  return port;
},

async createPort(port: InsertPort): Promise<Port> {
  const [created] = await db.insert(ports).values(port).returning();
  return created;
},

async updatePortCoords(id: number, lat: number, lng: number): Promise<void> {
  await db.update(ports).set({ latitude: lat, longitude: lng }).where(eq(ports.id, id));
},

async getTariffCategories(portId: number): Promise<TariffCategory[]> {
  return db.select().from(tariffCategories).where(eq(tariffCategories.portId, portId));
},

async createTariffCategory(cat: InsertTariffCategory): Promise<TariffCategory> {
  const [created] = await db.insert(tariffCategories).values(cat).returning();
  return created;
},

async getTariffRates(categoryId: number): Promise<TariffRate[]> {
  return db.select().from(tariffRates).where(eq(tariffRates.categoryId, categoryId));
},

async createTariffRate(rate: InsertTariffRate): Promise<TariffRate> {
  const [created] = await db.insert(tariffRates).values(rate).returning();
  return created;
},

async getTariffRateForGrt(categoryId: number, grt: number): Promise<TariffRate | undefined> {
  const rates = await db.select().from(tariffRates)
    .where(eq(tariffRates.categoryId, categoryId));
  
  const matching = rates.find(r => 
    grt >= r.minGrt && (r.maxGrt === null || grt <= r.maxGrt)
  );
  return matching || rates[rates.length - 1];
},

async getVesselWatchlist(userId: string): Promise<VesselWatchlistItem[]> {
  return db.select().from(vesselWatchlist)
    .where(eq(vesselWatchlist.userId, userId))
    .orderBy(desc(vesselWatchlist.addedAt));
},

async addToWatchlist(item: InsertVesselWatchlist): Promise<VesselWatchlistItem> {
  const [row] = await db.insert(vesselWatchlist).values(item).returning();
  return row;
},

async removeFromWatchlist(id: number, userId: string): Promise<boolean> {
  const result = await db.delete(vesselWatchlist)
    .where(and(eq(vesselWatchlist.id, id), eq(vesselWatchlist.userId, userId)));
  return (result.rowCount ?? 0) > 0;
},

async getVesselCertificates(vesselId: number): Promise<VesselCertificate[]> {
  return db.select().from(vesselCertificates)
    .where(eq(vesselCertificates.vesselId, vesselId))
    .orderBy(asc(vesselCertificates.createdAt));
},

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
},

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
},

async deleteVesselCertificate(id: number): Promise<boolean> {
  const result = await db.delete(vesselCertificates).where(eq(vesselCertificates.id, id));
  return (result as any).rowCount > 0;
},

async getExpiringCertificates(userId: string, daysAhead: number): Promise<VesselCertificate[]> {
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return db.select().from(vesselCertificates)
    .where(and(
      eq(vesselCertificates.userId, userId),
      lte(vesselCertificates.expiresAt, cutoff),
      gte(vesselCertificates.expiresAt, new Date()),
    ))
    .orderBy(asc(vesselCertificates.expiresAt));
},

async getVesselCrew(vesselId: number): Promise<VesselCrew[]> {
  return db.select().from(vesselCrew)
    .where(eq(vesselCrew.vesselId, vesselId))
    .orderBy(asc(vesselCrew.createdAt));
},

async createVesselCrewMember(data: InsertVesselCrew): Promise<VesselCrew> {
  const toDate = (v: any) => v ? new Date(v) : null;
  const [row] = await db.insert(vesselCrew).values({
    ...data,
    contractEndDate: toDate(data.contractEndDate) as any,
    passportExpiry: toDate(data.passportExpiry) as any,
    seamansBookExpiry: toDate(data.seamansBookExpiry) as any,
  }).returning();
  return row;
},

async updateVesselCrewMember(id: number, data: Partial<InsertVesselCrew>): Promise<VesselCrew | undefined> {
  const toDate = (v: any) => (v !== undefined ? (v ? new Date(v) : null) : undefined);
  const updateData: any = { ...data };
  if (data.contractEndDate !== undefined) updateData.contractEndDate = toDate(data.contractEndDate);
  if (data.passportExpiry !== undefined) updateData.passportExpiry = toDate(data.passportExpiry);
  if (data.seamansBookExpiry !== undefined) updateData.seamansBookExpiry = toDate(data.seamansBookExpiry);
  const [row] = await db.update(vesselCrew).set(updateData).where(eq(vesselCrew.id, id)).returning();
  return row;
},

async deleteVesselCrewMember(id: number): Promise<boolean> {
  const result = await db.delete(vesselCrew).where(eq(vesselCrew.id, id));
  return (result as any).rowCount > 0;
},
};
