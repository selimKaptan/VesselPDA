export * from "./models/auth";

import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, serial } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

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
});

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
  fileBase64: text("file_base64").notNull(),
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
});

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
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselCrewRelations = relations(vesselCrew, ({ one }) => ({
  vessel: one(vessels, { fields: [vesselCrew.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [vesselCrew.userId], references: [users.id] }),
}));

export const insertVesselCrewSchema = createInsertSchema(vesselCrew).omit({ id: true, createdAt: true });
export type InsertVesselCrew = z.infer<typeof insertVesselCrewSchema>;
export type VesselCrew = typeof vesselCrew.$inferSelect;
