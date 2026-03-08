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
  mmsi: text("mmsi"),
  callSign: text("call_sign"),
  yearBuilt: integer("year_built"),
  fleetStatus: text("fleet_status").default("idle"),
  datalasticUuid: text("datalastic_uuid"),
  enginePower: real("engine_power"),
  engineType: text("engine_type"),
  classificationSociety: text("classification_society"),
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
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const proformaRelations = relations(proformas, ({ one, many }) => ({
  user: one(users, { fields: [proformas.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [proformas.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [proformas.portId], references: [ports.id] }),
  voyage: one(voyages, { fields: [proformas.voyageId], references: [voyages.id] }),
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
  category?: string;
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

export const portCalls = pgTable("port_calls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  portName: text("port_name").notNull(),
  berth: text("berth"),
  agentName: text("agent_name"),
  eta: timestamp("eta"),
  actualArrival: timestamp("actual_arrival"),
  norTendered: timestamp("nor_tendered"),
  berthingTime: timestamp("berthing_time"),
  operationsStart: timestamp("operations_start"),
  operationsEnd: timestamp("operations_end"),
  departure: timestamp("departure"),
  cargoType: text("cargo_type"),
  cargoQuantity: real("cargo_quantity"),
  cargoUnit: text("cargo_unit").default("MT"),
  status: text("status").notNull().default("expected"), // expected | arrived | in_port | operations | departed | closed
  pilotArranged: boolean("pilot_arranged").default(false),
  tugArranged: boolean("tug_arranged").default(false),
  customsCleared: boolean("customs_cleared").default(false),
  pdaIssued: boolean("pda_issued").default(false),
  fdaIssued: boolean("fda_issued").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portCallRelations = relations(portCalls, ({ one }) => ({
  voyage: one(voyages, { fields: [portCalls.voyageId], references: [voyages.id] }),
  vessel: one(vessels, { fields: [portCalls.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [portCalls.userId], references: [users.id] }),
}));

// ─── PORT CALLS (Agent Module) ─────────────────────────────────────────────

export const insertPortCallSchema = createInsertSchema(portCalls).omit({ id: true, createdAt: true });
export type InsertPortCall = z.infer<typeof insertPortCallSchema>;
export type PortCall = typeof portCalls.$inferSelect;

// ─── PORT CALL PARTICIPANTS ───────────────────────────────────────────────────

export const portCallParticipants = pgTable("port_call_participants", {
  id: serial("id").primaryKey(),
  portCallId: integer("port_call_id").notNull().references(() => portCalls.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 300 }),
  role: varchar("role", { length: 50 }).notNull(),
  company: varchar("company", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  inviteStatus: varchar("invite_status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portCallParticipantRelations = relations(portCallParticipants, ({ one }) => ({
  portCall: one(portCalls, { fields: [portCallParticipants.portCallId], references: [portCalls.id] }),
}));

export const insertPortCallParticipantSchema = createInsertSchema(portCallParticipants).omit({ id: true, createdAt: true });
export type InsertPortCallParticipant = z.infer<typeof insertPortCallParticipantSchema>;
export type PortCallParticipant = typeof portCallParticipants.$inferSelect;

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

export const portExpenses = pgTable("port_expenses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  fdaId: integer("fda_id").references(() => fdaAccounts.id, { onDelete: "set null" }),
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  // "port_dues" | "pilotage" | "towage" | "agency_fee" | "mooring" | "anchorage" | 
  // "launch_hire" | "garbage" | "fresh_water" | "bunker" | "survey" | "customs" | "other"
  description: text("description"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  amountUsd: real("amount_usd"),
  receiptNumber: text("receipt_number"),
  vendor: text("vendor"),
  expenseDate: timestamp("expense_date"),
  isPaid: boolean("is_paid").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortExpenseSchema = createInsertSchema(portExpenses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortExpense = z.infer<typeof insertPortExpenseSchema>;
export type PortExpense = typeof portExpenses.$inferSelect;

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  emailOnProformaApproval: boolean("email_on_proforma_approval").default(true),
  emailOnFdaReady: boolean("email_on_fda_ready").default(true),
  emailOnInvoiceCreated: boolean("email_on_invoice_created").default(true),
  emailOnDaAdvance: boolean("email_on_da_advance").default(true),
  emailOnCertExpiry: boolean("email_on_cert_expiry").default(true),
  emailOnNewMessage: boolean("email_on_new_message").default(true),
  emailOnVoyageUpdate: boolean("email_on_voyage_update").default(false),
  emailOnInvoiceDue: boolean("email_on_invoice_due").default(true),
  emailOnCertificateExpiry: boolean("email_on_certificate_expiry").default(true),
  emailOnDaAdvanceDue: boolean("email_on_da_advance_due").default(true),
  emailOnPaymentReceived: boolean("email_on_payment_received").default(true),
  inAppOnAll: boolean("in_app_on_all").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const notificationPreferenceRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ createdAt: true, isRead: true });
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({ id: true, updatedAt: true });
export const fdaMappingTemplates = pgTable("fda_mapping_templates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  mappings: jsonb("mappings").notNull().default([]).$type<{ pdaCategory: string; portExpenseCategory: string; note?: string }[]>(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fdaMappingTemplateRelations = relations(fdaMappingTemplates, ({ one }) => ({
  user: one(users, { fields: [fdaMappingTemplates.userId], references: [users.id] }),
}));

export const insertFdaMappingTemplateSchema = createInsertSchema(fdaMappingTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFdaMappingTemplate = z.infer<typeof insertFdaMappingTemplateSchema>;
export type FdaMappingTemplate = typeof fdaMappingTemplates.$inferSelect;

export const agentCommissions = pgTable("agent_commissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "cascade" }),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  commissionType: text("commission_type").notNull().default("percentage"), // "percentage" | "fixed"
  rate: real("rate"),          // % (ör. 2.5 = %2.5)
  fixedAmount: real("fixed_amount"),
  currency: text("currency").notNull().default("USD"),
  baseAmount: real("base_amount"), // komisyon hesaplanan temel tutar
  calculatedAmount: real("calculated_amount").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "invoiced" | "paid"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentCommissionRelations = relations(agentCommissions, ({ one }) => ({
  user: one(users, { fields: [agentCommissions.userId], references: [users.id] }),
  voyage: one(voyages, { fields: [agentCommissions.voyageId], references: [voyages.id] }),
  invoice: one(invoices, { fields: [agentCommissions.invoiceId], references: [invoices.id] }),
}));

export const insertAgentCommissionSchema = createInsertSchema(agentCommissions).omit({ id: true, createdAt: true });
export type InsertAgentCommission = z.infer<typeof insertAgentCommissionSchema>;
export type AgentCommission = typeof agentCommissions.$inferSelect;

export const voyageNotes = pgTable("voyage_notes", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  noteType: text("note_type").notNull().default("comment"), // "comment" | "observation" | "alert" | "milestone"
  isPrivate: boolean("is_private").default(false),
  linkedEntityType: text("linked_entity_type"), // "invoice" | "fda" | "proforma" | null
  linkedEntityId: integer("linked_entity_id"),
  mentions: text("mentions").array().default([]), // user IDs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const voyageNoteRelations = relations(voyageNotes, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageNotes.voyageId], references: [voyages.id] }),
  author: one(users, { fields: [voyageNotes.authorId], references: [users.id] }),
}));

export const insertVoyageNoteSchema = createInsertSchema(voyageNotes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVoyageNote = z.infer<typeof insertVoyageNoteSchema>;
export type VoyageNote = typeof voyageNotes.$inferSelect;

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
  cargoType: text("cargo_type"),
  cargoQuantity: real("cargo_quantity"),
  cargoTotalMt: real("cargo_total_mt"),
  completedAt: timestamp("completed_at"),
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
  proformas: many(proformas),
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

// ─── VOYAGE CARGO LOGS ────────────────────────────────────────────────────────

export const voyageCargoReceivers = pgTable("voyage_cargo_receivers", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  allocatedMt: real("allocated_mt").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageCargoReceiverRelations = relations(voyageCargoReceivers, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageCargoReceivers.voyageId], references: [voyages.id] }),
}));

export const insertVoyageCargoReceiverSchema = createInsertSchema(voyageCargoReceivers).omit({ id: true, createdAt: true });
export type InsertVoyageCargoReceiver = z.infer<typeof insertVoyageCargoReceiverSchema>;
export type VoyageCargoReceiver = typeof voyageCargoReceivers.$inferSelect;

export const voyageCargoLogs = pgTable("voyage_cargo_logs", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  logDate: timestamp("log_date"),
  shift: text("shift").default("morning"),
  fromTime: timestamp("from_time"),
  toTime: timestamp("to_time"),
  receiverId: integer("receiver_id").references(() => voyageCargoReceivers.id, { onDelete: "set null" }),
  amountHandled: real("amount_handled").notNull(),
  truckCount: integer("truck_count"),
  batchId: varchar("batch_id"),
  cumulativeTotal: real("cumulative_total"),
  logType: text("log_type").default("operation"),
  remarks: text("remarks"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageCargoLogRelations = relations(voyageCargoLogs, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageCargoLogs.voyageId], references: [voyages.id] }),
  receiver: one(voyageCargoReceivers, { fields: [voyageCargoLogs.receiverId], references: [voyageCargoReceivers.id] }),
}));

