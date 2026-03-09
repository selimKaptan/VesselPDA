import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "../models/auth";
import { ports } from "./port";
import { vessels } from "./vessel";

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
}, (table) => ({
  tenderIdx: index("tender_bids_tender_idx").on(table.tenderId),
}));

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

export const agentReviewRelations = relations(agentReviews, ({ one }) => ({
  company: one(companyProfiles, { fields: [agentReviews.companyProfileId], references: [companyProfiles.id] }),
  reviewer: one(users, { fields: [agentReviews.reviewerUserId], references: [users.id] }),
  tender: one(portTenders, { fields: [agentReviews.tenderId], references: [portTenders.id] }),
}));

export const directNominationRelations = relations(directNominations, ({ one }) => ({
  nominator: one(users, { fields: [directNominations.nominatorUserId], references: [users.id] }),
  agent: one(users, { fields: [directNominations.agentUserId], references: [users.id] }),
  agentCompany: one(companyProfiles, { fields: [directNominations.agentCompanyId], references: [companyProfiles.id] }),
  port: one(ports, { fields: [directNominations.portId], references: [ports.id] }),
}));

export const insertPortTenderSchema = createInsertSchema(portTenders).omit({ createdAt: true, nominatedAt: true, nominatedAgentId: true, status: true });
export const insertTenderBidSchema = createInsertSchema(tenderBids).omit({ createdAt: true, status: true });
export const insertAgentReviewSchema = createInsertSchema(agentReviews).omit({ createdAt: true });
export const insertDirectNominationSchema = createInsertSchema(directNominations).omit({ createdAt: true, status: true, respondedAt: true });

export type InsertPortTender = z.infer<typeof insertPortTenderSchema>;
export type PortTender = typeof portTenders.$inferSelect;
export type InsertTenderBid = z.infer<typeof insertTenderBidSchema>;
export type TenderBid = typeof tenderBids.$inferSelect;
export type InsertAgentReview = z.infer<typeof insertAgentReviewSchema>;
export type AgentReview = typeof agentReviews.$inferSelect;
export type InsertDirectNomination = z.infer<typeof insertDirectNominationSchema>;
export type DirectNomination = typeof directNominations.$inferSelect;
