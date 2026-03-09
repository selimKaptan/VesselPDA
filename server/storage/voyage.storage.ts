import { db, eq, and, or, desc, asc, isNull, inArray, sql } from "./base";
import {
  voyages, ports, proformas, fdaAccounts, invoices,
  voyageChecklists, serviceRequests, serviceOffers,
  voyageDocuments, voyageReviews, voyageChatMessages,
  portCallAppointments, voyageCrewLogistics,
  documentTemplates, noonReports,
  bunkerRobs, vesselPositions, vessels,
  users,
  type Voyage, type InsertVoyage,
  type VoyageChecklist, type InsertVoyageChecklist,
  type ServiceRequest, type InsertServiceRequest,
  type ServiceOffer, type InsertServiceOffer,
  type VoyageDocument, type InsertVoyageDocument,
  type VoyageReview, type InsertVoyageReview,
  type VoyageChatMessage, type InsertVoyageChatMessage,
  type PortCallAppointment, type InsertPortCallAppointment,
  type VoyageCrewLogistic, type InsertVoyageCrewLogistic,
  type DocumentTemplate,
  type NoonReport, type InsertNoonReport,
} from "@shared/schema";

async function createVoyage(data: InsertVoyage): Promise<Voyage> {
  const [row] = await db.insert(voyages).values(data).returning();
  return row;
}

async function getVoyageByTenderId(tenderId: number): Promise<Voyage | undefined> {
  const [row] = await db.select().from(voyages).where(eq(voyages.tenderId, tenderId)).limit(1);
  return row;
}

async function deleteVoyage(id: number, userId: string): Promise<boolean> {
  const [updated] = await db.update(voyages)
    .set({ deletedAt: new Date() })
    .where(and(eq(voyages.id, id), eq(voyages.userId, userId), isNull(voyages.deletedAt)))
    .returning();
  return !!updated;
}

async function restoreVoyage(id: number): Promise<boolean> {
  const [updated] = await db.update(voyages)
    .set({ deletedAt: null })
    .where(eq(voyages.id, id))
    .returning();
  return !!updated;
}

async function getVoyagesByUser(userId: string, role: string, organizationId?: number): Promise<any[]> {
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
      .where(isNull(voyages.deletedAt))
      .orderBy(desc(voyages.createdAt));
  } else if (role === "agent") {
    const agentFilter = organizationId
      ? or(eq(voyages.agentUserId, userId), eq((voyages as any).organizationId, organizationId))
      : eq(voyages.agentUserId, userId);
    rows = await db
      .select({
        voyage: voyages,
        portName: ports.name,
        portLat: ports.latitude,
        portLng: ports.longitude,
      })
      .from(voyages)
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(and(agentFilter, isNull(voyages.deletedAt)))
      .orderBy(desc(voyages.createdAt));
  } else {
    const ownerFilter = organizationId
      ? or(eq(voyages.userId, userId), eq((voyages as any).organizationId, organizationId))
      : eq(voyages.userId, userId);
    rows = await db
      .select({
        voyage: voyages,
        portName: ports.name,
        portLat: ports.latitude,
        portLng: ports.longitude,
      })
      .from(voyages)
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(and(ownerFilter, isNull(voyages.deletedAt)))
      .orderBy(desc(voyages.createdAt));
  }
  const voyageRows = rows.map(r => ({ ...r.voyage, portName: r.portName, portLat: r.portLat, portLng: r.portLng }));
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