export const insertVoyageCargoLogSchema = createInsertSchema(voyageCargoLogs).omit({ id: true, createdAt: true });
export type InsertVoyageCargoLog = z.infer<typeof insertVoyageCargoLogSchema>;
export type VoyageCargoLog = typeof voyageCargoLogs.$inferSelect;

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
  renewalStatus: text("renewal_status").notNull().default("none"), // "none" | "scheduled" | "in_progress" | "renewed"
  renewalPlannedDate: timestamp("renewal_planned_date"),
  fileBase64: text("file_base64"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
  category: text("category").notNull().default("statutory"),
  vaultDocType: text("vault_doc_type"),
  reminderSentDays: text("reminder_sent_days"),
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

export const brokerCommissions = pgTable("broker_commissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  fixtureId: integer("fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
  commissionRef: varchar("commission_ref", { length: 100 }),
  dealDescription: varchar("deal_description", { length: 500 }),
  counterparty: varchar("counterparty", { length: 300 }),
  cargoType: varchar("cargo_type", { length: 200 }),
  voyageDescription: varchar("voyage_description", { length: 300 }),
  fixtureDate: timestamp("fixture_date"),
  freightAmount: real("freight_amount"),
  freightCurrency: varchar("freight_currency", { length: 10 }).default("USD"),
  commissionRate: real("commission_rate").notNull(),
  grossCommission: real("gross_commission").notNull(),
  deductions: real("deductions").default(0),
  netCommission: real("net_commission").notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  paymentDueDate: timestamp("payment_due_date"),
  paymentReceivedDate: timestamp("payment_received_date"),
  status: varchar("status", { length: 30 }).default("pending"),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const brokerCommissionRelations = relations(brokerCommissions, ({ one }) => ({
  user: one(users, { fields: [brokerCommissions.userId], references: [users.id] }),
  fixture: one(fixtures, { fields: [brokerCommissions.fixtureId], references: [fixtures.id] }),
}));

export const insertBrokerCommissionSchema = createInsertSchema(brokerCommissions).omit({ id: true, createdAt: true });
export type InsertBrokerCommission = z.infer<typeof insertBrokerCommissionSchema>;
export type BrokerCommission = typeof brokerCommissions.$inferSelect;

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

export const brokerContacts = pgTable("broker_contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  contactType: varchar("contact_type", { length: 50 }).notNull(), // "shipowner" | "charterer" | "broker" | "operator" | "trader" | "other"
  companyName: varchar("company_name", { length: 300 }).notNull(),
  contactName: varchar("contact_name", { length: 200 }),
  email: varchar("email", { length: 300 }),
  phone: varchar("phone", { length: 100 }),
  mobile: varchar("mobile", { length: 100 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 200 }),
  address: text("address"),
  website: varchar("website", { length: 300 }),
  vesselTypes: varchar("vessel_types", { length: 500 }), // "Bulk Carrier, Tanker" — bu şirketin gemi tipleri
  tradeRoutes: text("trade_routes"), // "Black Sea, Mediterranean"
  pastDealCount: integer("past_deal_count").default(0),
  lastDealDate: timestamp("last_deal_date"),
  rating: integer("rating"), // 1-5 yıldız
  isFavorite: boolean("is_favorite").default(false),
  tags: text("tags"), // JSON array: ["reliable", "fast-response", "bulk-specialist"]
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const brokerContactRelations = relations(brokerContacts, ({ one }) => ({
  user: one(users, { fields: [brokerContacts.userId], references: [users.id] }),
}));

export const insertBrokerContactSchema = createInsertSchema(brokerContacts).omit({ id: true, createdAt: true });
export type InsertBrokerContact = z.infer<typeof insertBrokerContactSchema>;
export type BrokerContact = typeof brokerContacts.$inferSelect;

// ─── ORDER BOOK (Broker Module) ──────────────────────────────────────────────

export const cargoOrders = pgTable("cargo_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderRef: varchar("order_ref", { length: 100 }),
  cargoType: varchar("cargo_type", { length: 200 }).notNull(),
  quantity: real("quantity"),
  quantityUnit: varchar("quantity_unit", { length: 20 }).default("MT"),
  loadPort: varchar("load_port", { length: 300 }),
  dischargePort: varchar("discharge_port", { length: 300 }),
  laycanFrom: timestamp("laycan_from"),
  laycanTo: timestamp("laycan_to"),
  freightIdea: real("freight_idea"),
  freightCurrency: varchar("freight_currency", { length: 10 }).default("USD"),
  freightBasis: varchar("freight_basis", { length: 50 }), // "PWWD" | "PMPR" | "Lump Sum"
  charterer: varchar("charterer", { length: 300 }),
  chartererContact: varchar("charterer_contact", { length: 200 }),
  vesselTypeRequired: varchar("vessel_type_required", { length: 200 }),
  dwtMin: real("dwt_min"),
  dwtMax: real("dwt_max"),
  status: varchar("status", { length: 30 }).default("open"), // open | negotiating | fixed | failed | cancelled | expired
  matchedFixtureId: integer("matched_fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselOpenings = pgTable("vessel_openings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  openingRef: varchar("opening_ref", { length: 100 }),
  vesselId: integer("vessel_id").references(() => vessels.id, { onDelete: "set null" }),
  vesselName: varchar("vessel_name", { length: 200 }).notNull(),
  vesselType: varchar("vessel_type", { length: 100 }),
  dwt: real("dwt"),
  builtYear: integer("built_year"),
  flag: varchar("flag", { length: 100 }),
  owner: varchar("owner", { length: 300 }),
  ownerContact: varchar("owner_contact", { length: 200 }),
  openDate: timestamp("open_date"),
  openPort: varchar("open_port", { length: 300 }),
  openArea: varchar("open_area", { length: 200 }), // "Mediterranean" | "Black Sea" | "US Gulf" etc.
  hireIdea: real("hire_idea"),
  hireCurrency: varchar("hire_currency", { length: 10 }).default("USD"),
  hireBasis: varchar("hire_basis", { length: 50 }), // "per day" | "lump sum"
  status: varchar("status", { length: 30 }).default("open"), // open | negotiating | fixed | withdrawn | expired
  matchedFixtureId: integer("matched_fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cargoOrderRelations = relations(cargoOrders, ({ one }) => ({
  user: one(users, { fields: [cargoOrders.userId], references: [users.id] }),
  matchedFixture: one(fixtures, { fields: [cargoOrders.matchedFixtureId], references: [fixtures.id] }),
}));

export const vesselOpeningRelations = relations(vesselOpenings, ({ one }) => ({
  user: one(users, { fields: [vesselOpenings.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [vesselOpenings.vesselId], references: [vessels.id] }),
  matchedFixture: one(fixtures, { fields: [vesselOpenings.matchedFixtureId], references: [fixtures.id] }),
}));

export const insertCargoOrderSchema = createInsertSchema(cargoOrders).omit({ id: true, createdAt: true });
export const insertVesselOpeningSchema = createInsertSchema(vesselOpenings).omit({ id: true, createdAt: true });

export type InsertCargoOrder = z.infer<typeof insertCargoOrderSchema>;
export type CargoOrder = typeof cargoOrders.$inferSelect;
export type InsertVesselOpening = z.infer<typeof insertVesselOpeningSchema>;
export type VesselOpening = typeof vesselOpenings.$inferSelect;


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
  fdaId: integer("fda_id"),
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
  amountPaid: real("amount_paid").default(0),
  balance: real("balance"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoicePayments = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  paymentMethod: text("payment_method"),  // "bank_transfer" | "cash" | "cheque" | "other"
  reference: text("reference"),           // banka havalesi referansı
  notes: text("notes"),
  recordedBy: varchar("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  voyage: one(voyages, { fields: [invoices.voyageId], references: [voyages.id] }),
  proforma: one(proformas, { fields: [invoices.proformaId], references: [proformas.id] }),
  creator: one(users, { fields: [invoices.createdByUserId], references: [users.id] }),
  payments: many(invoicePayments),
}));

export const invoicePaymentRelations = relations(invoicePayments, ({ one }) => ({
  invoice: one(invoices, { fields: [invoicePayments.invoiceId], references: [invoices.id] }),
  user: one(users, { fields: [invoicePayments.recordedBy], references: [users.id] }),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ createdAt: true, status: true });
export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments).omit({ id: true, createdAt: true });

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;

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
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  monthlySalary: real("monthly_salary"),
  salaryCurrency: text("salary_currency").default("USD"),
  seamanBookNumber: text("seaman_book_number"),
  seamanBookExpiry: timestamp("seaman_book_expiry"),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),
  visaType: text("visa_type"),
  visaExpiry: timestamp("visa_expiry"),
  nextPortJoin: text("next_port_join"),
  reliefDueDate: timestamp("relief_due_date"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  passportFileBase64: text("passport_file_base64"),
  passportFileName: text("passport_file_name"),
  passportFileUrl: text("passport_file_url"),
  seamansBookFileBase64: text("seamans_book_file_base64"),
  seamansBookFileName: text("seamans_book_file_name"),
  seamansBookFileUrl: text("seamans_book_file_url"),
  medicalFitnessExpiry: timestamp("medical_fitness_expiry"),
  medicalFitnessFileBase64: text("medical_fitness_file_base64"),
  medicalFitnessFileName: text("medical_fitness_file_name"),
  medicalFitnessFileUrl: text("medical_fitness_file_url"),
  status: text("status").default("on_board"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crewStcwCertificates = pgTable("crew_stcw_certificates", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").notNull().references(() => vesselCrew.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  certName: text("cert_name").notNull(),
  certNumber: text("cert_number"),
  issuingAuthority: text("issuing_authority"),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date").notNull(),
  certType: text("cert_type").default("stcw"), // "stcw" | "medical" | "flag_state" | "other"
  status: text("status").default("valid"), // "valid" | "expiring" | "expired"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crewPayroll = pgTable("crew_payroll", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").notNull().references(() => vesselCrew.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  basicSalary: real("basic_salary").notNull(),
  overtimeHours: real("overtime_hours").default(0),
  overtimeRate: real("overtime_rate").default(0),
  bonus: real("bonus").default(0),
  deductions: real("deductions").default(0),
  netPay: real("net_pay").notNull(),
  currency: text("currency").default("USD"),
  paidDate: timestamp("paid_date"),
  status: text("status").default("pending"), // "pending" | "processed" | "paid"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselCrewRelations = relations(vesselCrew, ({ one, many }) => ({
  vessel: one(vessels, { fields: [vesselCrew.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [vesselCrew.userId], references: [users.id] }),
  stcwCertificates: many(crewStcwCertificates),
  payrolls: many(crewPayroll),
}));

export const crewStcwCertificateRelations = relations(crewStcwCertificates, ({ one }) => ({
  crew: one(vesselCrew, { fields: [crewStcwCertificates.crewId], references: [vesselCrew.id] }),
  vessel: one(vessels, { fields: [crewStcwCertificates.vesselId], references: [vessels.id] }),
}));

export const crewPayrollRelations = relations(crewPayroll, ({ one }) => ({
  crew: one(vesselCrew, { fields: [crewPayroll.crewId], references: [vesselCrew.id] }),
  vessel: one(vessels, { fields: [crewPayroll.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [crewPayroll.userId], references: [users.id] }),
}));

export const insertVesselCrewSchema = createInsertSchema(vesselCrew).omit({ createdAt: true });
export const insertCrewStcwCertificateSchema = createInsertSchema(crewStcwCertificates).omit({ id: true, createdAt: true });
export const insertCrewPayrollSchema = createInsertSchema(crewPayroll).omit({ id: true, createdAt: true });

export type InsertVesselCrew = z.infer<typeof insertVesselCrewSchema>;
export type VesselCrew = typeof vesselCrew.$inferSelect;
export type InsertCrewStcwCertificate = z.infer<typeof insertCrewStcwCertificateSchema>;
export type CrewStcwCertificate = typeof crewStcwCertificates.$inferSelect;
export type InsertCrewPayroll = z.infer<typeof insertCrewPayrollSchema>;
export type CrewPayroll = typeof crewPayroll.$inferSelect;

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
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
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
  laytimeFactor: integer("laytime_factor").default(100),
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

// ─── CHARTER PARTY & TC HIRE ──────────────────────────────────────────────────

export const charterParties = pgTable("charter_parties", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  charterType: text("charter_type").notNull(),  // "TC" | "VC" | "BB" | "CoA"
  chartererName: text("charterer_name").notNull(),
  chartererAddress: text("charterer_address"),
  cpDate: timestamp("cp_date"),
  commencementDate: timestamp("commencement_date"),
  redeliveryDate: timestamp("redelivery_date"),
  hireRate: real("hire_rate"),                     // per day
  hireCurrency: text("hire_currency").default("USD"),
  hireFrequency: text("hire_frequency").default("semi_monthly"),  // "daily" | "weekly" | "semi_monthly" | "monthly"
  tradingArea: text("trading_area"),
  cargoDescription: text("cargo_description"),
  cpTerms: text("cp_terms"),
  status: text("status").notNull().default("active"),  // "active" | "completed" | "cancelled" | "on_hold"
  totalHireEarned: real("total_hire_earned").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hirePayments = pgTable("hire_payments", {
  id: serial("id").primaryKey(),
  charterPartyId: integer("charter_party_id").notNull().references(() => charterParties.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  periodFrom: timestamp("period_from").notNull(),
  periodTo: timestamp("period_to").notNull(),
  hireDays: real("hire_days").notNull(),
  grossHire: real("gross_hire").notNull(),
  offHireDeduction: real("off_hire_deduction").default(0),
  addressCommission: real("address_commission").default(0),
  brokerCommission: real("broker_commission").default(0),
  netHire: real("net_hire").notNull(),
  currency: text("currency").notNull().default("USD"),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  status: text("status").notNull().default("pending"),  // "pending" | "invoiced" | "paid" | "overdue"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offHireEvents = pgTable("off_hire_events", {
  id: serial("id").primaryKey(),
  charterPartyId: integer("charter_party_id").notNull().references(() => charterParties.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  startDatetime: timestamp("start_datetime").notNull(),
  endDatetime: timestamp("end_datetime"),
  reason: text("reason").notNull(),       // "breakdown" | "dry_dock" | "survey" | "owner_default" | "other"
  description: text("description"),
  deductedDays: real("deducted_days"),
  status: text("status").notNull().default("active"),  // "active" | "resolved"
  createdAt: timestamp("created_at").defaultNow(),
});

export const charterPartyRelations = relations(charterParties, ({ one, many }) => ({
  vessel: one(vessels, { fields: [charterParties.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [charterParties.userId], references: [users.id] }),
  payments: many(hirePayments),
  offHireEvents: many(offHireEvents),
}));

export const hirePaymentRelations = relations(hirePayments, ({ one }) => ({
  charterParty: one(charterParties, { fields: [hirePayments.charterPartyId], references: [charterParties.id] }),
  user: one(users, { fields: [hirePayments.userId], references: [users.id] }),
}));

export const offHireEventRelations = relations(offHireEvents, ({ one }) => ({
  charterParty: one(charterParties, { fields: [offHireEvents.charterPartyId], references: [charterParties.id] }),
  user: one(users, { fields: [offHireEvents.userId], references: [users.id] }),
}));

export const insertCharterPartySchema = createInsertSchema(charterParties).omit({ id: true, createdAt: true });
export const insertHirePaymentSchema = createInsertSchema(hirePayments).omit({ id: true, createdAt: true });
export const insertOffHireEventSchema = createInsertSchema(offHireEvents).omit({ id: true, createdAt: true });

export type InsertCharterParty = z.infer<typeof insertCharterPartySchema>;
export type CharterParty = typeof charterParties.$inferSelect;
export type InsertHirePayment = z.infer<typeof insertHirePaymentSchema>;
export type HirePayment = typeof hirePayments.$inferSelect;
export type InsertOffHireEvent = z.infer<typeof insertOffHireEventSchema>;
export type OffHireEvent = typeof offHireEvents.$inferSelect;

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
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
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
  portCallId: z.number().int().optional().nullable(),
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

// ==================== TARIFF TABLES (production-managed, raw SQL seeded) ====================

export const pilotageTariffs = pgTable("pilotage_tariffs", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  serviceType: varchar("service_type"),
  vesselCategory: varchar("vessel_category"),
  grtMin: integer("grt_min"),
  grtMax: integer("grt_max"),
  baseFee: real("base_fee"),
  per1000Grt: real("per_1000_grt"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const externalPilotageTariffs = pgTable("external_pilotage_tariffs", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  serviceDescription: text("service_description"),
  grtUpTo1000: real("grt_up_to_1000"),
  perAdditional1000Grt: real("per_additional_1000_grt"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const agencyFees = pgTable("agency_fees", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  tariffNo: varchar("tariff_no"),
  serviceType: varchar("service_type"),
  ntMin: integer("nt_min"),
  ntMax: integer("nt_max"),
  fee: real("fee"),
  per1000Nt: real("per_1000_nt"),
  currency: varchar("currency").default("EUR"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const marpolTariffs = pgTable("marpol_tariffs", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  grtMin: integer("grt_min"),
  grtMax: integer("grt_max"),
  marpolEk1Included: real("marpol_ek1_included"),
  marpolEk4Included: real("marpol_ek4_included"),
  marpolEk5Included: real("marpol_ek5_included"),
  fixedFee: real("fixed_fee"),
  weekdayEk1Rate: real("weekday_ek1_rate"),
  weekdayEk4Rate: real("weekday_ek4_rate"),
  weekdayEk5Rate: real("weekday_ek5_rate"),
  weekendEk1Rate: real("weekend_ek1_rate"),
  weekendEk4Rate: real("weekend_ek4_rate"),
  weekendEk5Rate: real("weekend_ek5_rate"),
  currency: varchar("currency").default("EUR"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const lcbTariffs = pgTable("lcb_tariffs", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  nrtMin: integer("nrt_min"),
  nrtMax: integer("nrt_max"),
  amount: real("amount"),
  currency: varchar("currency").default("TRY"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const tonnageTariffs = pgTable("tonnage_tariffs", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  nrtMin: integer("nrt_min"),
  nrtMax: integer("nrt_max"),
  ithalat: real("ithalat"),
  ihracat: real("ihracat"),
  currency: varchar("currency").default("TRY"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const cargoHandlingTariffs = pgTable("cargo_handling_tariffs", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  cargoType: varchar("cargo_type"),
  operation: varchar("operation"),
  rate: real("rate"),
  unit: varchar("unit"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const berthingTariffs = pgTable("berthing_tariffs", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  gtMin: integer("gt_min"),
  gtMax: integer("gt_max"),
  intlForeignFlag: real("intl_foreign_flag"),
  intlTurkishFlag: real("intl_turkish_flag"),
  cabotgeTurkish: real("cabotage_turkish"),
  perThousandGt: real("per_1000_gt"),
  gtThreshold: integer("gt_threshold").default(500),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const supervisionFees = pgTable("supervision_fees", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  category: varchar("category"),
  cargoType: varchar("cargo_type"),
  quantityRange: varchar("quantity_range"),
  rate: real("rate"),
  unit: varchar("unit"),
  currency: varchar("currency").default("EUR"),
  notes: text("notes"),
  validYear: integer("valid_year").default(2026),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customTariffSections = pgTable("custom_tariff_sections", {
  id: serial("id").primaryKey(),
  label: varchar("label").notNull(),
  defaultCurrency: varchar("default_currency").default("USD"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customTariffEntries = pgTable("custom_tariff_entries", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => customTariffSections.id, { onDelete: "cascade" }),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  serviceName: varchar("service_name"),
  fee: real("fee"),
  unit: varchar("unit"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const miscExpenses = pgTable("misc_expenses", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  expenseType: text("expense_type").notNull(),
  feeUsd: real("fee_usd").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chamberFreightShare = pgTable("chamber_freight_share", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  cargoMin: integer("cargo_min"),
  cargoMax: integer("cargo_max"),
  fee: real("fee"),
  flagCategory: varchar("flag_category").default("foreign"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const harbourMasterDues = pgTable("harbour_master_dues", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  serviceType: varchar("service_type"),
  vesselCategory: varchar("vessel_category"),
  grtMin: integer("grt_min"),
  grtMax: integer("grt_max"),
  fee: real("fee"),
  currency: varchar("currency").default("TRY"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const sanitaryDues = pgTable("sanitary_dues", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  nrtRate: real("nrt_rate"),
  currency: varchar("currency").default("TRY"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const vtsFees = pgTable("vts_fees", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  serviceName: varchar("service_name"),
  fee: real("fee"),
  unit: varchar("unit"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
  nrtMin: integer("nrt_min"),
  nrtMax: integer("nrt_max"),
  flagCategory: varchar("flag_category"),
});

export const portAuthorityFees = pgTable("port_authority_fees", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  serviceType: varchar("service_type"),
  vesselCategory: varchar("vessel_category"),
  grtMin: integer("grt_min"),
  grtMax: integer("grt_max"),
  amount: real("amount"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
  feeName: varchar("fee_name"),
  feeNo: varchar("fee_no"),
  min: real("min"),
  max: real("max"),
  sizeMin: real("size_min"),
  sizeMax: real("size_max"),
  unit: varchar("unit"),
  multiplierRule: text("multiplier_rule"),
});

export const otherServices = pgTable("other_services", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  serviceName: varchar("service_name"),
  fee: real("fee"),
  unit: varchar("unit"),
  currency: varchar("currency").default("USD"),
  validYear: integer("valid_year").default(2026),
  notes: text("notes"),
  updatedAt: timestamp("updated_at"),
});

export const aiAnalysisHistory = pgTable("ai_analysis_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: varchar("file_name", { length: 300 }),
  fileType: varchar("file_type", { length: 50 }),
  detectedEvent: varchar("detected_event", { length: 50 }),
  confidence: real("confidence"),
  summary: text("summary"),
  fullAnalysis: jsonb("full_analysis"),
  actionTaken: varchar("action_taken", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AiAnalysisEntry = typeof aiAnalysisHistory.$inferSelect;

// ─── VOYAGE CONTACTS ─────────────────────────────────────────────────────────

export const voyageContacts = pgTable("voyage_contacts", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 }).default("other").notNull(),
  includeInDailyReports: boolean("include_in_daily_reports").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVoyageContactSchema = createInsertSchema(voyageContacts).omit({ id: true, createdAt: true });
export type InsertVoyageContact = z.infer<typeof insertVoyageContactSchema>;
export type VoyageContact = typeof voyageContacts.$inferSelect;

// ─── VOYAGE CREW LOGISTICS ───────────────────────────────────────────────────

export const voyageCrewLogistics = pgTable("voyage_crew_logistics", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  rank: varchar("rank", { length: 100 }).notNull(),
  side: varchar("side", { length: 10 }).notNull().default("on"),
  nationality: varchar("nationality", { length: 10 }).default(""),
  passportNo: varchar("passport_no", { length: 50 }).default(""),
  flight: varchar("flight", { length: 20 }).default(""),
  flightEta: varchar("flight_eta", { length: 10 }).default(""),
  flightDelayed: boolean("flight_delayed").default(false).notNull(),
  visaRequired: boolean("visa_required").default(false).notNull(),
  eVisaStatus: varchar("e_visa_status", { length: 20 }).default("n/a").notNull(),
  okToBoard: varchar("ok_to_board", { length: 20 }).default("pending").notNull(),
  arrivalStatus: varchar("arrival_status", { length: 20 }).default("pending").notNull(),
  timeline: jsonb("timeline").default([]).notNull(),
  docs: jsonb("docs").default({}).notNull(),
  requiresHotel: boolean("requires_hotel").default(false).notNull(),
  hotelName: varchar("hotel_name", { length: 200 }).default(""),
  hotelCheckIn: varchar("hotel_check_in", { length: 10 }).default(""),
  hotelCheckOut: varchar("hotel_check_out", { length: 10 }).default(""),
  hotelStatus: varchar("hotel_status", { length: 20 }).default("none").notNull(),
  hotelPickupTime: varchar("hotel_pickup_time", { length: 10 }).default(""),
  dob: varchar("dob", { length: 20 }).default(""),
  seamanBookNo: varchar("seaman_book_no", { length: 50 }).default(""),
  birthPlace: varchar("birth_place", { length: 100 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVoyageCrewLogisticSchema = createInsertSchema(voyageCrewLogistics).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVoyageCrewLogistic = z.infer<typeof insertVoyageCrewLogisticSchema>;
export type VoyageCrewLogistic = typeof voyageCrewLogistics.$inferSelect;

// ─── LAYTIME SHEETS ──────────────────────────────────────────────────────────

export const laytimeSheets = pgTable("laytime_sheets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  title: text("title").notNull().default("Laytime Calculation"),
  vesselName: text("vessel_name"),
  portName: text("port_name"),
  terms: jsonb("terms").notNull().default({}),
  events: jsonb("events").notNull().default([]),
  result: jsonb("result").default(null),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const laytimeSheetRelations = relations(laytimeSheets, ({ one }) => ({
  user: one(users, { fields: [laytimeSheets.userId], references: [users.id] }),
  voyage: one(voyages, { fields: [laytimeSheets.voyageId], references: [voyages.id] }),
}));

export const insertLaytimeSheetSchema = createInsertSchema(laytimeSheets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLaytimeSheet = z.infer<typeof insertLaytimeSheetSchema>;
export type LaytimeSheet = typeof laytimeSheets.$inferSelect;

// ─── DA ADVANCES ─────────────────────────────────────────────────────────────

export const daAdvances = pgTable("da_advances", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  proformaId: integer("proforma_id").references(() => proformas.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  requestedAmount: real("requested_amount").notNull(),
  receivedAmount: real("received_amount").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date"),
  recipientEmail: text("recipient_email"),
  principalName: text("principal_name"),
  notes: text("notes"),
  bankDetails: text("bank_details"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const daAdvanceRelations = relations(daAdvances, ({ one }) => ({
  user: one(users, { fields: [daAdvances.userId], references: [users.id] }),
  voyage: one(voyages, { fields: [daAdvances.voyageId], references: [voyages.id] }),
  proforma: one(proformas, { fields: [daAdvances.proformaId], references: [proformas.id] }),
}));

export const insertDaAdvanceSchema = createInsertSchema(daAdvances).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDaAdvance = z.infer<typeof insertDaAdvanceSchema>;
export type DaAdvance = typeof daAdvances.$inferSelect;

// ─── PLANNED MAINTENANCE SYSTEM (PMS) ────────────────────────────────────────

export const vesselEquipment = pgTable("vessel_equipment", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 200 }).notNull(),
  equipmentType: varchar("equipment_type", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 200 }),
  model: varchar("model", { length: 200 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  installDate: timestamp("install_date"),
  location: varchar("location", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVesselEquipmentSchema = createInsertSchema(vesselEquipment).omit({ id: true, createdAt: true });
export type InsertVesselEquipment = z.infer<typeof insertVesselEquipmentSchema>;
export type VesselEquipment = typeof vesselEquipment.$inferSelect;

export const maintenanceJobs = pgTable("maintenance_jobs", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull().references(() => vesselEquipment.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  jobName: varchar("job_name", { length: 300 }).notNull(),
  jobDescription: text("job_description"),
  intervalType: varchar("interval_type", { length: 50 }).default("days"),
  intervalValue: integer("interval_value"),
  lastDoneDate: timestamp("last_done_date"),
  lastDoneRunningHours: real("last_done_running_hours"),
  nextDueDate: timestamp("next_due_date"),
  priority: varchar("priority", { length: 20 }).default("routine"),
  status: varchar("status", { length: 30 }).default("pending"),
  assignedTo: varchar("assigned_to", { length: 200 }),
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
  partsUsed: text("parts_used"),
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMaintenanceJobSchema = createInsertSchema(maintenanceJobs).omit({ id: true, createdAt: true });
export type InsertMaintenanceJob = z.infer<typeof insertMaintenanceJobSchema>;
export type MaintenanceJob = typeof maintenanceJobs.$inferSelect;

// ─── BUNKER MANAGEMENT ────────────────────────────────────────────────────────

export const bunkerOrders = pgTable("bunker_orders", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  port: varchar("port", { length: 200 }),
  orderDate: timestamp("order_date"),
  deliveryDate: timestamp("delivery_date"),
  fuelType: varchar("fuel_type", { length: 50 }).notNull(),
  quantityOrdered: real("quantity_ordered").notNull(),
  quantityDelivered: real("quantity_delivered"),
  pricePerMt: real("price_per_mt"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  totalCost: real("total_cost"),
  supplier: varchar("supplier", { length: 200 }),
  bdnNumber: varchar("bdn_number", { length: 100 }),
  sulphurContent: real("sulphur_content"),
  status: varchar("status", { length: 30 }).default("ordered"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBunkerOrderSchema = createInsertSchema(bunkerOrders).omit({ id: true, createdAt: true });
export type InsertBunkerOrder = z.infer<typeof insertBunkerOrderSchema>;
export type BunkerOrder = typeof bunkerOrders.$inferSelect;

export const bunkerRobs = pgTable("bunker_robs", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  reportDate: timestamp("report_date").notNull(),
  hfoRob: real("hfo_rob").default(0),
  mgoRob: real("mgo_rob").default(0),
  lsfoRob: real("lsfo_rob").default(0),
  vlsfoRob: real("vlsfo_rob").default(0),
  hfoConsumed: real("hfo_consumed").default(0),
  mgoConsumed: real("mgo_consumed").default(0),
  lsfoConsumed: real("lsfo_consumed").default(0),
  vlsfoConsumed: real("vlsfo_consumed").default(0),
  reportedBy: varchar("reported_by").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBunkerRobSchema = createInsertSchema(bunkerRobs).omit({ id: true, createdAt: true });
export type InsertBunkerRob = z.infer<typeof insertBunkerRobSchema>;
export type BunkerRob = typeof bunkerRobs.$inferSelect;

// ─── NOON REPORTS ─────────────────────────────────────────────────────────────

export const noonReports = pgTable("noon_reports", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reportDate: timestamp("report_date").notNull(),
  reportTime: varchar("report_time", { length: 10 }).default("12:00"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  positionDescription: varchar("position_description", { length: 500 }),
  speedOverGround: real("speed_over_ground"),
  speedThroughWater: real("speed_through_water"),
  rpm: integer("rpm"),
  distanceLastNoon: real("distance_last_noon"),
  distanceToGo: real("distance_to_go"),
  eta: timestamp("eta"),
  seaState: integer("sea_state"),
  windForce: integer("wind_force"),
  windDirection: varchar("wind_direction", { length: 10 }),
  swellHeight: real("swell_height"),
  hfoConsumed: real("hfo_consumed").default(0),
  mgoConsumed: real("mgo_consumed").default(0),
  lsfoConsumed: real("lsfo_consumed").default(0),
  hfoRob: real("hfo_rob"),
  mgoRob: real("mgo_rob"),
  lsfoRob: real("lsfo_rob"),
  mainEngineHours: real("main_engine_hours"),
  auxEngineHours: real("aux_engine_hours"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNoonReportSchema = createInsertSchema(noonReports).omit({ id: true, createdAt: true });
export type InsertNoonReport = z.infer<typeof insertNoonReportSchema>;
export type NoonReport = typeof noonReports.$inferSelect;


// ─── HUSBANDRY SERVICES (Agent Module) ────────────────────────────────────

export const husbandryOrders = pgTable("husbandry_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceType: text("service_type").notNull(),
  // "crew_change" | "medical" | "spare_parts" | "cash_to_master" | "provisions" | "postal" | "survey" | "other"
  description: text("description").notNull(),
  requestedDate: timestamp("requested_date"),
  completedDate: timestamp("completed_date"),
  vendor: text("vendor"),
  cost: real("cost"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("requested"),  // requested | confirmed | in_progress | completed | cancelled
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const husbandryOrderRelations = relations(husbandryOrders, ({ one, many }) => ({
  vessel: one(vessels, { fields: [husbandryOrders.vesselId], references: [vessels.id] }),
  voyage: one(voyages, { fields: [husbandryOrders.voyageId], references: [voyages.id] }),
  portCall: one(portCalls, { fields: [husbandryOrders.portCallId], references: [portCalls.id] }),
  user: one(users, { fields: [husbandryOrders.userId], references: [users.id] }),
  invoice: one(invoices, { fields: [husbandryOrders.invoiceId], references: [invoices.id] }),
  crewChanges: many(crewChanges),
}));

export const insertHusbandryOrderSchema = createInsertSchema(husbandryOrders).omit({ id: true, createdAt: true });
export type InsertHusbandryOrder = z.infer<typeof insertHusbandryOrderSchema>;
export type HusbandryOrder = typeof husbandryOrders.$inferSelect;

export const crewChanges = pgTable("crew_changes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  husbandryOrderId: integer("husbandry_order_id").notNull().references(() => husbandryOrders.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  changeType: text("change_type").notNull(),  // "sign_on" | "sign_off"
  seafarerName: text("seafarer_name").notNull(),
  rank: text("rank"),
  nationality: text("nationality"),
  passportNumber: text("passport_number"),
  passportIssueDate: timestamp("passport_issue_date"),
  passportExpiry: timestamp("passport_expiry"),
  seamanBookNumber: text("seaman_book_number"),
  seamanBookIssueDate: timestamp("seaman_book_issue_date"),
  seamanBookExpiry: timestamp("seaman_book_expiry"),
  dateOfBirth: timestamp("date_of_birth"),
  birthPlace: text("birth_place"),
  departureDate: timestamp("departure_date"),
  arrivalDate: timestamp("arrival_date"),
  visaRequired: boolean("visa_required").default(false),
  visaStatus: text("visa_status"),
  flightDetails: text("flight_details"),
  hotelRequired: boolean("hotel_required").default(false),
  hotelName: text("hotel_name"),
  port: text("port"),
  changeDate: timestamp("change_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crewChangeRelations = relations(crewChanges, ({ one }) => ({
  husbandryOrder: one(husbandryOrders, { fields: [crewChanges.husbandryOrderId], references: [husbandryOrders.id] }),
  vessel: one(vessels, { fields: [crewChanges.vesselId], references: [vessels.id] }),
}));

export const insertCrewChangeSchema = createInsertSchema(crewChanges).omit({ id: true, createdAt: true });
export type InsertCrewChange = z.infer<typeof insertCrewChangeSchema>;
export type CrewChange = typeof crewChanges.$inferSelect;

// ─── Sprint 8: Environmental Compliance ──────────────────────────────────────

export const ciiRecords = pgTable("cii_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reportingYear: integer("reporting_year").notNull(),
  shipType: varchar("ship_type", { length: 100 }),
  dwt: real("dwt"),
  totalCo2Mt: real("total_co2_mt").notNull().default(0),
  distanceNm: real("distance_nm").notNull().default(0),
  ciiAttained: real("cii_attained"),
  ciiRequired: real("cii_required"),
  ciiRating: varchar("cii_rating", { length: 5 }),
  hfoConsumed: real("hfo_consumed").default(0),
  mgoConsumed: real("mgo_consumed").default(0),
  lsfoConsumed: real("lsfo_consumed").default(0),
  vlsfoConsumed: real("vlsfo_consumed").default(0),
  lngConsumed: real("lng_consumed").default(0),
  correctionFactors: text("correction_factors"),
  status: varchar("status", { length: 20 }).default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCiiRecordSchema = createInsertSchema(ciiRecords).omit({ id: true, createdAt: true });
export type InsertCiiRecord = z.infer<typeof insertCiiRecordSchema>;
export type CiiRecord = typeof ciiRecords.$inferSelect;

export const euEtsRecords = pgTable("eu_ets_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reportingYear: integer("reporting_year").notNull(),
  reportingPeriod: varchar("reporting_period", { length: 20 }),
  voyageType: varchar("voyage_type", { length: 50 }),
  co2Emissions: real("co2_emissions").notNull().default(0),
  etsPercentage: real("ets_percentage").default(100),
  etsLiableCo2: real("ets_liable_co2"),
  allowancesPurchased: real("allowances_purchased").default(0),
  allowancesSurrendered: real("allowances_surrendered").default(0),
  etsPriceEur: real("ets_price_eur"),
  totalCostEur: real("total_cost_eur"),
  status: varchar("status", { length: 20 }).default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertEuEtsRecordSchema = createInsertSchema(euEtsRecords).omit({ id: true, createdAt: true });
export type InsertEuEtsRecord = z.infer<typeof insertEuEtsRecordSchema>;
export type EuEtsRecord = typeof euEtsRecords.$inferSelect;

export const dcsReports = pgTable("dcs_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reportingYear: integer("reporting_year").notNull(),
  hfoConsumed: real("hfo_consumed").default(0),
  lfoConsumed: real("lfo_consumed").default(0),
  mdoConsumed: real("mdo_consumed").default(0),
  lngConsumed: real("lng_consumed").default(0),
  totalFuel: real("total_fuel"),
  distanceNm: real("distance_nm"),
  hoursUnderway: real("hours_underway"),
  transportWork: real("transport_work"),
  verifier: varchar("verifier", { length: 200 }),
  verificationDate: timestamp("verification_date"),
  submissionDate: timestamp("submission_date"),
  status: varchar("status", { length: 20 }).default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertDcsReportSchema = createInsertSchema(dcsReports).omit({ id: true, createdAt: true });
export type InsertDcsReport = z.infer<typeof insertDcsReportSchema>;
export type DcsReport = typeof dcsReports.$inferSelect;

// ─── Sprint 8: Insurance Management ──────────────────────────────────────────

export const insurancePolicies = pgTable("insurance_policies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  policyType: varchar("policy_type", { length: 30 }).notNull(),
  insurer: varchar("insurer", { length: 300 }).notNull(),
  policyNumber: varchar("policy_number", { length: 200 }),
  club: varchar("club", { length: 200 }),
  insuredValue: real("insured_value"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  premiumAmount: real("premium_amount"),
  premiumFrequency: varchar("premium_frequency", { length: 20 }),
  deductible: real("deductible").default(0),
  coverageFrom: timestamp("coverage_from").notNull(),
  coverageTo: timestamp("coverage_to").notNull(),
  status: varchar("status", { length: 20 }).default("active"),
  renewalReminderDays: integer("renewal_reminder_days").default(30),
  coverageDescription: text("coverage_description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInsurancePolicySchema = createInsertSchema(insurancePolicies).omit({ id: true, createdAt: true });
export type InsertInsurancePolicy = z.infer<typeof insertInsurancePolicySchema>;
export type InsurancePolicy = typeof insurancePolicies.$inferSelect;

export const insuranceClaims = pgTable("insurance_claims", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  policyId: integer("policy_id").notNull().references(() => insurancePolicies.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  incidentDate: timestamp("incident_date").notNull(),
  incidentType: varchar("incident_type", { length: 100 }),
  incidentLocation: varchar("incident_location", { length: 300 }),
  description: text("description").notNull(),
  estimatedClaim: real("estimated_claim"),
  actualSettlement: real("actual_settlement"),
  deductibleApplied: real("deductible_applied"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  status: varchar("status", { length: 30 }).default("reported"),
  surveyor: varchar("surveyor", { length: 200 }),
  surveyorContact: varchar("surveyor_contact", { length: 200 }),
  correspondent: varchar("correspondent", { length: 200 }),
  correspondentContact: varchar("correspondent_contact", { length: 200 }),
  notes: text("notes"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaims).omit({ id: true, createdAt: true });
export type InsertInsuranceClaim = z.infer<typeof insertInsuranceClaimSchema>;
export type InsuranceClaim = typeof insuranceClaims.$inferSelect;

// ─── Sprint 8: Drydock Management ────────────────────────────────────────────

export const drydockProjects = pgTable("drydock_projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  projectName: varchar("project_name", { length: 300 }).notNull(),
  dockType: varchar("dock_type", { length: 50 }).default("special_survey"),
  shipyard: varchar("shipyard", { length: 300 }),
  shipyardLocation: varchar("shipyard_location", { length: 200 }),
  plannedStart: timestamp("planned_start"),
  plannedEnd: timestamp("planned_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  plannedBudget: real("planned_budget"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  actualCost: real("actual_cost").default(0),
  superintendent: varchar("superintendent", { length: 200 }),
  classSurveyor: varchar("class_surveyor", { length: 200 }),
  status: varchar("status", { length: 30 }).default("planned"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertDrydockProjectSchema = createInsertSchema(drydockProjects).omit({ id: true, createdAt: true });
export type InsertDrydockProject = z.infer<typeof insertDrydockProjectSchema>;
export type DrydockProject = typeof drydockProjects.$inferSelect;

export const drydockJobs = pgTable("drydock_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => drydockProjects.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobNumber: varchar("job_number", { length: 50 }),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  plannedDays: real("planned_days"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  status: varchar("status", { length: 30 }).default("pending"),
  contractor: varchar("contractor", { length: 200 }),
  startDate: timestamp("start_date"),
  completionDate: timestamp("completion_date"),
  approvedBy: varchar("approved_by", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertDrydockJobSchema = createInsertSchema(drydockJobs).omit({ id: true, createdAt: true });
export type InsertDrydockJob = z.infer<typeof insertDrydockJobSchema>;
export type DrydockJob = typeof drydockJobs.$inferSelect;

// ─── Sprint 8: Defect & PSC Tracking ─────────────────────────────────────────

export const vesselDefects = pgTable("vessel_defects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  defectNumber: varchar("defect_number", { length: 50 }),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 200 }),
  defectType: varchar("defect_type", { length: 50 }).default("defect"),
  reportedDate: timestamp("reported_date").notNull(),
  priority: varchar("priority", { length: 20 }).default("routine"),
  status: varchar("status", { length: 30 }).default("open"),
  assignedTo: varchar("assigned_to", { length: 200 }),
  targetCloseDate: timestamp("target_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  maintenanceJobId: integer("maintenance_job_id").references(() => maintenanceJobs.id, { onDelete: "set null" }),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  reportedBy: varchar("reported_by", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertVesselDefectSchema = createInsertSchema(vesselDefects).omit({ id: true, createdAt: true });
export type InsertVesselDefect = z.infer<typeof insertVesselDefectSchema>;
export type VesselDefect = typeof vesselDefects.$inferSelect;

export const pscInspections = pgTable("psc_inspections", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  inspectionDate: timestamp("inspection_date").notNull(),
  port: varchar("port", { length: 300 }).notNull(),
  pscAuthority: varchar("psc_authority", { length: 200 }),
  inspectorName: varchar("inspector_name", { length: 200 }),
  result: varchar("result", { length: 20 }).default("pass"),
  deficiencyCount: integer("deficiency_count").default(0),
  detention: boolean("detention").default(false),
  detentionReason: text("detention_reason"),
  releasedDate: timestamp("released_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPscInspectionSchema = createInsertSchema(pscInspections).omit({ id: true, createdAt: true });
export type InsertPscInspection = z.infer<typeof insertPscInspectionSchema>;
export type PscInspection = typeof pscInspections.$inferSelect;

export const pscDeficiencies = pgTable("psc_deficiencies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  inspectionId: integer("inspection_id").notNull().references(() => pscInspections.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  deficiencyCode: varchar("deficiency_code", { length: 50 }),
  description: text("description").notNull(),
  actionRequired: text("action_required"),
  rectificationDeadline: timestamp("rectification_deadline"),
  rectifiedDate: timestamp("rectified_date"),
  status: varchar("status", { length: 20 }).default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPscDeficiencySchema = createInsertSchema(pscDeficiencies).omit({ id: true, createdAt: true });
export type InsertPscDeficiency = z.infer<typeof insertPscDeficiencySchema>;
export type PscDeficiency = typeof pscDeficiencies.$inferSelect;

// ─── Sprint 8: Spare Parts Inventory ─────────────────────────────────────────

export const spareParts = pgTable("spare_parts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  partNumber: varchar("part_number", { length: 200 }),
  drawingNumber: varchar("drawing_number", { length: 200 }),
  description: varchar("description", { length: 500 }).notNull(),
  maker: varchar("maker", { length: 200 }),
  makerRef: varchar("maker_ref", { length: 200 }),
  equipmentId: integer("equipment_id").references(() => vesselEquipment.id, { onDelete: "set null" }),
  locationOnboard: varchar("location_onboard", { length: 200 }),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }).default("piece"),
  quantityOnboard: integer("quantity_onboard").default(0),
  minimumStock: integer("minimum_stock").default(1),
  quantityOrdered: integer("quantity_ordered").default(0),
  unitPrice: real("unit_price"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSparePartSchema = createInsertSchema(spareParts).omit({ id: true, createdAt: true });
export type InsertSparePart = z.infer<typeof insertSparePartSchema>;
export type SparePart = typeof spareParts.$inferSelect;

export const sparePartRequisitions = pgTable("spare_part_requisitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  requisitionNumber: varchar("requisition_number", { length: 100 }),
  requestedDate: timestamp("requested_date").notNull(),
  requiredBy: timestamp("required_by"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  status: varchar("status", { length: 30 }).default("pending"),
  approvedBy: varchar("approved_by", { length: 200 }),
  supplier: varchar("supplier", { length: 200 }),
  orderNumber: varchar("order_number", { length: 200 }),
  totalCost: real("total_cost"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSparePartRequisitionSchema = createInsertSchema(sparePartRequisitions).omit({ id: true, createdAt: true });
export type InsertSparePartRequisition = z.infer<typeof insertSparePartRequisitionSchema>;
export type SparePartRequisition = typeof sparePartRequisitions.$inferSelect;

export const sparePartRequisitionItems = pgTable("spare_part_requisition_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requisitionId: integer("requisition_id").notNull().references(() => sparePartRequisitions.id, { onDelete: "cascade" }),
  sparePartId: integer("spare_part_id").references(() => spareParts.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantityRequested: integer("quantity_requested").notNull(),
  quantityReceived: integer("quantity_received").default(0),
  unitPrice: real("unit_price"),
  totalPrice: real("total_price"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSparePartRequisitionItemSchema = createInsertSchema(sparePartRequisitionItems).omit({ id: true, createdAt: true });
export type InsertSparePartRequisitionItem = z.infer<typeof insertSparePartRequisitionItemSchema>;
export type SparePartRequisitionItem = typeof sparePartRequisitionItems.$inferSelect;

// ─── Sprint 9: Broker Modules ─────────────────────────────────────────────────

// T001: Voyage Estimation / Freight P&L Calculator
export const voyageEstimations = pgTable("voyage_estimations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselId: integer("vessel_id").references(() => vessels.id, { onDelete: "set null" }),
  estimationName: varchar("estimation_name", { length: 300 }).notNull(),
  vesselName: varchar("vessel_name", { length: 200 }),
  vesselType: varchar("vessel_type", { length: 100 }),
  dwt: real("dwt"),
  speedLaden: real("speed_laden").default(12),
  speedBallast: real("speed_ballast").default(13),
  consumptionLaden: real("consumption_laden").default(28),
  consumptionBallast: real("consumption_ballast").default(25),
  consumptionPort: real("consumption_port").default(3),
  fuelType: varchar("fuel_type", { length: 50 }).default("VLSFO"),
  fuelPrice: real("fuel_price").default(600),
  cargoType: varchar("cargo_type", { length: 200 }),
  cargoQuantity: real("cargo_quantity"),
  freightRate: real("freight_rate"),
  freightCurrency: varchar("freight_currency", { length: 10 }).default("USD"),
  freightBasis: varchar("freight_basis", { length: 50 }).default("PWWD"),
  loadPort: varchar("load_port", { length: 300 }),
  dischargePort: varchar("discharge_port", { length: 300 }),
  distanceLaden: real("distance_laden"),
  distanceBallast: real("distance_ballast"),
  portDaysLoad: real("port_days_load").default(2),
  portDaysDischarge: real("port_days_discharge").default(2),
  portCostLoad: real("port_cost_load").default(0),
  portCostDischarge: real("port_cost_discharge").default(0),
  canalCost: real("canal_cost").default(0),
  miscCosts: real("misc_costs").default(0),
  addressCommission: real("address_commission").default(0),
  brokerCommissionPct: real("broker_commission_pct").default(0),
  grossFreight: real("gross_freight"),
  totalVoyageCosts: real("total_voyage_costs"),
  netProfit: real("net_profit"),
  voyageDays: real("voyage_days"),
  tce: real("tce"),
  breakevenFreight: real("breakeven_freight"),
  status: varchar("status", { length: 20 }).default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertVoyageEstimationSchema = createInsertSchema(voyageEstimations).omit({ id: true, createdAt: true });
export type InsertVoyageEstimation = z.infer<typeof insertVoyageEstimationSchema>;
export type VoyageEstimation = typeof voyageEstimations.$inferSelect;

// T002: Order Book — Cargo Orders - ALREADY DEFINED ABOVE

// T002: Order Book — Vessel Openings - ALREADY DEFINED ABOVE

// T003: Broker Commissions - ALREADY DEFINED ABOVE

// T005: Broker Contacts (CRM) - ALREADY DEFINED ABOVE

// Passage Planning
export const passagePlans = pgTable("passage_plans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  vesselId: integer("vessel_id"),
  voyageId: integer("voyage_id"),
  planName: varchar("plan_name", { length: 255 }).notNull(),
  origin: varchar("origin", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  totalDistanceNm: real("total_distance_nm"),
  totalDays: real("total_days"),
  departureDate: timestamp("departure_date"),
  arrivalDate: timestamp("arrival_date"),
  status: varchar("status", { length: 50 }).default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPassagePlanSchema = createInsertSchema(passagePlans).omit({ id: true, createdAt: true });
export type InsertPassagePlan = z.infer<typeof insertPassagePlanSchema>;
export type PassagePlan = typeof passagePlans.$inferSelect;

export const passageWaypoints = pgTable("passage_waypoints", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  sequence: integer("sequence").notNull().default(0),
  waypointName: varchar("waypoint_name", { length: 255 }).notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  courseToNext: real("course_to_next"),
  distanceToNextNm: real("distance_to_next_nm"),
  speedKnots: real("speed_knots"),
  etd: timestamp("etd"),
  eta: timestamp("eta"),
  notes: text("notes"),
});
export const insertPassageWaypointSchema = createInsertSchema(passageWaypoints).omit({ id: true });
export type InsertPassageWaypoint = z.infer<typeof insertPassageWaypointSchema>;
export type PassageWaypoint = typeof passageWaypoints.$inferSelect;

// ─── Crew Change Document Configuration ─────────────────────────────────────
export const crewDocConfig = pgTable("crew_doc_config", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  portName: text("port_name"),
  customsAuthority: text("customs_authority"),
  customsUnit: text("customs_unit"),
  policeAuthority: text("police_authority"),
  agentPersonnel: jsonb("agent_personnel").$type<Array<{ name: string; tcId: string; birthPlace?: string; birthDate?: string }>>(),
  agentVehicles: jsonb("agent_vehicles").$type<Array<{ plate: string; model?: string }>>(),
  ekimTurPersonnel: jsonb("ekim_tur_personnel").$type<Array<{ name: string; tcId: string }>>(),
  ekimTurVehicles: jsonb("ekim_tur_vehicles").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertCrewDocConfigSchema = createInsertSchema(crewDocConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrewDocConfig = z.infer<typeof insertCrewDocConfigSchema>;
export type CrewDocConfig = typeof crewDocConfig.$inferSelect;

// ─── Cargo Operations ────────────────────────────────────────────────────────
export const cargoOperations = pgTable("cargo_operations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  vesselId: integer("vessel_id").references(() => vessels.id, { onDelete: "set null" }),
  cargoName: text("cargo_name").notNull(),
  cargoType: text("cargo_type").notNull().default("bulk"),
  operation: text("operation").notNull().default("loading"),
  quantity: real("quantity"),
  unit: text("unit").notNull().default("MT"),
  blNumber: text("bl_number"),
  hatchNo: text("hatch_no"),
  status: text("status").notNull().default("planned"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCargoOperationSchema = createInsertSchema(cargoOperations).omit({ id: true, createdAt: true });
export type InsertCargoOperation = z.infer<typeof insertCargoOperationSchema>;
export type CargoOperation = typeof cargoOperations.$inferSelect;

// ─── Port Call Checklists ────────────────────────────────────────────────────
export const portCallChecklists = pgTable("port_call_checklists", {
  id: serial("id").primaryKey(),
  portCallId: integer("port_call_id").notNull().references(() => portCalls.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  category: text("category").notNull().default("arrival"),
  item: text("item").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPortCallChecklistSchema = createInsertSchema(portCallChecklists).omit({ id: true, createdAt: true });
export type InsertPortCallChecklist = z.infer<typeof insertPortCallChecklistSchema>;
export type PortCallChecklist = typeof portCallChecklists.$inferSelect;
