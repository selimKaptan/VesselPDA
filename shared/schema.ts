export * from "./models/auth";

import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, serial, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "./models/auth";

export const vessels = pgTable("vessels", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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
}, (t) => ({
  userIdIdx: index("vessels_user_id_idx").on(t.userId),
}));

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
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("proformas_user_id_idx").on(t.userId),
  portIdIdx: index("proformas_port_id_idx").on(t.portId),
  statusIdx: index("proformas_status_idx").on(t.status),
}));

export const proformaRelations = relations(proformas, ({ one }) => ({
  user: one(users, { fields: [proformas.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [proformas.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [proformas.portId], references: [ports.id] }),
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
}, (t) => ({
  categoryActivityIdx: index("forum_topics_category_activity_idx").on(t.categoryId, t.lastActivityAt),
}));

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

export const insertVesselSchema = createInsertSchema(vessels).omit({ id: true, createdAt: true });
export const insertPortSchema = createInsertSchema(ports).omit({ id: true, createdAt: true });
export const insertTariffCategorySchema = createInsertSchema(tariffCategories).omit({ id: true });
export const insertTariffRateSchema = createInsertSchema(tariffRates).omit({ id: true });
export const insertProformaSchema = createInsertSchema(proformas).omit({ id: true, createdAt: true });

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

export const insertForumCategorySchema = createInsertSchema(forumCategories).omit({ id: true, createdAt: true });
export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({ id: true, createdAt: true, lastActivityAt: true, viewCount: true, replyCount: true, likeCount: true, isPinned: true, isLocked: true });
export const insertForumReplySchema = createInsertSchema(forumReplies).omit({ id: true, createdAt: true, likeCount: true });

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
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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
}, (t) => ({
  statusCreatedIdx: index("port_tenders_status_created_idx").on(t.status, t.createdAt),
}));

export const tenderBids = pgTable("tender_bids", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
  tenderId: integer("tender_id").notNull().references(() => portTenders.id),
  agentUserId: varchar("agent_user_id").notNull().references(() => users.id),
  agentCompanyId: integer("agent_company_id").references(() => companyProfiles.id),
  proformaPdfBase64: text("proforma_pdf_base64"),
  notes: text("notes"),
  totalAmount: text("total_amount"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  tenderAgentIdx: index("tender_bids_tender_agent_idx").on(t.tenderId, t.agentUserId),
}));

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

export const insertPortTenderSchema = createInsertSchema(portTenders).omit({ id: true, createdAt: true, nominatedAt: true, nominatedAgentId: true, status: true });
export const insertTenderBidSchema = createInsertSchema(tenderBids).omit({ id: true, createdAt: true, status: true });

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

export const insertAgentReviewSchema = createInsertSchema(agentReviews).omit({ id: true, createdAt: true });
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

