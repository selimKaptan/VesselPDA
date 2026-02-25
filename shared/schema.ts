export * from "./models/auth";

import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "./models/auth";

export const vessels = pgTable("vessels", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumReplyRelations = relations(forumReplies, ({ one }) => ({
  topic: one(forumTopics, { fields: [forumReplies.topicId], references: [forumTopics.id] }),
  user: one(users, { fields: [forumReplies.userId], references: [users.id] }),
}));

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
export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({ id: true, createdAt: true, lastActivityAt: true, viewCount: true, replyCount: true, isPinned: true, isLocked: true });
export const insertForumReplySchema = createInsertSchema(forumReplies).omit({ id: true, createdAt: true });

export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;
export type ForumCategory = typeof forumCategories.$inferSelect;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type ForumTopic = typeof forumTopics.$inferSelect;
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type ForumReply = typeof forumReplies.$inferSelect;

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
