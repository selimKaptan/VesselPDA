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

export const servicesMethods = {
async createServiceRequest(data: InsertServiceRequest): Promise<ServiceRequest> {
  const [row] = await db.insert(serviceRequests).values(data).returning();
  return row;
},

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
},

async getServiceRequestsByUser(userId: string): Promise<any[]> {
  const rows = await db
    .select({ req: serviceRequests, portName: ports.name })
    .from(serviceRequests)
    .leftJoin(ports, eq(serviceRequests.portId, ports.id))
    .where(eq(serviceRequests.requesterId, userId))
    .orderBy(desc(serviceRequests.createdAt));
  return rows.map(r => ({ ...r.req, portName: r.portName }));
},

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
},

async updateServiceRequestStatus(id: number, status: string): Promise<ServiceRequest | undefined> {
  const [row] = await db.update(serviceRequests).set({ status }).where(eq(serviceRequests.id, id)).returning();
  return row;
},

async createServiceOffer(data: InsertServiceOffer): Promise<ServiceOffer> {
  const [row] = await db.insert(serviceOffers).values(data).returning();
  await db.update(serviceRequests)
    .set({ status: "offers_received" })
    .where(and(eq(serviceRequests.id, data.serviceRequestId), eq(serviceRequests.status, "open")));
  return row;
},

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
},

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
},

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
},

async getProviderCompanyIdByUser(userId: string): Promise<number | null> {
  const [row] = await db.select({ id: companyProfiles.id })
    .from(companyProfiles)
    .where(eq(companyProfiles.userId, userId));
  return row?.id ?? null;
},
};