export const insertVesselWatchlistSchema = createInsertSchema(vesselWatchlist).omit({ id: true, addedAt: true });
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
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ id: true, createdAt: true });
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
}, (t) => ({
  userIsReadIdx: index("notifications_user_is_read_idx").on(t.userId, t.isRead),
  createdAtIdx: index("notifications_created_at_idx").on(t.createdAt),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true, isRead: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ─── VOYAGES (SEFER YÖNETİMİ) ─────────────────────────────────────────────────

export const voyages = pgTable("voyages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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
}, (t) => ({
  userIdIdx: index("voyages_user_id_idx").on(t.userId),
  portIdIdx: index("voyages_port_id_idx").on(t.portId),
  statusIdx: index("voyages_status_idx").on(t.status),
  etaIdx: index("voyages_eta_idx").on(t.eta),
}));

export const voyageRelations = relations(voyages, ({ one, many }) => ({
  user: one(users, { fields: [voyages.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [voyages.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [voyages.portId], references: [ports.id] }),
  tender: one(portTenders, { fields: [voyages.tenderId], references: [portTenders.id] }),
  checklists: many(voyageChecklists),
  serviceRequests: many(serviceRequests),
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

// ─── SERVICE REQUESTS (HİZMET TALEPLERİ) ─────────────────────────────────────

export const serviceRequests = pgTable("service_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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
}, (t) => ({
  statusPortIdx: index("service_requests_status_port_idx").on(t.status, t.portId),
}));

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
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
  user1Id: varchar("user1_id").notNull().references(() => users.id),
  user2Id: varchar("user2_id").notNull().references(() => users.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  externalEmail: text("external_email"),
  externalEmailName: text("external_email_name"),
  externalEmailForward: boolean("external_email_forward").notNull().default(false),
}, (t) => ({
  user1Idx: index("conversations_user1_idx").on(t.user1Id),
  user2Idx: index("conversations_user2_idx").on(t.user2Id),
}));

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
}, (t) => ({
  convCreatedIdx: index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

// ─── DIRECT NOMINATIONS ───────────────────────────────────────────────────────

export const directNominations = pgTable("direct_nominations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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

export const insertVoyageSchema = createInsertSchema(voyages).omit({ id: true, createdAt: true });
export const insertVoyageChecklistSchema = createInsertSchema(voyageChecklists).omit({ id: true, createdAt: true, isCompleted: true, completedAt: true });
export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ id: true, createdAt: true, status: true });
export const insertServiceOfferSchema = createInsertSchema(serviceOffers).omit({ id: true, createdAt: true, status: true });
export const insertVoyageDocumentSchema = createInsertSchema(voyageDocuments).omit({ id: true, createdAt: true });
export const insertVoyageReviewSchema = createInsertSchema(voyageReviews).omit({ id: true, createdAt: true });
export const insertVoyageChatMessageSchema = createInsertSchema(voyageChatMessages).omit({ id: true, createdAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, lastMessageAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, isRead: true, readAt: true });

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

export const insertDirectNominationSchema = createInsertSchema(directNominations).omit({ id: true, createdAt: true, status: true, respondedAt: true });
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

export const insertEndorsementSchema = createInsertSchema(endorsements).omit({ id: true, createdAt: true });
export type InsertEndorsement = z.infer<typeof insertEndorsementSchema>;
export type Endorsement = typeof endorsements.$inferSelect;

// ─── VESSEL CERTIFICATES ────────────────────────────────────────────────────

export const vesselCertificates = pgTable("vessel_certificates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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

export const insertVesselCertificateSchema = createInsertSchema(vesselCertificates).omit({ id: true, createdAt: true, status: true });
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

export const insertPortCallAppointmentSchema = createInsertSchema(portCallAppointments).omit({ id: true, createdAt: true });
export type InsertPortCallAppointment = z.infer<typeof insertPortCallAppointmentSchema>;
export type PortCallAppointment = typeof portCallAppointments.$inferSelect;

// ─── FIXTURES ───────────────────────────────────────────────────────────────

export const fixtures = pgTable("fixtures", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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

export const insertFixtureSchema = createInsertSchema(fixtures).omit({ id: true, createdAt: true, status: true });
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

export const insertLaytimeSchema = createInsertSchema(laytimeCalculations).omit({ id: true, createdAt: true, timeUsedHours: true, demurrageAmount: true, despatchAmount: true });
export type InsertLaytime = z.infer<typeof insertLaytimeSchema>;
export type LaytimeCalculation = typeof laytimeCalculations.$inferSelect;

// ─── CARGO POSITIONS ────────────────────────────────────────────────────────

export const cargoPositions = pgTable("cargo_positions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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

export const insertCargoPositionSchema = createInsertSchema(cargoPositions).omit({ id: true, createdAt: true, status: true });
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

export const insertBunkerPriceSchema = createInsertSchema(bunkerPrices).omit({ id: true });
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

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, createdAt: true });
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// ─── INVOICES ────────────────────────────────────────────────────────────────

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  creatorStatusIdx: index("invoices_creator_status_idx").on(t.createdByUserId, t.status),
}));

export const invoiceRelations = relations(invoices, ({ one }) => ({
  voyage: one(voyages, { fields: [invoices.voyageId], references: [voyages.id] }),
  proforma: one(proformas, { fields: [invoices.proformaId], references: [proformas.id] }),
  creator: one(users, { fields: [invoices.createdByUserId], references: [users.id] }),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, status: true });
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

export const insertPortAlertSchema = createInsertSchema(portAlerts).omit({ id: true, createdAt: true });
export type InsertPortAlert = z.infer<typeof insertPortAlertSchema>;
export type PortAlert = typeof portAlerts.$inferSelect;

// ── Vessel Crew ──────────────────────────────────────────────────────────────
export const vesselCrew = pgTable("vessel_crew", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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
  seamansBookFileBase64: text("seamans_book_file_base64"),
  seamansBookFileName: text("seamans_book_file_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselCrewRelations = relations(vesselCrew, ({ one }) => ({
  vessel: one(vessels, { fields: [vesselCrew.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [vesselCrew.userId], references: [users.id] }),
}));

export const insertVesselCrewSchema = createInsertSchema(vesselCrew).omit({ id: true, createdAt: true });
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

export const insertVesselPositionSchema = createInsertSchema(vesselPositions).omit({ id: true, timestamp: true });
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
}, (t) => ({
  userCheckedIdx: index("sanctions_checks_user_checked_idx").on(t.userId, t.checkedAt),
}));

export const sanctionsChecksRelations = relations(sanctionsChecks, ({ one }) => ({
  user: one(users, { fields: [sanctionsChecks.userId], references: [users.id] }),
}));

export const insertSanctionsCheckSchema = createInsertSchema(sanctionsChecks).omit({ id: true, checkedAt: true });
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

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ id: true, updatedAt: true });
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;