async function getVoyageById(id: number): Promise<any | undefined> {
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

async function updateVoyageStatus(id: number, status: string, completedAt?: Date): Promise<Voyage | undefined> {
  const [row] = await db.update(voyages)
    .set({ status, completedAt: completedAt || null })
    .where(eq(voyages.id, id))
    .returning();
  return row;
}

async function updateVoyage(id: number, data: Partial<InsertVoyage>): Promise<Voyage | undefined> {
  const [row] = await db.update(voyages).set(data).where(eq(voyages.id, id)).returning();
  return row;
}

async function createChecklistItem(data: InsertVoyageChecklist): Promise<VoyageChecklist> {
  const [row] = await db.insert(voyageChecklists).values(data).returning();
  return row;
}

async function getChecklistByVoyage(voyageId: number): Promise<VoyageChecklist[]> {
  return db.select().from(voyageChecklists)
    .where(eq(voyageChecklists.voyageId, voyageId))
    .orderBy(asc(voyageChecklists.createdAt));
}

async function toggleChecklistItem(id: number, voyageId: number): Promise<VoyageChecklist | undefined> {
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

async function deleteChecklistItem(id: number, voyageId: number): Promise<boolean> {
  const result = await db.delete(voyageChecklists)
    .where(and(eq(voyageChecklists.id, id), eq(voyageChecklists.voyageId, voyageId)));
  return (result.rowCount ?? 0) > 0;
}

async function updateChecklistItem(id: number, voyageId: number, data: Partial<InsertVoyageChecklist>): Promise<VoyageChecklist | undefined> {
  const [updated] = await db.update(voyageChecklists)
    .set(data)
    .where(and(eq(voyageChecklists.id, id), eq(voyageChecklists.voyageId, voyageId)))
    .returning();
  return updated;
}

async function createServiceRequest(data: InsertServiceRequest): Promise<ServiceRequest> {
  const [row] = await db.insert(serviceRequests).values(data).returning();
  return row;
}

async function getServiceRequestsByPort(portIds: number[]): Promise<any[]> {
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

async function getServiceRequestsByUser(userId: string): Promise<any[]> {
  const rows = await db
    .select({ req: serviceRequests, portName: ports.name })
    .from(serviceRequests)
    .leftJoin(ports, eq(serviceRequests.portId, ports.id))
    .where(eq(serviceRequests.requesterId, userId))
    .orderBy(desc(serviceRequests.createdAt));
  return rows.map(r => ({ ...r.req, portName: r.portName }));
}

async function getServiceRequestById(id: number): Promise<any | undefined> {
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

async function updateServiceRequestStatus(id: number, status: string): Promise<ServiceRequest | undefined> {
  const [row] = await db.update(serviceRequests).set({ status }).where(eq(serviceRequests.id, id)).returning();
  return row;
}

async function createServiceOffer(data: InsertServiceOffer): Promise<ServiceOffer> {
  const [row] = await db.insert(serviceOffers).values(data).returning();
  await db.update(serviceRequests)
    .set({ status: "offers_received" })
    .where(and(eq(serviceRequests.id, data.serviceRequestId), eq(serviceRequests.status, "open")));
  return row;
}

async function getOffersByRequest(serviceRequestId: number): Promise<any[]> {
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

async function selectServiceOffer(offerId: number, requestId: number): Promise<ServiceOffer | undefined> {
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

async function getProviderOffersByUser(providerUserId: string): Promise<any[]> {
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

async function getProviderCompanyIdByUser(userId: string): Promise<number | null> {
  const { companyProfiles } = await import("@shared/schema");
  const [row] = await db.select({ id: companyProfiles.id })
    .from(companyProfiles)
    .where(eq(companyProfiles.userId, userId));
  return row?.id ?? null;
}

async function createVoyageDocument(data: InsertVoyageDocument): Promise<VoyageDocument> {
  const [doc] = await db.insert(voyageDocuments).values(data).returning();
  return doc;
}

async function getVoyageDocuments(voyageId: number): Promise<any[]> {
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

async function deleteVoyageDocument(id: number, voyageId: number): Promise<boolean> {
  const result = await db
    .delete(voyageDocuments)
    .where(and(eq(voyageDocuments.id, id), eq(voyageDocuments.voyageId, voyageId)))
    .returning();
  return result.length > 0;
}

async function signVoyageDocument(docId: number, signatureText: string, signedAt: Date): Promise<void> {
  await db.update(voyageDocuments)
    .set({ signatureText, signedAt })
    .where(eq(voyageDocuments.id, docId));
}

async function createNewDocumentVersion(parentDoc: any, newData: { name: string; fileBase64: string; notes?: string; uploadedByUserId: string }): Promise<any> {
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

async function createVoyageReview(data: InsertVoyageReview): Promise<VoyageReview> {
  const [review] = await db.insert(voyageReviews).values(data).returning();
  return review;
}

async function getVoyageReviews(voyageId: number): Promise<any[]> {
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

async function getMyVoyageReview(voyageId: number, reviewerUserId: string): Promise<VoyageReview | undefined> {
  const [review] = await db
    .select()
    .from(voyageReviews)
    .where(and(eq(voyageReviews.voyageId, voyageId), eq(voyageReviews.reviewerUserId, reviewerUserId)));
  return review;
}

async function getVoyageChatMessages(voyageId: number): Promise<any[]> {
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

async function createVoyageChatMessage(data: InsertVoyageChatMessage): Promise<VoyageChatMessage> {
  const [msg] = await db.insert(voyageChatMessages).values(data).returning();
  return msg;
}

async function getPortCallAppointments(voyageId: number): Promise<PortCallAppointment[]> {
  return db.select().from(portCallAppointments)
    .where(eq(portCallAppointments.voyageId, voyageId))
    .orderBy(asc(portCallAppointments.scheduledAt));
}

async function createPortCallAppointment(data: InsertPortCallAppointment): Promise<PortCallAppointment> {
  const [row] = await db.insert(portCallAppointments).values(data).returning();
  return row;
}

async function updatePortCallAppointment(id: number, data: Partial<InsertPortCallAppointment>): Promise<PortCallAppointment | undefined> {
  const [row] = await db.update(portCallAppointments).set(data).where(eq(portCallAppointments.id, id)).returning();
  return row;
}

async function deletePortCallAppointment(id: number): Promise<boolean> {
  const result = await db.delete(portCallAppointments).where(eq(portCallAppointments.id, id));
  return (result as any).rowCount > 0;
}

async function getVoyageCrewLogistics(voyageId: number): Promise<VoyageCrewLogistic[]> {
  return db.select().from(voyageCrewLogistics)
    .where(eq(voyageCrewLogistics.voyageId, voyageId))
    .orderBy(asc(voyageCrewLogistics.sortOrder));
}

async function saveVoyageCrewLogistics(voyageId: number, crew: InsertVoyageCrewLogistic[]): Promise<VoyageCrewLogistic[]> {
  await db.delete(voyageCrewLogistics).where(eq(voyageCrewLogistics.voyageId, voyageId));
  if (crew.length === 0) return [];
  const rows = crew.map((c, i) => ({ ...c, voyageId, sortOrder: i }));
  return db.insert(voyageCrewLogistics).values(rows).returning();
}

async function getDocumentTemplates(): Promise<DocumentTemplate[]> {
  return db.select().from(documentTemplates).orderBy(asc(documentTemplates.category), asc(documentTemplates.name));
}

async function getNoonReports(vesselId: number, options?: { voyageId?: number; from?: Date; to?: Date }): Promise<NoonReport[]> {
  const conditions = [eq(noonReports.vesselId, vesselId)];
  if (options?.voyageId) conditions.push(eq(noonReports.voyageId, options.voyageId));
  if (options?.from) conditions.push(eq(noonReports.reportDate, options.from));
  if (options?.to) conditions.push(eq(noonReports.reportDate, options.to));
  return db.select().from(noonReports)
    .where(and(...conditions))
    .orderBy(desc(noonReports.reportDate));
}

async function createNoonReport(data: InsertNoonReport): Promise<NoonReport> {
  // Aktif voyage yoksa otomatik bağla
  if (!data.voyageId && data.vesselId) {
    const [activeVoyage] = await db.select().from(voyages)
      .where(and(
        eq(voyages.vesselId, data.vesselId),
        or(eq(voyages.status, "in_progress"), eq(voyages.status, "active"))
      ))
      .orderBy(desc(voyages.createdAt))
      .limit(1);
    if (activeVoyage) {
      data = { ...data, voyageId: activeVoyage.id };
    }
  }

  const [report] = await db.insert(noonReports).values(data).returning();

  // Bunker ROB senkronu — tüketim verisi varsa kaydet
  if (data.hfoConsumed || data.mgoConsumed || data.lsfoConsumed) {
    try {
      await db.insert(bunkerRobs).values({
        vesselId: data.vesselId,
        voyageId: data.voyageId ?? null,
        reportDate: data.reportDate,
        hfoRob: data.hfoRob ?? 0,
        mgoRob: data.mgoRob ?? 0,
        lsfoRob: data.lsfoRob ?? 0,
        hfoConsumed: data.hfoConsumed ?? 0,
        mgoConsumed: data.mgoConsumed ?? 0,
        lsfoConsumed: data.lsfoConsumed ?? 0,
        reportedBy: data.userId,
      });
    } catch (err) {
      console.error("[noon-report] Bunker ROB sync failed:", err);
    }
  }

  // Gemi konumu kaydet (tracking)
  if (data.latitude && data.longitude) {
    try {
      const [vessel] = await db.select({ mmsi: vessels.mmsi, name: vessels.name })
        .from(vessels).where(eq(vessels.id, data.vesselId));
      if (vessel?.mmsi) {
        await db.insert(vesselPositions).values({
          mmsi: vessel.mmsi,
          vesselName: vessel.name,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speedOverGround ?? null,
        } as any);
      }
    } catch (err) {
      console.error("[noon-report] Position sync failed:", err);
    }
  }

  return report;
}

async function updateNoonReport(id: number, data: Partial<InsertNoonReport>): Promise<NoonReport | undefined> {
  const [updated] = await db.update(noonReports).set(data).where(eq(noonReports.id, id)).returning();
  return updated;
}

async function deleteNoonReport(id: number): Promise<boolean> {
  const [deleted] = await db.delete(noonReports).where(eq(noonReports.id, id)).returning();
  return !!deleted;
}

async function getVesselPerformanceStats(vesselId: number): Promise<any> {
  const reports = await getNoonReports(vesselId);
  if (reports.length === 0) return { avgSpeed: 0, avgDailyConsumption: 0, totalDistance: 0, reportDays: 0 };
  const totalDistance = reports.reduce((sum, r) => sum + (Number(r.distanceLastNoon) || 0), 0);
  const avgSpeed = reports.reduce((sum, r) => sum + (Number(r.speedOverGround) || 0), 0) / reports.length;
  const totalHfo = reports.reduce((sum, r) => sum + (Number(r.hfoConsumed) || 0), 0);
  const totalMgo = reports.reduce((sum, r) => sum + (Number(r.mgoConsumed) || 0), 0);
  const totalLsfo = reports.reduce((sum, r) => sum + (Number(r.lsfoConsumed) || 0), 0);
  const avgDailyConsumption = (totalHfo + totalMgo + totalLsfo) / reports.length;
  return {
    avgSpeed: Number(avgSpeed.toFixed(1)),
    avgDailyConsumption: Number(avgDailyConsumption.toFixed(1)),
    totalDistance: Number(totalDistance.toFixed(0)),
    reportDays: reports.length,
  };
}

export const voyageStorage = {
  createVoyage,
  getVoyagesByUser,
  getVoyageById,
  getVoyageByTenderId,
  updateVoyageStatus,
  updateVoyage,
  deleteVoyage,
  restoreVoyage,
  createChecklistItem,
  getChecklistByVoyage,
  toggleChecklistItem,
  deleteChecklistItem,
  updateChecklistItem,
  createServiceRequest,
  getServiceRequestsByPort,
  getServiceRequestsByUser,
  getServiceRequestById,
  updateServiceRequestStatus,
  createServiceOffer,
  getOffersByRequest,
  selectServiceOffer,
  getProviderOffersByUser,
  getProviderCompanyIdByUser,
  createVoyageDocument,
  getVoyageDocuments,
  deleteVoyageDocument,
  signVoyageDocument,
  createNewDocumentVersion,
  createVoyageReview,
  getVoyageReviews,
  getMyVoyageReview,
  getVoyageChatMessages,
  createVoyageChatMessage,
  getPortCallAppointments,
  createPortCallAppointment,
  updatePortCallAppointment,
  deletePortCallAppointment,
  getVoyageCrewLogistics,
  saveVoyageCrewLogistics,
  getDocumentTemplates,
  getNoonReports,
  createNoonReport,
  updateNoonReport,
  deleteNoonReport,
  getVesselPerformanceStats,
};
