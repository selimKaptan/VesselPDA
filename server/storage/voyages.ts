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

export const voyagesMethods = {
async createVoyage(data: InsertVoyage): Promise<Voyage> {
  const [row] = await db.insert(voyages).values(data).returning();
  return row;
},

async getVoyageByTenderId(tenderId: number): Promise<Voyage | undefined> {
  const [row] = await db.select().from(voyages).where(eq(voyages.tenderId, tenderId)).limit(1);
  return row;
},

async getVoyagesByUser(userId: string, role?: string, organizationId?: number | null): Promise<any[]> {
  let rows: any[];
  if (role === "admin") {
    rows = await db
      .select({ voyage: voyages, portName: ports.name, portLat: ports.latitude, portLng: ports.longitude })
      .from(voyages)
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .orderBy(desc(voyages.createdAt));
  } else if (organizationId) {
    rows = await db
      .select({ voyage: voyages, portName: ports.name, portLat: ports.latitude, portLng: ports.longitude })
      .from(voyages)
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(eq(voyages.organizationId, organizationId))
      .orderBy(desc(voyages.createdAt));
  } else if (role === "agent") {
    rows = await db
      .select({ voyage: voyages, portName: ports.name, portLat: ports.latitude, portLng: ports.longitude })
      .from(voyages)
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(eq(voyages.agentUserId, userId))
      .orderBy(desc(voyages.createdAt));
  } else {
    rows = await db
      .select({ voyage: voyages, portName: ports.name, portLat: ports.latitude, portLng: ports.longitude })
      .from(voyages)
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(eq(voyages.userId, userId))
      .orderBy(desc(voyages.createdAt));
  }
  return rows.map(r => ({ ...r.voyage, portName: r.portName, portLat: r.portLat, portLng: r.portLng }));
},

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
},

async updateVoyageStatus(id: number, status: string): Promise<Voyage | undefined> {
  const [row] = await db.update(voyages).set({ status }).where(eq(voyages.id, id)).returning();
  return row;
},

async updateVoyage(id: number, data: Partial<InsertVoyage>): Promise<Voyage | undefined> {
  const [row] = await db.update(voyages).set(data).where(eq(voyages.id, id)).returning();
  return row;
},

async createChecklistItem(data: InsertVoyageChecklist): Promise<VoyageChecklist> {
  const [row] = await db.insert(voyageChecklists).values(data).returning();
  return row;
},

async getChecklistByVoyage(voyageId: number): Promise<VoyageChecklist[]> {
  return db.select().from(voyageChecklists)
    .where(eq(voyageChecklists.voyageId, voyageId))
    .orderBy(asc(voyageChecklists.createdAt));
},

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
},

async deleteChecklistItem(id: number, voyageId: number): Promise<boolean> {
  const result = await db.delete(voyageChecklists)
    .where(and(eq(voyageChecklists.id, id), eq(voyageChecklists.voyageId, voyageId)));
  return (result.rowCount ?? 0) > 0;
},

async createVoyageDocument(data: InsertVoyageDocument): Promise<VoyageDocument> {
  const [doc] = await db.insert(voyageDocuments).values(data).returning();
  return doc;
},

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
},

async deleteVoyageDocument(id: number, voyageId: number): Promise<boolean> {
  const result = await db
    .delete(voyageDocuments)
    .where(and(eq(voyageDocuments.id, id), eq(voyageDocuments.voyageId, voyageId)))
    .returning();
  return result.length > 0;
},

async createVoyageReview(data: InsertVoyageReview): Promise<VoyageReview> {
  const [review] = await db.insert(voyageReviews).values(data).returning();
  return review;
},

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
},

async getMyVoyageReview(voyageId: number, reviewerUserId: string): Promise<VoyageReview | undefined> {
  const [review] = await db
    .select()
    .from(voyageReviews)
    .where(and(eq(voyageReviews.voyageId, voyageId), eq(voyageReviews.reviewerUserId, reviewerUserId)));
  return review;
},

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
},

async createVoyageChatMessage(data: InsertVoyageChatMessage): Promise<VoyageChatMessage> {
  const [msg] = await db.insert(voyageChatMessages).values(data).returning();
  return msg;
},

async createNomination(data: InsertDirectNomination): Promise<DirectNomination> {
  const [nom] = await db.insert(directNominations).values(data).returning();
  return nom;
},

async getNominationsByNominator(userId: string): Promise<any[]> {
  const rows = await db.select().from(directNominations)
    .where(eq(directNominations.nominatorUserId, userId))
    .orderBy(desc(directNominations.createdAt));
  return this._enrichNominations(rows);
},

async getNominationsByAgent(userId: string): Promise<any[]> {
  const rows = await db.select().from(directNominations)
    .where(eq(directNominations.agentUserId, userId))
    .orderBy(desc(directNominations.createdAt));
  return this._enrichNominations(rows);
},

async getNominationById(id: number): Promise<any | undefined> {
  const [row] = await db.select().from(directNominations).where(eq(directNominations.id, id));
  if (!row) return undefined;
  const enriched = await this._enrichNominations([row]);
  return enriched[0];
},

async updateNominationStatus(id: number, status: string): Promise<DirectNomination | undefined> {
  const [updated] = await db.update(directNominations)
    .set({ status, respondedAt: new Date() })
    .where(eq(directNominations.id, id))
    .returning();
  return updated;
},

async getPendingNominationCountForAgent(userId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(directNominations)
    .where(and(eq(directNominations.agentUserId, userId), eq(directNominations.status, "pending")));
  return Number(row?.cnt ?? 0);
},

async getPortCallAppointments(voyageId: number): Promise<PortCallAppointment[]> {
  return db.select().from(portCallAppointments)
    .where(eq(portCallAppointments.voyageId, voyageId))
    .orderBy(asc(portCallAppointments.scheduledAt));
},

async createPortCallAppointment(data: InsertPortCallAppointment): Promise<PortCallAppointment> {
  const [row] = await db.insert(portCallAppointments).values(data).returning();
  return row;
},

async updatePortCallAppointment(id: number, data: Partial<InsertPortCallAppointment>): Promise<PortCallAppointment | undefined> {
  const [row] = await db.update(portCallAppointments).set(data).where(eq(portCallAppointments.id, id)).returning();
  return row;
},

async deletePortCallAppointment(id: number): Promise<boolean> {
  const result = await db.delete(portCallAppointments).where(eq(portCallAppointments.id, id));
  return (result as any).rowCount > 0;
},
};
