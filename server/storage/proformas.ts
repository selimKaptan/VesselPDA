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

export const proformasMethods = {
async getProformasByUser(userId: string, organizationId?: number | null): Promise<Proforma[]> {
  if (organizationId) {
    return db.select().from(proformas)
      .where(eq(proformas.organizationId, organizationId))
      .orderBy(desc(proformas.createdAt));
  }
  return db.select().from(proformas)
    .where(eq(proformas.userId, userId))
    .orderBy(desc(proformas.createdAt));
},

async getAllProformas(): Promise<Proforma[]> {
  return db.select().from(proformas).orderBy(desc(proformas.createdAt));
},

async getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined> {
  const [proforma] = await db.select().from(proformas)
    .where(and(eq(proformas.id, id), eq(proformas.userId, userId)));
  
  if (!proforma) return undefined;
   const [vessel] = await db.select().from(vessels).where(eq(vessels.id, proforma.vesselId));
  const [port] = await db.select().from(ports).where(eq(ports.id, proforma.portId));
   return { ...proforma, vessel, port };
},

async getProformaById(id: number): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined> {
  const [proforma] = await db.select().from(proformas).where(eq(proformas.id, id));
  if (!proforma) return undefined;
  const [vessel] = await db.select().from(vessels).where(eq(vessels.id, proforma.vesselId));
  const [port] = await db.select().from(ports).where(eq(ports.id, proforma.portId));
  return { ...proforma, vessel, port };
},

async createProforma(proforma: InsertProforma): Promise<Proforma> {
  const [created] = await db.insert(proformas).values(proforma).returning();
  return created;
},

async deleteProforma(id: number, userId: string): Promise<boolean> {
  const result = await db.delete(proformas)
    .where(and(eq(proformas.id, id), eq(proformas.userId, userId)))
    .returning();
  return result.length > 0;
},

async duplicateProforma(id: number, userId: string): Promise<Proforma | undefined> {
  const [original] = await db.select().from(proformas).where(and(eq(proformas.id, id), eq(proformas.userId, userId)));
  if (!original) return undefined;
  const { id: _id, createdAt: _createdAt, referenceNumber, ...rest } = original;
  const ts = Date.now().toString().slice(-6);
  const newRef = `${referenceNumber}-COPY-${ts}`;
  const [created] = await db.insert(proformas).values({ ...rest, referenceNumber: newRef, status: "draft" }).returning();
  return created;
},
};
