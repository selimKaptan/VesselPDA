import { db, eq, and, or, desc, asc, count, inArray, sql } from "./base";
import { alias } from "drizzle-orm/pg-core";
import {
  portTenders, tenderBids, agentReviews,
  vesselWatchlist,
  users, companyProfiles, ports,
  type PortTender, type InsertPortTender,
  type TenderBid, type InsertTenderBid,
  type AgentReview, type InsertAgentReview,
  type VesselWatchlistItem, type InsertVesselWatchlist,
  type CompanyProfile,
} from "@shared/schema";

async function getPortTenders(filters?: { userId?: string; portId?: number; status?: string }): Promise<any[]> {
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

async function getPortTenderById(id: number): Promise<any | undefined> {
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

async function createPortTender(data: InsertPortTender): Promise<PortTender> {
  const [created] = await db.insert(portTenders).values(data).returning();
  return created;
}

async function updatePortTenderStatus(id: number, status: string, nominatedAgentId?: string): Promise<PortTender | undefined> {
  const updateData: any = { status };
  if (nominatedAgentId) {
    updateData.nominatedAgentId = nominatedAgentId;
    updateData.nominatedAt = new Date();
  }
  const [updated] = await db.update(portTenders).set(updateData).where(eq(portTenders.id, id)).returning();
  return updated;
}

async function getTenderBids(tenderId: number): Promise<any[]> {
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

async function getTenderBidsByAgent(agentUserId: string): Promise<any[]> {
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

async function createTenderBid(data: InsertTenderBid): Promise<TenderBid> {
  const [created] = await db.insert(tenderBids).values(data).returning();
  return created;
}

async function updateTenderBidStatus(id: number, status: string): Promise<TenderBid | undefined> {
  const [updated] = await db.update(tenderBids).set({ status }).where(eq(tenderBids.id, id)).returning();
  return updated;
}

async function getAgentsByPort(portId: number): Promise<CompanyProfile[]> {
  const profiles = await db.select().from(companyProfiles)
    .where(and(eq(companyProfiles.companyType, "agent"), eq(companyProfiles.isActive, true)));
  return profiles.filter(p => (p.servedPorts as number[])?.includes(portId));
}

async function getTenderCountForAgent(agentUserId: string, portIds: number[]): Promise<number> {
  if (portIds.length === 0) return 0;
  const allOpen = await db.select().from(portTenders).where(eq(portTenders.status, "open"));
  const relevant = allOpen.filter(t => portIds.includes(t.portId));
  const bidTenderIds = await db.select({ tenderId: tenderBids.tenderId }).from(tenderBids).where(eq(tenderBids.agentUserId, agentUserId));
  const bidSet = new Set(bidTenderIds.map(b => b.tenderId));
  return relevant.filter(t => !bidSet.has(t.id)).length;
}

async function createReview(data: InsertAgentReview): Promise<AgentReview> {
  const [review] = await db.insert(agentReviews).values(data).returning();
  return review;
}

async function getReviewsByCompany(companyProfileId: number): Promise<any[]> {
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

async function getMyReviewForTender(reviewerUserId: string, tenderId: number): Promise<AgentReview | undefined> {
  const [review] = await db.select().from(agentReviews)
    .where(and(eq(agentReviews.reviewerUserId, reviewerUserId), eq(agentReviews.tenderId, tenderId)));
  return review;
}

async function getVesselWatchlist(userId: string): Promise<VesselWatchlistItem[]> {
  return db.select().from(vesselWatchlist)
    .where(eq(vesselWatchlist.userId, userId))
    .orderBy(desc(vesselWatchlist.addedAt));
}

async function addToWatchlist(item: InsertVesselWatchlist): Promise<VesselWatchlistItem> {
  const [row] = await db.insert(vesselWatchlist).values(item).returning();
  return row;
}

async function removeFromWatchlist(id: number, userId: string): Promise<boolean> {
  const result = await db.delete(vesselWatchlist)
    .where(and(eq(vesselWatchlist.id, id), eq(vesselWatchlist.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export const tenderStorage = {
  getPortTenders,
  getPortTenderById,
  createPortTender,
  updatePortTenderStatus,
  getTenderBids,
  getTenderBidsByAgent,
  createTenderBid,
  updateTenderBidStatus,
  getAgentsByPort,
  getTenderCountForAgent,
  createReview,
  getReviewsByCompany,
  getMyReviewForTender,
  getVesselWatchlist,
  addToWatchlist,
  removeFromWatchlist,
};
