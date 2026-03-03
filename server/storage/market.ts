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

export const marketMethods = {
async getFixtures(userId: string, organizationId?: number | null): Promise<Fixture[]> {
  if (organizationId) {
    return db.select().from(fixtures)
      .where(eq(fixtures.organizationId, organizationId))
      .orderBy(desc(fixtures.createdAt));
  }
  return db.select().from(fixtures)
    .where(eq(fixtures.userId, userId))
    .orderBy(desc(fixtures.createdAt));
},

async getAllFixtures(): Promise<Fixture[]> {
  return db.select().from(fixtures).orderBy(desc(fixtures.createdAt));
},

async getFixture(id: number): Promise<Fixture | undefined> {
  const [row] = await db.select().from(fixtures).where(eq(fixtures.id, id));
  return row;
},

async createFixture(data: InsertFixture): Promise<Fixture> {
  const [row] = await db.insert(fixtures).values({ ...data, status: "negotiating" }).returning();
  return row;
},

async updateFixture(id: number, data: Partial<InsertFixture & { status?: string; recapText?: string }>): Promise<Fixture | undefined> {
  const [row] = await db.update(fixtures).set(data).where(eq(fixtures.id, id)).returning();
  return row;
},

async deleteFixture(id: number): Promise<boolean> {
  const result = await db.delete(fixtures).where(eq(fixtures.id, id));
  return (result as any).rowCount > 0;
},

async getCargoPositions(): Promise<CargoPosition[]> {
  return db.select().from(cargoPositions)
    .where(eq(cargoPositions.status, "active"))
    .orderBy(desc(cargoPositions.createdAt));
},

async getMyCargoPositions(userId: string): Promise<CargoPosition[]> {
  return db.select().from(cargoPositions)
    .where(eq(cargoPositions.userId, userId))
    .orderBy(desc(cargoPositions.createdAt));
},

async createCargoPosition(data: InsertCargoPosition): Promise<CargoPosition> {
  const [row] = await db.insert(cargoPositions).values({ ...data, status: "active" }).returning();
  return row;
},

async updateCargoPosition(id: number, data: Partial<InsertCargoPosition & { status?: string }>): Promise<CargoPosition | undefined> {
  const [row] = await db.update(cargoPositions).set(data).where(eq(cargoPositions.id, id)).returning();
  return row;
},

async deleteCargoPosition(id: number): Promise<boolean> {
  const result = await db.delete(cargoPositions).where(eq(cargoPositions.id, id));
  return (result as any).rowCount > 0;
},

async getBunkerPrices(): Promise<BunkerPrice[]> {
  return db.select().from(bunkerPrices)
    .orderBy(asc(bunkerPrices.region), asc(bunkerPrices.portName));
},

async upsertBunkerPrice(data: InsertBunkerPrice): Promise<BunkerPrice> {
  const [row] = await db.insert(bunkerPrices).values({ ...data, updatedAt: new Date() }).returning();
  return row;
},

async deleteBunkerPrice(id: number): Promise<boolean> {
  const result = await db.delete(bunkerPrices).where(eq(bunkerPrices.id, id));
  return (result as any).rowCount > 0;
},

async getDocumentTemplates(): Promise<DocumentTemplate[]> {
  return db.select().from(documentTemplates).orderBy(asc(documentTemplates.category), asc(documentTemplates.name));
},

async signVoyageDocument(docId: number, signatureText: string, signedAt: Date): Promise<void> {
  await db.update(voyageDocuments)
    .set({ signatureText, signedAt })
    .where(eq(voyageDocuments.id, docId));
},

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
},

async createInvoice(data: InsertInvoice): Promise<Invoice> {
  const [row] = await db.insert(invoices).values({ ...data, status: "pending" }).returning();
  return row;
},

async getInvoicesByUser(userId: string, organizationId?: number | null): Promise<any[]> {
  const rows = await db.execute(organizationId
    ? sql`SELECT i.*, v.vessel_name, v.port_id, p2.name as port_name_ref
          FROM invoices i
          LEFT JOIN voyages v ON v.id = i.voyage_id
          LEFT JOIN ports p2 ON p2.id = v.port_id
          WHERE i.organization_id = ${organizationId}
          ORDER BY i.created_at DESC`
    : sql`SELECT i.*, v.vessel_name, v.port_id, p2.name as port_name_ref
          FROM invoices i
          LEFT JOIN voyages v ON v.id = i.voyage_id
          LEFT JOIN ports p2 ON p2.id = v.port_id
          WHERE i.created_by_user_id = ${userId}
          ORDER BY i.created_at DESC`
  );
  const arr: any[] = rows.rows ?? (rows as any);
  return arr.map((r: any) => ({
    id: r.id,
    voyageId: r.voyage_id,
    proformaId: r.proforma_id,
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
    createdAt: r.created_at,
    vesselName: r.vessel_name,
    portName: r.port_name_ref,
  }));
},

async updateInvoiceStatus(id: number, status: string, paidAt?: Date): Promise<void> {
  await db.update(invoices)
    .set({ status, ...(paidAt ? { paidAt } : {}) })
    .where(eq(invoices.id, id));
},

async getAllPendingInvoicesOverdue(): Promise<Invoice[]> {
  return db.select().from(invoices)
    .where(and(
      eq(invoices.status, "pending"),
      sql`${invoices.dueDate} IS NOT NULL AND ${invoices.dueDate} < NOW()`
    ));
},

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
},

async getAllPortAlerts(): Promise<PortAlert[]> {
  return db.select().from(portAlerts).orderBy(desc(portAlerts.createdAt));
},

async createPortAlert(data: InsertPortAlert): Promise<PortAlert> {
  const [row] = await db.insert(portAlerts).values(data).returning();
  return row;
},

async updatePortAlert(id: number, data: Partial<InsertPortAlert>): Promise<void> {
  await db.update(portAlerts).set(data).where(eq(portAlerts.id, id));
},

async deletePortAlert(id: number): Promise<boolean> {
  const result = await db.delete(portAlerts).where(eq(portAlerts.id, id));
  return (result as any).rowCount > 0;
},
};
