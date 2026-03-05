export * from "./models/auth";

import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, serial, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "./models/auth";

export const vessels = pgTable("vessels", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyProfileId: integer("company_profile_id").references(() => companyProfiles.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  flag: text("flag").notNull(),
  vesselType: text("vessel_type").notNull(),
  grt: real("grt").notNull(),
  nrt: real("nrt").notNull(),
  dwt: real("dwt"),
  loa: real("loa"),
  beam: real("beam"),
  imoNumber: text("imo_number"),
  callSign: text("call_sign"),
  fleetStatus: text("fleet_status").default("idle"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselRelations = relations(vessels, ({ one }) => ({
  user: one(users, { fields: [vessels.userId], references: [users.id] }),
}));

export const ports = pgTable("ports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  code: text("code"),
  currency: text("currency").notNull().default("USD"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tariffCategories = pgTable("tariff_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  portId: integer("port_id").notNull().references(() => ports.id),
  name: text("name").notNull(),
  description: text("description"),
  calculationType: text("calculation_type").notNull().default("fixed"),
  baseUnit: text("base_unit"),
  overtimeRate: real("overtime_rate"),
  currency: text("currency").notNull().default("USD"),
});

export const tariffCategoryRelations = relations(tariffCategories, ({ one, many }) => ({
  port: one(ports, { fields: [tariffCategories.portId], references: [ports.id] }),
  rates: many(tariffRates),
}));

export const tariffRates = pgTable("tariff_rates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => tariffCategories.id),
  minGrt: real("min_grt").notNull().default(0),
  maxGrt: real("max_grt"),
  rate: real("rate").notNull(),
  perUnit: text("per_unit"),
});

export const tariffRateRelations = relations(tariffRates, ({ one }) => ({
  category: one(tariffCategories, { fields: [tariffRates.categoryId], references: [tariffCategories.id] }),
}));

export const proformas = pgTable("proformas", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyProfileId: integer("company_profile_id").references(() => companyProfiles.id, { onDelete: "set null" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  portId: integer("port_id").notNull().references(() => ports.id),
  referenceNumber: text("reference_number").notNull(),
  toCompany: text("to_company"),
  toCountry: text("to_country"),
  purposeOfCall: text("purpose_of_call").notNull().default("Loading"),
  cargoType: text("cargo_type"),
  cargoQuantity: real("cargo_quantity"),
  cargoUnit: text("cargo_unit").default("MT"),
  berthStayDays: integer("berth_stay_days").notNull().default(5),
  exchangeRate: real("exchange_rate").default(1),
  lineItems: jsonb("line_items").notNull().$type<ProformaLineItem[]>(),
  totalUsd: real("total_usd").notNull(),
  totalEur: real("total_eur"),
  notes: text("notes"),
  bankDetails: jsonb("bank_details").$type<BankDetails>(),
  status: text("status").notNull().default("draft"),
  approvalStatus: text("approval_status").notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  revisionNote: text("revision_note"),
  approvalNote: text("approval_note"),
  approvalToken: varchar("approval_token"),
  recipientEmail: varchar("recipient_email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const proformaRelations = relations(proformas, ({ one, many }) => ({
  user: one(users, { fields: [proformas.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [proformas.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [proformas.portId], references: [ports.id] }),
  approvalLogs: many(proformaApprovalLogs),
}));

export const proformaApprovalLogs = pgTable("proforma_approval_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  proformaId: integer("proforma_id").notNull().references(() => proformas.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  note: text("note"),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const proformaApprovalLogRelations = relations(proformaApprovalLogs, ({ one }) => ({
  proforma: one(proformas, { fields: [proformaApprovalLogs.proformaId], references: [proformas.id] }),
  user: one(users, { fields: [proformaApprovalLogs.userId], references: [users.id] }),
}));

export interface ProformaLineItem {
  description: string;
  amountUsd: number;
  amountEur?: number;
  notes?: string;
}

export interface BankDetails {
  bankName: string;
  branch: string;
  swiftCode: string;
  usdIban: string;
  eurIban: string;
  tlIban?: string;
  beneficiary: string;
}

export const forumCategories = pgTable("forum_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#2563EB"),
  description: text("description"),
  topicCount: integer("topic_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumTopics = pgTable("forum_topics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => forumCategories.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  dislikeCount: integer("dislike_count").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumTopicRelations = relations(forumTopics, ({ one, many }) => ({
  category: one(forumCategories, { fields: [forumTopics.categoryId], references: [forumCategories.id] }),
  user: one(users, { fields: [forumTopics.userId], references: [users.id] }),
  replies: many(forumReplies),
}));

export const forumReplies = pgTable("forum_replies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  topicId: integer("topic_id").notNull().references(() => forumTopics.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  likeCount: integer("like_count").notNull().default(0),
  dislikeCount: integer("dislike_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumReplyRelations = relations(forumReplies, ({ one }) => ({
  topic: one(forumTopics, { fields: [forumReplies.topicId], references: [forumTopics.id] }),
  user: one(users, { fields: [forumReplies.userId], references: [users.id] }),
}));

export const forumLikes = pgTable("forum_likes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  topicId: integer("topic_id").references(() => forumTopics.id),
  replyId: integer("reply_id").references(() => forumReplies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumDislikes = pgTable("forum_dislikes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  topicId: integer("topic_id").references(() => forumTopics.id),
  replyId: integer("reply_id").references(() => forumReplies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ForumDislike = typeof forumDislikes.$inferSelect;

export const insertVesselSchema = createInsertSchema(vessels).omit({ createdAt: true });
export const insertPortSchema = createInsertSchema(ports).omit({ createdAt: true });
export const insertTariffCategorySchema = createInsertSchema(tariffCategories).omit({});
export const insertTariffRateSchema = createInsertSchema(tariffRates).omit({});
export const insertProformaSchema = createInsertSchema(proformas).omit({ createdAt: true });
export const insertProformaApprovalLogSchema = createInsertSchema(proformaApprovalLogs).omit({ createdAt: true });

export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type Vessel = typeof vessels.$inferSelect;
export type InsertPort = z.infer<typeof insertPortSchema>;
export type Port = typeof ports.$inferSelect;
export type InsertTariffCategory = z.infer<typeof insertTariffCategorySchema>;
export type TariffCategory = typeof tariffCategories.$inferSelect;
export type InsertTariffRate = z.infer<typeof insertTariffRateSchema>;
export type TariffRate = typeof tariffRates.$inferSelect;
export type InsertProforma = z.infer<typeof insertProformaSchema>;
export type Proforma = typeof proformas.$inferSelect;
export type ProformaApprovalLog = typeof proformaApprovalLogs.$inferSelect;
export type InsertProformaApprovalLog = z.infer<typeof insertProformaApprovalLogSchema>;

export const insertForumCategorySchema = createInsertSchema(forumCategories).omit({ createdAt: true });
export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({ createdAt: true, lastActivityAt: true, viewCount: true, replyCount: true, likeCount: true, isPinned: true, isLocked: true });
export const insertForumReplySchema = createInsertSchema(forumReplies).omit({ createdAt: true, likeCount: true });

export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;
export type ForumCategory = typeof forumCategories.$inferSelect;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type ForumTopic = typeof forumTopics.$inferSelect;
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type ForumReply = typeof forumReplies.$inferSelect;
export type ForumLike = typeof forumLikes.$inferSelect;

// ─── PORT CALL TENDER SYSTEM ─────────────────────────────────────────────────

export const portTenders = pgTable("port_tenders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  portId: integer("port_id").notNull().references(() => ports.id),
  vesselName: text("vessel_name"),
  description: text("description"),
  cargoInfo: text("cargo_info"),
  grt: real("grt"),
  nrt: real("nrt"),
  flag: text("flag"),
  cargoType: text("cargo_type"),
  cargoQuantity: text("cargo_quantity"),
  previousPort: text("previous_port"),
  q88Base64: text("q88_base64"),
  expiryHours: integer("expiry_hours").notNull().default(24),
  status: text("status").notNull().default("open"),
  nominatedAgentId: varchar("nominated_agent_id"),
  nominatedAt: timestamp("nominated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenderBids = pgTable("tender_bids", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenderId: integer("tender_id").notNull().references(() => portTenders.id),
  agentUserId: varchar("agent_user_id").notNull().references(() => users.id),
  agentCompanyId: integer("agent_company_id").references(() => companyProfiles.id),
  proformaPdfBase64: text("proforma_pdf_base64"),
  proformaPdfUrl: text("proforma_pdf_url"),
  notes: text("notes"),
  totalAmount: text("total_amount"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portTenderRelations = relations(portTenders, ({ one, many }) => ({
  user: one(users, { fields: [portTenders.userId], references: [users.id] }),
  port: one(ports, { fields: [portTenders.portId], references: [ports.id] }),
  bids: many(tenderBids),
}));

export const tenderBidRelations = relations(tenderBids, ({ one }) => ({
  tender: one(portTenders, { fields: [tenderBids.tenderId], references: [portTenders.id] }),
  agent: one(users, { fields: [tenderBids.agentUserId], references: [users.id] }),
  agentCompany: one(companyProfiles, { fields: [tenderBids.agentCompanyId], references: [companyProfiles.id] }),
}));

export const insertPortTenderSchema = createInsertSchema(portTenders).omit({ createdAt: true, nominatedAt: true, nominatedAgentId: true, status: true });
export const insertTenderBidSchema = createInsertSchema(tenderBids).omit({ createdAt: true, status: true });

export type InsertPortTender = z.infer<typeof insertPortTenderSchema>;
export type PortTender = typeof portTenders.$inferSelect;
export type InsertTenderBid = z.infer<typeof insertTenderBidSchema>;
export type TenderBid = typeof tenderBids.$inferSelect;

// ─── AGENT REVIEWS ────────────────────────────────────────────────────────────

export const agentReviews = pgTable("agent_reviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyProfileId: integer("company_profile_id").notNull().references(() => companyProfiles.id),
  reviewerUserId: varchar("reviewer_user_id").notNull().references(() => users.id),
  tenderId: integer("tender_id").references(() => portTenders.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  vesselName: text("vessel_name"),
  portName: text("port_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentReviewRelations = relations(agentReviews, ({ one }) => ({
  company: one(companyProfiles, { fields: [agentReviews.companyProfileId], references: [companyProfiles.id] }),
  reviewer: one(users, { fields: [agentReviews.reviewerUserId], references: [users.id] }),
  tender: one(portTenders, { fields: [agentReviews.tenderId], references: [portTenders.id] }),
}));

export const insertAgentReviewSchema = createInsertSchema(agentReviews).omit({ createdAt: true });
export type InsertAgentReview = z.infer<typeof insertAgentReviewSchema>;
export type AgentReview = typeof agentReviews.$inferSelect;

// ─── VESSEL WATCHLIST ─────────────────────────────────────────────────────────

export const vesselWatchlist = pgTable("vessel_watchlist", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  mmsi: text("mmsi"),
  imo: text("imo"),
  vesselName: text("vessel_name").notNull(),
  flag: text("flag"),
  vesselType: text("vessel_type"),
  notes: text("notes"),
  addedAt: timestamp("added_at").defaultNow(),
});

export const vesselWatchlistRelations = relations(vesselWatchlist, ({ one }) => ({
  user: one(users, { fields: [vesselWatchlist.userId], references: [users.id] }),
}));

export const insertVesselWatchlistSchema = createInsertSchema(vesselWatchlist).omit({ addedAt: true });
export type InsertVesselWatchlist = z.infer<typeof insertVesselWatchlistSchema>;
export type VesselWatchlistItem = typeof vesselWatchlist.$inferSelect;

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const feedbacks = pgTable("feedbacks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  message: text("message").notNull(),
  pageUrl: text("page_url"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ createdAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbacks.$inferSelect;

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'forum_reply' | 'bid_received' | 'bid_selected' | 'nomination'
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ createdAt: true, isRead: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ─── VOYAGES (SEFER YÖNETİMİ) ─────────────────────────────────────────────────

export const voyages = pgTable("voyages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselId: integer("vessel_id").references(() => vessels.id),
  portId: integer("port_id").notNull().references(() => ports.id),
  agentUserId: varchar("agent_user_id").references(() => users.id),
  tenderId: integer("tender_id").references(() => portTenders.id),
  vesselName: text("vessel_name"),
  imoNumber: text("imo_number"),
  flag: text("flag"),
  vesselType: text("vessel_type"),
  grt: real("grt"),
  mmsi: text("mmsi"),
  callSign: text("call_sign"),
  status: text("status").notNull().default("planned"),
  eta: timestamp("eta"),
  etd: timestamp("etd"),
  purposeOfCall: text("purpose_of_call").notNull().default("Loading"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageRelations = relations(voyages, ({ one, many }) => ({
  user: one(users, { fields: [voyages.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [voyages.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [voyages.portId], references: [ports.id] }),
  tender: one(portTenders, { fields: [voyages.tenderId], references: [portTenders.id] }),
  checklists: many(voyageChecklists),
  serviceRequests: many(serviceRequests),
  activities: many(voyageActivities),
}));

export const voyageChecklists = pgTable("voyage_checklists", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  assignedTo: text("assigned_to").notNull().default("both"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageChecklistRelations = relations(voyageChecklists, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageChecklists.voyageId], references: [voyages.id] }),
}));

// ─── VOYAGE ACTIVITIES (ACTIVITY TIMELINE) ───────────────────────────────────

export const voyageActivities = pgTable("voyage_activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVoyageActivitySchema = z.object({
  voyageId: z.number().int(),
  userId: z.string().optional().nullable(),
  activityType: z.string().max(50),
  title: z.string().max(300),
  description: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});
export type InsertVoyageActivity = z.infer<typeof insertVoyageActivitySchema>;
export type VoyageActivity = typeof voyageActivities.$inferSelect;

// ─── VOYAGE COLLABORATORS (INVITATIONS + PARTICIPANTS) ───────────────────────

export interface VoyageParticipantPermissions {
  canViewDocuments?: boolean;
  canUploadDocuments?: boolean;
  canChat?: boolean;
  canViewFinancials?: boolean;
  canEditChecklist?: boolean;
  canViewSOF?: boolean;
}

export const DEFAULT_PARTICIPANT_PERMISSIONS: Record<string, VoyageParticipantPermissions> = {
  agent:    { canViewDocuments: true, canUploadDocuments: true, canChat: true, canViewFinancials: true, canEditChecklist: true, canViewSOF: true },
  provider: { canViewDocuments: true, canUploadDocuments: true, canChat: true, canViewFinancials: false, canEditChecklist: false, canViewSOF: false },
  surveyor: { canViewDocuments: true, canUploadDocuments: true, canChat: true, canViewFinancials: false, canEditChecklist: false, canViewSOF: true },
  broker:   { canViewDocuments: true, canUploadDocuments: false, canChat: true, canViewFinancials: true, canEditChecklist: false, canViewSOF: false },
  observer: { canViewDocuments: true, canUploadDocuments: false, canChat: false, canViewFinancials: false, canEditChecklist: false, canViewSOF: true },
};

export const voyageCollaborators = pgTable("voyage_collaborators", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inviteeEmail: varchar("invitee_email", { length: 300 }),
  inviteeCompanyId: integer("invitee_company_id"),
  role: text("role").notNull().default("observer"),
  serviceType: varchar("service_type", { length: 100 }),
  permissions: jsonb("permissions").$type<VoyageParticipantPermissions>().notNull().default({}),
  status: text("status").notNull().default("pending"),
  token: varchar("token", { length: 100 }),
  expiresAt: timestamp("expires_at"),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  declineReason: text("decline_reason"),
  message: text("message"),
  notes: text("notes"),
});

export const voyageCollaboratorRelations = relations(voyageCollaborators, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageCollaborators.voyageId], references: [voyages.id] }),
  invitedByUser: one(users, { fields: [voyageCollaborators.invitedByUserId], references: [users.id] }),
  user: one(users, { fields: [voyageCollaborators.userId], references: [users.id] }),
}));

export const insertVoyageCollaboratorSchema = z.object({
  voyageId: z.number().int(),
  userId: z.string().optional(),
  inviteeEmail: z.string().email().optional(),
  inviteeCompanyId: z.number().int().optional(),
  role: z.string().default("observer"),
  serviceType: z.string().optional(),
  message: z.string().optional(),
});

export type VoyageCollaborator = typeof voyageCollaborators.$inferSelect;

// ─── SERVICE REQUESTS (HİZMET TALEPLERİ) ─────────────────────────────────────

export const serviceRequests = pgTable("service_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  portId: integer("port_id").notNull().references(() => ports.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  vesselName: text("vessel_name").notNull(),
  grt: real("grt"),
  serviceType: text("service_type").notNull().default("other"),
  description: text("description").notNull(),
  quantity: real("quantity"),
  unit: text("unit"),
  preferredDate: timestamp("preferred_date"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceRequestRelations = relations(serviceRequests, ({ one, many }) => ({
  requester: one(users, { fields: [serviceRequests.requesterId], references: [users.id] }),
  port: one(ports, { fields: [serviceRequests.portId], references: [ports.id] }),
  voyage: one(voyages, { fields: [serviceRequests.voyageId], references: [voyages.id] }),
  offers: many(serviceOffers),
}));

export const serviceOffers = pgTable("service_offers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  serviceRequestId: integer("service_request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  providerUserId: varchar("provider_user_id").notNull().references(() => users.id),
  providerCompanyId: integer("provider_company_id").references(() => companyProfiles.id),
  price: real("price").notNull(),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  estimatedDuration: text("estimated_duration"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceOfferRelations = relations(serviceOffers, ({ one }) => ({
  serviceRequest: one(serviceRequests, { fields: [serviceOffers.serviceRequestId], references: [serviceRequests.id] }),
  provider: one(users, { fields: [serviceOffers.providerUserId], references: [users.id] }),
  providerCompany: one(companyProfiles, { fields: [serviceOffers.providerCompanyId], references: [companyProfiles.id] }),
}));

// ─── VOYAGE DOCUMENTS ─────────────────────────────────────────────────────────

export const voyageDocuments = pgTable("voyage_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  docType: text("doc_type").notNull().default("other"),
  fileBase64: text("file_base64"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  notes: text("notes"),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  version: integer("version").default(1),
  signatureText: text("signature_text"),
  signedAt: timestamp("signed_at"),
  templateId: integer("template_id"),
  parentDocId: integer("parent_doc_id"),
});

export const voyageDocumentRelations = relations(voyageDocuments, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageDocuments.voyageId], references: [voyages.id] }),
  uploader: one(users, { fields: [voyageDocuments.uploadedByUserId], references: [users.id] }),
}));

// ─── VOYAGE REVIEWS ────────────────────────────────────────────────────────────

export const voyageReviews = pgTable("voyage_reviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  reviewerUserId: varchar("reviewer_user_id").notNull().references(() => users.id),
  revieweeUserId: varchar("reviewee_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageReviewRelations = relations(voyageReviews, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageReviews.voyageId], references: [voyages.id] }),
  reviewer: one(users, { fields: [voyageReviews.reviewerUserId], references: [users.id] }),
  reviewee: one(users, { fields: [voyageReviews.revieweeUserId], references: [users.id] }),
}));

// ─── VOYAGE CHAT ──────────────────────────────────────────────────────────────

export const voyageChatMessages = pgTable("voyage_chat_messages", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageChatMessageRelations = relations(voyageChatMessages, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageChatMessages.voyageId], references: [voyages.id] }),
  sender: one(users, { fields: [voyageChatMessages.senderId], references: [users.id] }),
}));