// ─── FLEET GROUPING ────────────────────────────────────────────────────────────

export const fleets = pgTable("fleets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").references((): any => organizations.id, { onDelete: "set null" }),
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

export const insertFleetSchema = createInsertSchema(fleets).omit({ id: true, createdAt: true });
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

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ─── NOTIFICATION PREFERENCES ─────────────────────────────────────────────────
export const notificationPreferences = pgTable("notification_preferences", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailOnNewTender:        boolean("email_on_new_tender").notNull().default(true),
  emailOnBidReceived:      boolean("email_on_bid_received").notNull().default(true),
  emailOnNomination:       boolean("email_on_nomination").notNull().default(true),
  emailOnMessage:          boolean("email_on_message").notNull().default(false),
  emailOnForumReply:       boolean("email_on_forum_reply").notNull().default(false),
  emailOnCertificateExpiry:boolean("email_on_certificate_expiry").notNull().default(true),
  emailOnVoyageUpdate:     boolean("email_on_voyage_update").notNull().default(true),
  pushEnabled:             boolean("push_enabled").notNull().default(true),
  dailyDigest:             boolean("daily_digest").notNull().default(false),
  updatedAt:               timestamp("updated_at").defaultNow(),
});

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

// ─── ORGANIZATIONS ─────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  type: text("type").notNull().default("other"),
  logoUrl: text("logo_url"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  country: text("country"),
  taxId: text("tax_id"),
  subscriptionPlan: text("subscription_plan").notNull().default("free"),
  maxMembers: integer("max_members").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  displayName: text("display_name"),
  department: text("department"),
  jobTitle: text("job_title"),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
  invitedBy: varchar("invited_by").references(() => users.id),
});

export const organizationInvites = pgTable("organization_invites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(organizationMembers),
  invites: many(organizationInvites),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, { fields: [organizationInvites.organizationId], references: [organizations.id] }),
  invitedBy: one(users, { fields: [organizationInvites.invitedByUserId], references: [users.id] }),
}));

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, ownerId: true });
export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({ id: true, joinedAt: true });
export const insertOrganizationInviteSchema = createInsertSchema(organizationInvites).omit({ id: true, createdAt: true });

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type OrganizationInvite = typeof organizationInvites.$inferSelect;

