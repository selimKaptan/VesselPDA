import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "../models/auth";
import { vessels } from "./vessel";
import { ports } from "./port";
import { voyages } from "./voyage";

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
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("proformas_user_idx").on(table.userId),
  voyageIdx: index("proformas_voyage_idx").on(table.voyageId),
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

export const proformaRelations = relations(proformas, ({ one, many }) => ({
  user: one(users, { fields: [proformas.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [proformas.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [proformas.portId], references: [ports.id] }),
  voyage: one(voyages, { fields: [proformas.voyageId], references: [voyages.id] }),
  approvalLogs: many(proformaApprovalLogs),
}));

export const proformaApprovalLogRelations = relations(proformaApprovalLogs, ({ one }) => ({
  proforma: one(proformas, { fields: [proformaApprovalLogs.proformaId], references: [proformas.id] }),
  user: one(users, { fields: [proformaApprovalLogs.userId], references: [users.id] }),
}));

export const insertProformaSchema = createInsertSchema(proformas).omit({ createdAt: true });
export const insertProformaApprovalLogSchema = createInsertSchema(proformaApprovalLogs).omit({ createdAt: true });

export type InsertProforma = z.infer<typeof insertProformaSchema>;
export type Proforma = typeof proformas.$inferSelect;
export type ProformaApprovalLog = typeof proformaApprovalLogs.$inferSelect;
export type InsertProformaApprovalLog = z.infer<typeof insertProformaApprovalLogSchema>;
