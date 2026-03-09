import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { voyages } from "./voyage";
import { proformas } from "./proforma";
import { vessels } from "./vessel";
import { ports } from "./port";
import { portCalls } from "./voyage";

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

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  proformaId: integer("proforma_id").references(() => proformas.id, { onDelete: "set null" }),
  fdaId: integer("fda_id").references(() => fdaAccounts.id, { onDelete: "set null" }),
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
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoicePayments = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  recordedBy: varchar("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portExpenses = pgTable("port_expenses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  fdaId: integer("fda_id").references(() => fdaAccounts.id, { onDelete: "set null" }),
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
  category: text("category").notNull(),
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

export const fdaMappingTemplates = pgTable("fda_mapping_templates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  mappings: jsonb("mappings").notNull().default([]).$type<{ pdaCategory: string; portExpenseCategory: string; note?: string }[]>(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentCommissions = pgTable("agent_commissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "cascade" }),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  commissionType: text("commission_type").notNull().default("percentage"),
  rate: real("rate"),
  fixedAmount: real("fixed_amount"),
  currency: text("currency").notNull().default("USD"),
  baseAmount: real("base_amount"),
  calculatedAmount: real("calculated_amount").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  baseCurrency: text("base_currency").notNull(),
  targetCurrency: text("target_currency").notNull(),
  buyRate: real("buy_rate"),
  sellRate: real("sell_rate"),
  effectiveRate: real("effective_rate").notNull(),
  source: text("source").notNull().default("tcmb"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePair: uniqueIndex("exchange_rates_pair_source_idx").on(table.baseCurrency, table.targetCurrency, table.source),
}));

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

export const fdaRelations = relations(fdaAccounts, ({ one }) => ({
  user: one(users, { fields: [fdaAccounts.userId], references: [users.id] }),
  proforma: one(proformas, { fields: [fdaAccounts.proformaId], references: [proformas.id] }),
  voyage: one(voyages, { fields: [fdaAccounts.voyageId], references: [voyages.id] }),
  vessel: one(vessels, { fields: [fdaAccounts.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [fdaAccounts.portId], references: [ports.id] }),
}));

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

export const daAdvanceRelations = relations(daAdvances, ({ one }) => ({
  user: one(users, { fields: [daAdvances.userId], references: [users.id] }),
  voyage: one(voyages, { fields: [daAdvances.voyageId], references: [voyages.id] }),
  proforma: one(proformas, { fields: [daAdvances.proformaId], references: [proformas.id] }),
}));

export const fdaMappingTemplateRelations = relations(fdaMappingTemplates, ({ one }) => ({
  user: one(users, { fields: [fdaMappingTemplates.userId], references: [users.id] }),
}));

export const agentCommissionRelations = relations(agentCommissions, ({ one }) => ({
  user: one(users, { fields: [agentCommissions.userId], references: [users.id] }),
  voyage: one(voyages, { fields: [agentCommissions.voyageId], references: [voyages.id] }),
  invoice: one(invoices, { fields: [agentCommissions.invoiceId], references: [invoices.id] }),
}));

export const insertFdaSchema = createInsertSchema(fdaAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ createdAt: true, status: true });
export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments).omit({ id: true, createdAt: true });
export const insertPortExpenseSchema = createInsertSchema(portExpenses).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDaAdvanceSchema = createInsertSchema(daAdvances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFdaMappingTemplateSchema = createInsertSchema(fdaMappingTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAgentCommissionSchema = createInsertSchema(agentCommissions).omit({ id: true, createdAt: true });
export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ updatedAt: true });
export const insertBunkerPriceSchema = createInsertSchema(bunkerPrices).omit({ id: true, updatedAt: true });

export type InsertFda = z.infer<typeof insertFdaSchema>;
export type Fda = typeof fdaAccounts.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;
export type InsertPortExpense = z.infer<typeof insertPortExpenseSchema>;
export type PortExpense = typeof portExpenses.$inferSelect;
export type InsertDaAdvance = z.infer<typeof insertDaAdvanceSchema>;
export type DaAdvance = typeof daAdvances.$inferSelect;
export type InsertFdaMappingTemplate = z.infer<typeof insertFdaMappingTemplateSchema>;
export type FdaMappingTemplate = typeof fdaMappingTemplates.$inferSelect;
export type InsertAgentCommission = z.infer<typeof insertAgentCommissionSchema>;
export type AgentCommission = typeof agentCommissions.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertBunkerPrice = z.infer<typeof insertBunkerPriceSchema>;
export type BunkerPrice = typeof bunkerPrices.$inferSelect;