// ─── ORGANIZATION ROLES ────────────────────────────────────────────────────────

export interface OrgPermissions {
  vessels:      { view: boolean; create: boolean; edit: boolean; delete: boolean };
  voyages:      { view: boolean; create: boolean; edit: boolean; delete: boolean };
  proformas:    { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean; send: boolean };
  invoices:     { view: boolean; create: boolean; edit: boolean; delete: boolean; pay: boolean };
  tenders:      { view: boolean; create: boolean; bid: boolean; nominate: boolean };
  documents:    { view: boolean; upload: boolean; delete: boolean; sign: boolean };
  messages:     { view: boolean; send: boolean };
  fixtures:     { view: boolean; create: boolean; edit: boolean };
  crew:         { view: boolean; manage: boolean };
  certificates: { view: boolean; manage: boolean };
  reports:      { view: boolean; export: boolean };
  settings:     { view: boolean; manage: boolean };
  members:      { view: boolean; invite: boolean; remove: boolean; editRoles: boolean };
}

export const organizationRoles = pgTable("organization_roles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3B82F6"),
  isDefault: boolean("is_default").notNull().default(false),
  isOwnerRole: boolean("is_owner_role").notNull().default(false),
  permissions: jsonb("permissions").notNull().$type<OrgPermissions>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationRolesRelations = relations(organizationRoles, ({ one }) => ({
  organization: one(organizations, { fields: [organizationRoles.organizationId], references: [organizations.id] }),
}));

export type OrganizationRole = typeof organizationRoles.$inferSelect;
export type InsertOrganizationRole = typeof organizationRoles.$inferInsert;

// ─── ORGANIZATION ACTIVITY FEED ───────────────────────────────────────────────

export const organizationActivityFeed = pgTable("organization_activity_feed", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationActivityFeedRelations = relations(organizationActivityFeed, ({ one }) => ({
  organization: one(organizations, { fields: [organizationActivityFeed.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationActivityFeed.userId], references: [users.id] }),
}));

export type OrgActivityFeedEntry = typeof organizationActivityFeed.$inferSelect;
export type InsertOrgActivityFeedEntry = typeof organizationActivityFeed.$inferInsert;

// ─── TEAM CHAT ────────────────────────────────────────────────────────────────

export const teamChannels = pgTable("team_channels", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  channelType: text("channel_type").notNull().default("public"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamChannelMembers = pgTable("team_channel_members", {
  channelId: integer("channel_id").notNull().references(() => teamChannels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.channelId, t.userId] }) }));

export const teamMessages = pgTable("team_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => teamChannels.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  isEdited: boolean("is_edited").notNull().default(false),
  replyToId: integer("reply_to_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamChannelsRelations = relations(teamChannels, ({ one, many }) => ({
  organization: one(organizations, { fields: [teamChannels.organizationId], references: [organizations.id] }),
  createdBy: one(users, { fields: [teamChannels.createdByUserId], references: [users.id] }),
  messages: many(teamMessages),
  members: many(teamChannelMembers),
}));

export const teamChannelMembersRelations = relations(teamChannelMembers, ({ one }) => ({
  channel: one(teamChannels, { fields: [teamChannelMembers.channelId], references: [teamChannels.id] }),
  user: one(users, { fields: [teamChannelMembers.userId], references: [users.id] }),
}));

export const teamMessagesRelations = relations(teamMessages, ({ one }) => ({
  channel: one(teamChannels, { fields: [teamMessages.channelId], references: [teamChannels.id] }),
  sender: one(users, { fields: [teamMessages.senderId], references: [users.id] }),
  replyTo: one(teamMessages, { fields: [teamMessages.replyToId], references: [teamMessages.id] }),
}));

export type TeamChannel = typeof teamChannels.$inferSelect;
export type InsertTeamChannel = typeof teamChannels.$inferInsert;
export type TeamMessage = typeof teamMessages.$inferSelect;
export type InsertTeamMessage = typeof teamMessages.$inferInsert;