// ─── MESSAGING ────────────────────────────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  user1Id: varchar("user1_id").notNull().references(() => users.id),
  user2Id: varchar("user2_id").notNull().references(() => users.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  externalEmail: text("external_email"),
  externalEmailName: text("external_email_name"),
  externalEmailForward: boolean("external_email_forward").notNull().default(false),
});

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  user1: one(users, { fields: [conversations.user1Id], references: [users.id] }),
  user2: one(users, { fields: [conversations.user2Id], references: [users.id] }),
  messages: many(messages),
}));

export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  messageType: text("message_type").notNull().default("text"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  readAt: timestamp("read_at"),
  mentions: text("mentions"),
});

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

// ─── DIRECT NOMINATIONS ───────────────────────────────────────────────────────

export const directNominations = pgTable("direct_nominations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nominatorUserId: varchar("nominator_user_id").notNull().references(() => users.id),
  agentUserId: varchar("agent_user_id").notNull().references(() => users.id),
  agentCompanyId: integer("agent_company_id").references(() => companyProfiles.id),
  portId: integer("port_id").notNull().references(() => ports.id),
  vesselName: text("vessel_name").notNull(),
  vesselId: integer("vessel_id").references(() => vessels.id),
  purposeOfCall: text("purpose_of_call").notNull(),
  eta: timestamp("eta"),
  etd: timestamp("etd"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const directNominationRelations = relations(directNominations, ({ one }) => ({
  nominator: one(users, { fields: [directNominations.nominatorUserId], references: [users.id] }),
  agent: one(users, { fields: [directNominations.agentUserId], references: [users.id] }),
  agentCompany: one(companyProfiles, { fields: [directNominations.agentCompanyId], references: [companyProfiles.id] }),
  port: one(ports, { fields: [directNominations.portId], references: [ports.id] }),
}));

// ─── SCHEMA EXPORTS ───────────────────────────────────────────────────────────

export const insertVoyageSchema = createInsertSchema(voyages).omit({ createdAt: true });
export const insertVoyageChecklistSchema = createInsertSchema(voyageChecklists).omit({ createdAt: true, isCompleted: true, completedAt: true });
export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ createdAt: true, status: true });
export const insertServiceOfferSchema = createInsertSchema(serviceOffers).omit({ createdAt: true, status: true });
export const insertVoyageDocumentSchema = createInsertSchema(voyageDocuments).omit({ createdAt: true });
export const insertVoyageReviewSchema = createInsertSchema(voyageReviews).omit({ createdAt: true });
export const insertVoyageChatMessageSchema = createInsertSchema(voyageChatMessages).omit({ createdAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ createdAt: true, lastMessageAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ createdAt: true, isRead: true, readAt: true });

