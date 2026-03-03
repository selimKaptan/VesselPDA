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

import { forumMethods } from './forum';
import { marketMethods } from './market';
import { messagesMethods } from './messages';
import { proformasMethods } from './proformas';
import { servicesMethods } from './services';
import { tendersMethods } from './tenders';
import { usersMethods } from './users';
import { vesselsMethods } from './vessels';
import { voyagesMethods } from './voyages';

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateActiveRole(userId: string, activeRole: string): Promise<User | undefined>;
  incrementProformaCount(userId: string): Promise<void>;
  updateSubscription(userId: string, plan: string, limit: number): Promise<User | undefined>;

  getVesselsByUser(userId: string, organizationId?: number | null): Promise<Vessel[]>;
  getVessel(id: number, userId: string, organizationId?: number | null): Promise<Vessel | undefined>;
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

  getProformasByUser(userId: string, organizationId?: number | null): Promise<Proforma[]>;
  getAllProformas(): Promise<Proforma[]>;
  getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined>;
  getProformaById(id: number): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined>;
  createProforma(proforma: InsertProforma): Promise<Proforma>;
  duplicateProforma(id: number, userId: string): Promise<Proforma | undefined>;
  deleteProforma(id: number, userId: string): Promise<boolean>;

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
  getVoyagesByUser(userId: string, role?: string, organizationId?: number | null): Promise<any[]>;
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
  createVesselCrewMember(data: InsertVesselCrew): Promise<VesselCrew>;
  updateVesselCrewMember(id: number, data: Partial<InsertVesselCrew>): Promise<VesselCrew | undefined>;
  deleteVesselCrewMember(id: number): Promise<boolean>;

  getPortCallAppointments(voyageId: number): Promise<PortCallAppointment[]>;
  createPortCallAppointment(data: InsertPortCallAppointment): Promise<PortCallAppointment>;
  updatePortCallAppointment(id: number, data: Partial<InsertPortCallAppointment>): Promise<PortCallAppointment | undefined>;
  deletePortCallAppointment(id: number): Promise<boolean>;

  getFixtures(userId: string, organizationId?: number | null): Promise<Fixture[]>;
  getInvoicesByUser(userId: string, organizationId?: number | null): Promise<any[]>;
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
}


export class DatabaseStorage {
  // Methods mixed in via Object.assign below — interface merging provides types
}

export interface DatabaseStorage extends IStorage {}

Object.assign(
  DatabaseStorage.prototype,
  forumMethods,
  marketMethods,
  messagesMethods,
  proformasMethods,
  servicesMethods,
  tendersMethods,
  usersMethods,
  vesselsMethods,
  voyagesMethods,
);

export const storage = new DatabaseStorage() as DatabaseStorage & IStorage;