export type InsertVoyage = z.infer<typeof insertVoyageSchema>;
export type Voyage = typeof voyages.$inferSelect;
export type InsertVoyageChecklist = z.infer<typeof insertVoyageChecklistSchema>;
export type VoyageChecklist = typeof voyageChecklists.$inferSelect;
export type InsertVoyageDocument = z.infer<typeof insertVoyageDocumentSchema>;
export type VoyageDocument = typeof voyageDocuments.$inferSelect;
export type InsertVoyageReview = z.infer<typeof insertVoyageReviewSchema>;
export type VoyageReview = typeof voyageReviews.$inferSelect;
export type InsertVoyageChatMessage = z.infer<typeof insertVoyageChatMessageSchema>;
export type VoyageChatMessage = typeof voyageChatMessages.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceOffer = z.infer<typeof insertServiceOfferSchema>;
export type ServiceOffer = typeof serviceOffers.$inferSelect;

export const insertDirectNominationSchema = createInsertSchema(directNominations).omit({ createdAt: true, status: true, respondedAt: true });
export type InsertDirectNomination = z.infer<typeof insertDirectNominationSchema>;
export type DirectNomination = typeof directNominations.$inferSelect;

// ─── ENDORSEMENTS ─────────────────────────────────────────────────────────────

export const endorsements = pgTable("endorsements", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id),
  toCompanyProfileId: integer("to_company_profile_id").notNull().references(() => companyProfiles.id),
  relationship: varchar("relationship", { length: 100 }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const endorsementRelations = relations(endorsements, ({ one }) => ({
  fromUser: one(users, { fields: [endorsements.fromUserId], references: [users.id] }),
  toCompanyProfile: one(companyProfiles, { fields: [endorsements.toCompanyProfileId], references: [companyProfiles.id] }),
}));

export const insertEndorsementSchema = createInsertSchema(endorsements).omit({ createdAt: true });
export type InsertEndorsement = z.infer<typeof insertEndorsementSchema>;
export type Endorsement = typeof endorsements.$inferSelect;

// ─── VESSEL CERTIFICATES ────────────────────────────────────────────────────

export const vesselCertificates = pgTable("vessel_certificates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  certType: text("cert_type").notNull().default("other"),
  issuedAt: timestamp("issued_at"),
  expiresAt: timestamp("expires_at"),
  issuingAuthority: text("issuing_authority"),
  certificateNumber: text("certificate_number"),
  notes: text("notes"),
  status: text("status").notNull().default("valid"),
  fileBase64: text("file_base64"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselCertificateRelations = relations(vesselCertificates, ({ one }) => ({
  user: one(users, { fields: [vesselCertificates.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [vesselCertificates.vesselId], references: [vessels.id] }),
}));

export const insertVesselCertificateSchema = createInsertSchema(vesselCertificates).omit({ createdAt: true, status: true });
export type InsertVesselCertificate = z.infer<typeof insertVesselCertificateSchema>;
export type VesselCertificate = typeof vesselCertificates.$inferSelect;

// ─── PORT CALL APPOINTMENTS ─────────────────────────────────────────────────

export const portCallAppointments = pgTable("port_call_appointments", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  appointmentType: text("appointment_type").notNull().default("other"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  confirmedBy: text("confirmed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portCallAppointmentRelations = relations(portCallAppointments, ({ one }) => ({
  voyage: one(voyages, { fields: [portCallAppointments.voyageId], references: [voyages.id] }),
  user: one(users, { fields: [portCallAppointments.userId], references: [users.id] }),
}));

export const insertPortCallAppointmentSchema = createInsertSchema(portCallAppointments).omit({ createdAt: true });
export type InsertPortCallAppointment = z.infer<typeof insertPortCallAppointmentSchema>;
export type PortCallAppointment = typeof portCallAppointments.$inferSelect;

// ─── FIXTURES ───────────────────────────────────────────────────────────────

export const fixtures = pgTable("fixtures", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("negotiating"),
  vesselName: text("vessel_name").notNull(),
  imoNumber: text("imo_number"),
  cargoType: text("cargo_type").notNull(),
  cargoQuantity: real("cargo_quantity"),
  quantityUnit: text("quantity_unit").notNull().default("MT"),
  loadingPort: text("loading_port").notNull(),
  dischargePort: text("discharge_port").notNull(),
  laycanFrom: timestamp("laycan_from"),
  laycanTo: timestamp("laycan_to"),
  freightRate: real("freight_rate"),
  freightCurrency: text("freight_currency").notNull().default("USD"),
  charterer: text("charterer"),
  shipowner: text("shipowner"),
  brokerCommission: real("broker_commission"),
  notes: text("notes"),
  recapText: text("recap_text"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fixtureRelations = relations(fixtures, ({ one }) => ({
  user: one(users, { fields: [fixtures.userId], references: [users.id] }),
}));

export const insertFixtureSchema = createInsertSchema(fixtures).omit({ createdAt: true, status: true });
export type InsertFixture = z.infer<typeof insertFixtureSchema>;
export type Fixture = typeof fixtures.$inferSelect;

// ─── LAYTIME CALCULATIONS ────────────────────────────────────────────────────

export const laytimeCalculations = pgTable("laytime_calculations", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  portCallType: text("port_call_type").notNull().default("loading"),
  portName: text("port_name"),
  allowedLaytimeHours: real("allowed_laytime_hours").notNull().default(0),
  norStartedAt: timestamp("nor_started_at"),
  berthingAt: timestamp("berthing_at"),
  loadingStartedAt: timestamp("loading_started_at"),
  loadingCompletedAt: timestamp("loading_completed_at"),
  departedAt: timestamp("departed_at"),
  timeUsedHours: real("time_used_hours").default(0),
  demurrageRate: real("demurrage_rate").default(0),
  despatchRate: real("despatch_rate").default(0),
  demurrageAmount: real("demurrage_amount").default(0),
  despatchAmount: real("despatch_amount").default(0),
  currency: text("currency").notNull().default("USD"),
  deductions: jsonb("deductions").default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const laytimeRelations = relations(laytimeCalculations, ({ one }) => ({
  fixture: one(fixtures, { fields: [laytimeCalculations.fixtureId], references: [fixtures.id] }),
}));

export const insertLaytimeSchema = createInsertSchema(laytimeCalculations).omit({ createdAt: true, timeUsedHours: true, demurrageAmount: true, despatchAmount: true });
export type InsertLaytime = z.infer<typeof insertLaytimeSchema>;
export type LaytimeCalculation = typeof laytimeCalculations.$inferSelect;

// ─── CARGO POSITIONS ────────────────────────────────────────────────────────

export const cargoPositions = pgTable("cargo_positions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  positionType: text("position_type").notNull().default("cargo"),
  title: text("title").notNull(),
  description: text("description"),
  vesselType: text("vessel_type"),
  cargoType: text("cargo_type"),
  quantity: real("quantity"),
  quantityUnit: text("quantity_unit"),
  loadingPort: text("loading_port").notNull(),
  dischargePort: text("discharge_port").notNull(),
  laycanFrom: timestamp("laycan_from"),
  laycanTo: timestamp("laycan_to"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  status: text("status").notNull().default("active"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cargoPositionRelations = relations(cargoPositions, ({ one }) => ({
  user: one(users, { fields: [cargoPositions.userId], references: [users.id] }),
}));

export const insertCargoPositionSchema = createInsertSchema(cargoPositions).omit({ createdAt: true, status: true });
export type InsertCargoPosition = z.infer<typeof insertCargoPositionSchema>;
export type CargoPosition = typeof cargoPositions.$inferSelect;

// ─── BUNKER PRICES ──────────────────────────────────────────────────────────

export const bunkerPrices = pgTable("bunker_prices", {
  id: serial("id").primaryKey(),
  portName: text("port_name").notNull(),
  portCode: text("port_code"),
  region: text("region").notNull().default("TR"),
  ifo380: real("ifo380"),
  vlsfo: real("vlsfo"),
  mgo: real("mgo"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertBunkerPriceSchema = createInsertSchema(bunkerPrices).omit({});
export type InsertBunkerPrice = z.infer<typeof insertBunkerPriceSchema>;
export type BunkerPrice = typeof bunkerPrices.$inferSelect;

// ─── DOCUMENT TEMPLATES ─────────────────────────────────────────────────────

export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"),
  content: text("content").notNull(),
  isBuiltIn: boolean("is_built_in").notNull().default(true),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ createdAt: true });
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// ─── INVOICES ────────────────────────────────────────────────────────────────

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  proformaId: integer("proforma_id").references(() => proformas.id, { onDelete: "set null" }),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  invoiceType: text("invoice_type").notNull().default("invoice"),
  linkedProformaId: integer("linked_proforma_id"),
  recipientEmail: varchar("recipient_email"),
  recipientName: varchar("recipient_name"),
  reminderSentAt: timestamp("reminder_sent_at"),
  overdueReminderSentAt: timestamp("overdue_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoiceRelations = relations(invoices, ({ one }) => ({
  voyage: one(voyages, { fields: [invoices.voyageId], references: [voyages.id] }),
  proforma: one(proformas, { fields: [invoices.proformaId], references: [proformas.id] }),
  creator: one(users, { fields: [invoices.createdByUserId], references: [users.id] }),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ createdAt: true, status: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// ─── PORT ALERTS ─────────────────────────────────────────────────────────────

export const portAlerts = pgTable("port_alerts", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  portName: text("port_name").notNull(),
  alertType: text("alert_type").notNull().default("other"),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portAlertRelations = relations(portAlerts, ({ one }) => ({
  port: one(ports, { fields: [portAlerts.portId], references: [ports.id] }),
  creator: one(users, { fields: [portAlerts.createdByUserId], references: [users.id] }),
}));

export const insertPortAlertSchema = createInsertSchema(portAlerts).omit({ createdAt: true });
export type InsertPortAlert = z.infer<typeof insertPortAlertSchema>;
export type PortAlert = typeof portAlerts.$inferSelect;

// ── Vessel Crew ──────────────────────────────────────────────────────────────
export const vesselCrew = pgTable("vessel_crew", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  rank: text("rank"),
  nationality: text("nationality"),
  contractEndDate: timestamp("contract_end_date"),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),
  seamansBookNumber: text("seamans_book_number"),
  seamansBookExpiry: timestamp("seamans_book_expiry"),
  passportFileBase64: text("passport_file_base64"),
  passportFileName: text("passport_file_name"),
  passportFileUrl: text("passport_file_url"),
  seamansBookFileBase64: text("seamans_book_file_base64"),
  seamansBookFileName: text("seamans_book_file_name"),
  seamansBookFileUrl: text("seamans_book_file_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselCrewRelations = relations(vesselCrew, ({ one }) => ({
  vessel: one(vessels, { fields: [vesselCrew.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [vesselCrew.userId], references: [users.id] }),
}));

export const insertVesselCrewSchema = createInsertSchema(vesselCrew).omit({ createdAt: true });
export type InsertVesselCrew = z.infer<typeof insertVesselCrewSchema>;
export type VesselCrew = typeof vesselCrew.$inferSelect;

// ─── VESSEL POSITIONS (AIS History) ───────────────────────────────────────────

export const vesselPositions = pgTable("vessel_positions", {
  id: serial("id").primaryKey(),
  watchlistItemId: integer("watchlist_item_id").references(() => vesselWatchlist.id, { onDelete: "set null" }),
  mmsi: text("mmsi").notNull(),
  imo: text("imo"),
  vesselName: text("vessel_name"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  speed: real("speed"),
  course: real("course"),
  heading: real("heading"),
  navigationStatus: text("navigation_status"),
  destination: text("destination"),
  eta: timestamp("eta"),
  draught: real("draught"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  mmsiTimestampIdx: index("vessel_positions_mmsi_timestamp_idx").on(table.mmsi, table.timestamp),
}));

export const vesselPositionsRelations = relations(vesselPositions, ({ one }) => ({
  watchlistItem: one(vesselWatchlist, { fields: [vesselPositions.watchlistItemId], references: [vesselWatchlist.id] }),
}));

export const insertVesselPositionSchema = createInsertSchema(vesselPositions).omit({ timestamp: true });
export type InsertVesselPosition = z.infer<typeof insertVesselPositionSchema>;
export type VesselPositionRecord = typeof vesselPositions.$inferSelect;

// ─── SANCTIONS CHECKS HISTORY ─────────────────────────────────────────────────

export const sanctionsChecks = pgTable("sanctions_checks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  vesselName: text("vessel_name"),
  imoNumber: text("imo_number"),
  mmsi: text("mmsi"),
  entityName: text("entity_name"),
  checkType: text("check_type").notNull().default("entity"),
  result: text("result").notNull(),
  matchDetails: jsonb("match_details"),
  source: text("source").notNull().default("ofac"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export const sanctionsChecksRelations = relations(sanctionsChecks, ({ one }) => ({
  user: one(users, { fields: [sanctionsChecks.userId], references: [users.id] }),
}));

export const insertSanctionsCheckSchema = createInsertSchema(sanctionsChecks).omit({ checkedAt: true });
export type InsertSanctionsCheck = z.infer<typeof insertSanctionsCheckSchema>;
export type SanctionsCheck = typeof sanctionsChecks.$inferSelect;

// ─── EXCHANGE RATES ────────────────────────────────────────────────────────────

export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  baseCurrency: text("base_currency").notNull(),
  targetCurrency: text("target_currency").notNull(),
  buyRate: real("buy_rate"),
  sellRate: real("sell_rate"),
  effectiveRate: real("effective_rate").notNull(),
  source: text("source").notNull().default("tcmb"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ updatedAt: true });
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;

// ─── FLEET GROUPING ────────────────────────────────────────────────────────────

export const fleets = pgTable("fleets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#2563EB"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fleetVessels = pgTable("fleet_vessels", {
  fleetId: integer("fleet_id").notNull().references(() => fleets.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.fleetId, t.vesselId] }),
}));

export const fleetsRelations = relations(fleets, ({ one, many }) => ({
  user: one(users, { fields: [fleets.userId], references: [users.id] }),
  fleetVessels: many(fleetVessels),
}));

export const fleetVesselsRelations = relations(fleetVessels, ({ one }) => ({
  fleet: one(fleets, { fields: [fleetVessels.fleetId], references: [fleets.id] }),
  vessel: one(vessels, { fields: [fleetVessels.vesselId], references: [vessels.id] }),
}));

export const insertFleetSchema = createInsertSchema(fleets).omit({ createdAt: true });
export type InsertFleet = z.infer<typeof insertFleetSchema>;
export type Fleet = typeof fleets.$inferSelect;

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userCreatedIdx: index("audit_logs_user_created_idx").on(t.userId, t.createdAt),
  entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({
  createdAt: true, updatedAt: true,
  isFeatured: true, featuredUntil: true,
  isActive: true, isApproved: true,
  verificationStatus: true, verificationRequestedAt: true,
  verificationApprovedAt: true, verificationNote: true,
});

// ─── STATEMENT OF FACTS (SOF) ─────────────────────────────────────────────────

export const statementOfFacts = pgTable("statement_of_facts", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").references(() => vessels.id),
  portId: integer("port_id").references(() => ports.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselName: varchar("vessel_name", { length: 200 }),
  portName: varchar("port_name", { length: 200 }),
  berthName: varchar("berth_name", { length: 200 }),
  cargoType: varchar("cargo_type", { length: 200 }),
  cargoQuantity: varchar("cargo_quantity", { length: 100 }),
  operation: varchar("operation", { length: 50 }),
  masterName: varchar("master_name", { length: 200 }),
  agentName: varchar("agent_name", { length: 200 }),
  status: varchar("status", { length: 20 }).default("draft"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  finalizedAt: timestamp("finalized_at"),
});

export const sofLineItems = pgTable("sof_line_items", {
  id: serial("id").primaryKey(),
  sofId: integer("sof_id").notNull().references(() => statementOfFacts.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventName: varchar("event_name", { length: 300 }).notNull(),
  eventDate: timestamp("event_date").notNull(),
  remarks: text("remarks"),
  isDeductible: boolean("is_deductible").default(false),
  deductibleHours: real("deductible_hours").default(0),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sofRelations = relations(statementOfFacts, ({ one, many }) => ({
  voyage: one(voyages, { fields: [statementOfFacts.voyageId], references: [voyages.id] }),
  vessel: one(vessels, { fields: [statementOfFacts.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [statementOfFacts.portId], references: [ports.id] }),
  user: one(users, { fields: [statementOfFacts.userId], references: [users.id] }),
  events: many(sofLineItems),
}));

export const sofLineItemRelations = relations(sofLineItems, ({ one }) => ({
  sof: one(statementOfFacts, { fields: [sofLineItems.sofId], references: [statementOfFacts.id] }),
}));

export const insertSofSchema = createInsertSchema(statementOfFacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSofLineItemSchema = createInsertSchema(sofLineItems).omit({ id: true, createdAt: true });
export type InsertSof = z.infer<typeof insertSofSchema>;
export type InsertSofLineItem = z.infer<typeof insertSofLineItemSchema>;
export type Sof = typeof statementOfFacts.$inferSelect;
export type SofLineItem = typeof sofLineItems.$inferSelect;

// ─── FDA - FINAL DISBURSEMENT ACCOUNT ─────────────────────────────────────────

export interface FdaLineItem {
  id: string;
  description: string;
  category: string;
  estimatedUsd: number;
  estimatedEur: number;
  actualUsd: number;
  actualEur: number;
  varianceUsd: number;
  variancePercent: number;
  receiptUrl?: string;
  remarks?: string;
}

export const fdaAccounts = pgTable("fda_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  proformaId: integer("proforma_id").references(() => proformas.id),
  voyageId: integer("voyage_id").references(() => voyages.id),
  vesselId: integer("vessel_id").references(() => vessels.id),
  portId: integer("port_id").references(() => ports.id),
  referenceNumber: varchar("reference_number", { length: 50 }),
  vesselName: varchar("vessel_name", { length: 200 }),
  portName: varchar("port_name", { length: 200 }),
  lineItems: jsonb("line_items").default([]),
  totalEstimatedUsd: real("total_estimated_usd").default(0),
  totalActualUsd: real("total_actual_usd").default(0),
  totalEstimatedEur: real("total_estimated_eur").default(0),
  totalActualEur: real("total_actual_eur").default(0),
  varianceUsd: real("variance_usd").default(0),
  variancePercent: real("variance_percent").default(0),
  exchangeRate: real("exchange_rate"),
  status: varchar("status", { length: 20 }).default("draft"),
  notes: text("notes"),
  bankDetails: jsonb("bank_details"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fdaRelations = relations(fdaAccounts, ({ one }) => ({
  user: one(users, { fields: [fdaAccounts.userId], references: [users.id] }),
  proforma: one(proformas, { fields: [fdaAccounts.proformaId], references: [proformas.id] }),
  voyage: one(voyages, { fields: [fdaAccounts.voyageId], references: [voyages.id] }),
  vessel: one(vessels, { fields: [fdaAccounts.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [fdaAccounts.portId], references: [ports.id] }),
}));

export const insertFdaSchema = createInsertSchema(fdaAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFda = z.infer<typeof insertFdaSchema>;
export type Fda = typeof fdaAccounts.$inferSelect;

// ─── NOTICE OF READINESS ──────────────────────────────────────────────────────

export const noticeOfReadiness = pgTable("notice_of_readiness", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").references(() => vessels.id),
  portId: integer("port_id").references(() => ports.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselName: varchar("vessel_name", { length: 200 }),
  portName: varchar("port_name", { length: 200 }),
  masterName: varchar("master_name", { length: 200 }),
  agentName: varchar("agent_name", { length: 200 }),
  chartererName: varchar("charterer_name", { length: 200 }),
  cargoType: varchar("cargo_type", { length: 200 }),
  cargoQuantity: varchar("cargo_quantity", { length: 100 }),
  operation: varchar("operation", { length: 50 }),
  anchorageArrival: timestamp("anchorage_arrival"),
  berthArrival: timestamp("berth_arrival"),
  norTenderedAt: timestamp("nor_tendered_at"),
  norTenderedTo: varchar("nor_tendered_to", { length: 300 }),
  norAcceptedAt: timestamp("nor_accepted_at"),
  norAcceptedBy: varchar("nor_accepted_by", { length: 200 }),
  laytimeStartsAt: timestamp("laytime_starts_at"),
  readyTo: jsonb("ready_to").$type<string[]>(),
  conditions: jsonb("conditions").$type<string[]>(),
  berthName: varchar("berth_name", { length: 200 }),
  remarks: text("remarks"),
  status: varchar("status", { length: 20 }).default("draft"),
  rejectionReason: text("rejection_reason"),
  signatureMaster: text("signature_master"),
  signatureAgent: text("signature_agent"),
  signatureCharterer: text("signature_charterer"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNorSchema = z.object({
  voyageId: z.number().int().optional().nullable(),
  vesselId: z.number().int().optional().nullable(),
  portId: z.number().int().optional().nullable(),
  userId: z.string(),
  vesselName: z.string().max(200).optional().nullable(),
  portName: z.string().max(200).optional().nullable(),
  masterName: z.string().max(200).optional().nullable(),
  agentName: z.string().max(200).optional().nullable(),
  chartererName: z.string().max(200).optional().nullable(),
  cargoType: z.string().max(200).optional().nullable(),
  cargoQuantity: z.string().max(100).optional().nullable(),
  operation: z.string().max(50).optional().nullable(),
  anchorageArrival: z.coerce.date().optional().nullable(),
  berthArrival: z.coerce.date().optional().nullable(),
  norTenderedAt: z.coerce.date().optional().nullable(),
  norTenderedTo: z.string().max(300).optional().nullable(),
  norAcceptedAt: z.coerce.date().optional().nullable(),
  norAcceptedBy: z.string().max(200).optional().nullable(),
  laytimeStartsAt: z.coerce.date().optional().nullable(),
  readyTo: z.array(z.string()).optional().nullable(),
  conditions: z.array(z.string()).optional().nullable(),
  berthName: z.string().max(200).optional().nullable(),
  remarks: z.string().optional().nullable(),
  status: z.string().max(20).optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  signatureMaster: z.string().optional().nullable(),
  signatureAgent: z.string().optional().nullable(),
  signatureCharterer: z.string().optional().nullable(),
});
export type InsertNor = z.infer<typeof insertNorSchema>;
export type Nor = typeof noticeOfReadiness.$inferSelect;

// ─── ORGANIZATION / TEAM MANAGEMENT ──────────────────────────────────────────

export interface OrgPermissions {
  canCreateProforma?: boolean;
  canApproveProforma?: boolean;
  canCreateTender?: boolean;
  canManageVoyages?: boolean;
  canManageVessels?: boolean;
  canViewFinance?: boolean;
  canManageTeam?: boolean;
  canSendMessages?: boolean;
}

export const DEFAULT_ORG_PERMISSIONS: Record<string, OrgPermissions> = {
  owner:   { canCreateProforma: true, canApproveProforma: true, canCreateTender: true, canManageVoyages: true, canManageVessels: true, canViewFinance: true, canManageTeam: true, canSendMessages: true },
  admin:   { canCreateProforma: true, canApproveProforma: true, canCreateTender: true, canManageVoyages: true, canManageVessels: true, canViewFinance: true, canManageTeam: true, canSendMessages: true },
  manager: { canCreateProforma: true, canApproveProforma: false, canCreateTender: true, canManageVoyages: true, canManageVessels: true, canViewFinance: false, canManageTeam: false, canSendMessages: true },
  member:  { canCreateProforma: true, canApproveProforma: false, canCreateTender: false, canManageVoyages: true, canManageVessels: false, canViewFinance: false, canManageTeam: false, canSendMessages: true },
  viewer:  { canCreateProforma: false, canApproveProforma: false, canCreateTender: false, canManageVoyages: false, canManageVessels: false, canViewFinance: false, canManageTeam: false, canSendMessages: false },
};

export const chamberOfShippingFees = pgTable("chamber_of_shipping_fees", {
  id: serial("id").primaryKey(),
  portId: integer("port_id"),
  serviceType: varchar("service_type"),
  vesselCategory: varchar("vessel_category"),
  gtMin: integer("gt_min"),
  gtMax: integer("gt_max"),
  fee: real("fee"),
  flagCategory: varchar("flag_category"),
  currency: varchar("currency"),
  validYear: integer("valid_year"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const lightDues = pgTable("light_dues", {
  id: serial("id").primaryKey(),
  portId: integer("port_id"),
  serviceType: varchar("service_type"),
  vesselCategory: varchar("vessel_category"),
  gtMin: integer("gt_min"),
  gtMax: integer("gt_max"),
  fee: real("fee"),
  currency: varchar("currency"),
  validYear: integer("valid_year"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  serviceDesc: varchar("service_desc"),
  rateUpTo800: real("rate_up_to_800"),
  rateAbove800: real("rate_above_800"),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  type: text("type").default("other"),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  logoUrl: text("logo_url"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  country: text("country"),
  taxId: text("tax_id"),
  subscriptionPlan: text("subscription_plan").default("free"),
  maxMembers: integer("max_members").default(5),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  displayName: text("display_name"),
  department: text("department"),
  jobTitle: text("job_title"),
  permissions: jsonb("permissions").$type<OrgPermissions>().default({}),
  invitedBy: varchar("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  roleId: integer("role_id"),
});

export const organizationInvites = pgTable("organization_invites", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"),
  token: text("token").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  invites: many(organizationInvites),
}));

export const orgMemberRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
}));

export const orgInviteRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, { fields: [organizationInvites.organizationId], references: [organizations.id] }),
}));

export const insertOrgSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().optional(),
  logoUrl: z.string().optional(),
  industry: z.string().optional(),
  maxMembers: z.number().int().optional(),
});

export const insertOrgInviteSchema = z.object({
  email: z.string().email(),
  orgRole: z.string().default("member"),
  role: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
});

export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type InsertOrgInvite = z.infer<typeof insertOrgInviteSchema>;

// ==================== VESSEL Q88 ====================

export interface HoldDetail {
  holdNumber: number;
  length: number;
  breadth: number;
  depth: number;
  grainCapacity?: number;
  baleCapacity?: number;
}

export const vesselQ88 = pgTable("vessel_q88", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),

  // Section 1: General Information
  vesselName: varchar("vessel_name", { length: 200 }),
  exName: varchar("ex_name", { length: 200 }),
  flag: varchar("flag", { length: 100 }),
  portOfRegistry: varchar("port_of_registry", { length: 200 }),
  imoNumber: varchar("imo_number", { length: 20 }),
  callSign: varchar("call_sign", { length: 20 }),
  mmsiNumber: varchar("mmsi_number", { length: 20 }),
  vesselType: varchar("vessel_type", { length: 100 }),
  yearBuilt: integer("year_built"),
  builder: varchar("builder", { length: 200 }),
  classificationSociety: varchar("classification_society", { length: 200 }),
  classNotation: varchar("class_notation", { length: 200 }),
  piClub: varchar("pi_club", { length: 200 }),
  hullMaterial: varchar("hull_material", { length: 50 }).default("Steel"),

  // Section 2: Dimensions & Tonnage
  grt: real("grt"),
  nrt: real("nrt"),
  dwt: real("dwt"),
  displacement: real("displacement"),
  loa: real("loa"),
  lbp: real("lbp"),
  beam: real("beam"),
  depth: real("depth"),
  maxDraft: real("max_draft"),
  summerDraft: real("summer_draft"),
  tpc: real("tpc"),
  lightShipWeight: real("light_ship_weight"),
  grainCapacity: real("grain_capacity"),
  baleCapacity: real("bale_capacity"),

  // Section 3: Hold & Hatch Details
  numberOfHolds: integer("number_of_holds"),
  numberOfHatches: integer("number_of_hatches"),
  holdDimensions: jsonb("hold_dimensions").$type<HoldDetail[]>().default([]),
  hatchType: varchar("hatch_type", { length: 100 }),
  hatchCovers: varchar("hatch_covers", { length: 200 }),

  // Section 4: Cargo Gear
  numberOfCranes: integer("number_of_cranes"),
  craneCapacity: varchar("crane_capacity", { length: 200 }),
  numberOfDerricks: integer("number_of_derricks"),
  derrickCapacity: varchar("derrick_capacity", { length: 200 }),
  grabsAvailable: boolean("grabs_available").default(false),
  grabCapacity: varchar("grab_capacity", { length: 100 }),
  cargoGearDetails: text("cargo_gear_details"),

  // Section 5: Engine & Speed
  mainEngine: varchar("main_engine", { length: 200 }),
  enginePower: varchar("engine_power", { length: 100 }),
  serviceSpeed: real("service_speed"),
  maxSpeed: real("max_speed"),
  fuelType: varchar("fuel_type", { length: 100 }),
  fuelConsumption: varchar("fuel_consumption", { length: 200 }),
  auxiliaryEngines: varchar("auxiliary_engines", { length: 200 }),
  bowThruster: boolean("bow_thruster").default(false),
  bowThrusterPower: varchar("bow_thruster_power", { length: 100 }),

  // Section 6: Tank Capacities
  heavyFuelCapacity: real("heavy_fuel_capacity"),
  dieselOilCapacity: real("diesel_oil_capacity"),
  freshWaterCapacity: real("fresh_water_capacity"),
  ballastCapacity: real("ballast_capacity"),

  // Section 7: Communication & Navigation
  communicationEquipment: jsonb("communication_equipment").$type<string[]>().default([]),
  navigationEquipment: jsonb("navigation_equipment").$type<string[]>().default([]),

  // Section 8: Safety
  lifeboats: varchar("lifeboats", { length: 200 }),
  lifeRafts: varchar("life_rafts", { length: 200 }),
  fireExtinguishing: varchar("fire_extinguishing", { length: 300 }),

  // Section 9: Crew
  crewCapacity: integer("crew_capacity"),
  officerCabins: integer("officer_cabins"),
  crewCabins: integer("crew_cabins"),

  // Section 10: Certificates
  certificatesOnBoard: jsonb("certificates_on_board").$type<string[]>().default([]),

  // Section 11: Special Equipment
  specialEquipment: text("special_equipment"),
  iceClass: varchar("ice_class", { length: 50 }),
  fittedForHeavyLifts: boolean("fitted_for_heavy_lifts").default(false),
  co2Fitted: boolean("co2_fitted").default(false),

  // Meta
  lastUpdated: timestamp("last_updated").defaultNow(),
  isPublic: boolean("is_public").default(false),
  version: integer("version").default(1),
  status: varchar("status", { length: 20 }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const q88Relations = relations(vesselQ88, ({ one }) => ({
  vessel: one(vessels, { fields: [vesselQ88.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [vesselQ88.userId], references: [users.id] }),
}));

export const insertQ88Schema = createInsertSchema(vesselQ88).omit({ id: true, createdAt: true });
export type VesselQ88 = typeof vesselQ88.$inferSelect;
export type InsertVesselQ88 = z.infer<typeof insertQ88Schema>;
