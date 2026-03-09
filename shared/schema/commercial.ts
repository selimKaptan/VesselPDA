import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";
import { voyages } from "./voyage";

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
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const brokerContacts = pgTable("broker_contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  contactType: varchar("contact_type", { length: 50 }).notNull(),
  companyName: varchar("company_name", { length: 300 }).notNull(),
  contactName: varchar("contact_name", { length: 200 }),
  email: varchar("email", { length: 300 }),
  phone: varchar("phone", { length: 100 }),
  mobile: varchar("mobile", { length: 100 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 200 }),
  address: text("address"),
  website: varchar("website", { length: 300 }),
  vesselTypes: varchar("vessel_types", { length: 500 }),
  tradeRoutes: text("trade_routes"),
  pastDealCount: integer("past_deal_count").default(0),
  lastDealDate: timestamp("last_deal_date"),
  rating: integer("rating"),
  isFavorite: boolean("is_favorite").default(false),
  tags: text("tags"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  freightBasis: varchar("freight_basis", { length: 50 }),
  charterer: varchar("charterer", { length: 300 }),
  chartererContact: varchar("charterer_contact", { length: 200 }),
  vesselTypeRequired: varchar("vessel_type_required", { length: 200 }),
  dwtMin: real("dwt_min"),
  dwtMax: real("dwt_max"),
  status: varchar("status", { length: 30 }).default("open"),
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
  openArea: varchar("open_area", { length: 200 }),
  hireIdea: real("hire_idea"),
  hireCurrency: varchar("hire_currency", { length: 10 }).default("USD"),
  hireBasis: varchar("hire_basis", { length: 50 }),
  status: varchar("status", { length: 30 }).default("open"),
  matchedFixtureId: integer("matched_fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageEstimations = pgTable("voyage_estimations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselId: integer("vessel_id").references(() => vessels.id, { onDelete: "set null" }),
  title: varchar("title", { length: 300 }).notNull(),
  vesselName: varchar("vessel_name", { length: 200 }),
  vesselType: varchar("vessel_type", { length: 100 }),
  dwt: real("dwt"),
  speed: real("speed"),
  fuelConsumption: real("fuel_consumption"),
  portConsumption: real("port_consumption"),
  loadPort: varchar("load_port", { length: 300 }),
  dischargePort: varchar("discharge_port", { length: 300 }),
  cargoType: varchar("cargo_type", { length: 200 }),
  cargoQuantity: real("cargo_quantity"),
  freightRate: real("freight_rate"),
  freightCurrency: varchar("freight_currency", { length: 10 }).default("USD"),
  loadDays: real("load_days"),
  dischargeDays: real("discharge_days"),
  seaDays: real("sea_days"),
  totalDays: real("total_days"),
  fuelPrice: real("fuel_price"),
  portCosts: real("port_costs"),
  totalRevenue: real("total_revenue"),
  totalCost: real("total_cost"),
  voyageResult: real("voyage_result"),
  tce: real("tce"),
  status: varchar("status", { length: 30 }).default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const charterParties = pgTable("charter_parties", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  charterType: text("charter_type").notNull(),
  chartererName: text("charterer_name").notNull(),
  chartererAddress: text("charterer_address"),
  cpDate: timestamp("cp_date"),
  commencementDate: timestamp("commencement_date"),
  redeliveryDate: timestamp("redelivery_date"),
  hireRate: real("hire_rate"),
  hireCurrency: text("hire_currency").default("USD"),
  hireFrequency: text("hire_frequency").default("semi_monthly"),
  tradingArea: text("trading_area"),
  cargoDescription: text("cargo_description"),
  cpTerms: text("cp_terms"),
  status: text("status").notNull().default("active"),
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
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offHireEvents = pgTable("off_hire_events", {
  id: serial("id").primaryKey(),
  charterPartyId: integer("charter_party_id").notNull().references(() => charterParties.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  startDatetime: timestamp("start_datetime").notNull(),
  endDatetime: timestamp("end_datetime"),
  reason: text("reason").notNull(),
  description: text("description"),
  deductedDays: real("deducted_days"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const fixtureRelations = relations(fixtures, ({ one }) => ({
  user: one(users, { fields: [fixtures.userId], references: [users.id] }),
}));

export const laytimeRelations = relations(laytimeCalculations, ({ one }) => ({
  fixture: one(fixtures, { fields: [laytimeCalculations.fixtureId], references: [fixtures.id] }),
}));

export const cargoPositionRelations = relations(cargoPositions, ({ one }) => ({
  user: one(users, { fields: [cargoPositions.userId], references: [users.id] }),
}));

export const brokerCommissionRelations = relations(brokerCommissions, ({ one }) => ({
  user: one(users, { fields: [brokerCommissions.userId], references: [users.id] }),
  fixture: one(fixtures, { fields: [brokerCommissions.fixtureId], references: [fixtures.id] }),
}));

export const brokerContactRelations = relations(brokerContacts, ({ one }) => ({
  user: one(users, { fields: [brokerContacts.userId], references: [users.id] }),
}));

export const cargoOrderRelations = relations(cargoOrders, ({ one }) => ({
  user: one(users, { fields: [cargoOrders.userId], references: [users.id] }),
  matchedFixture: one(fixtures, { fields: [cargoOrders.matchedFixtureId], references: [fixtures.id] }),
}));

export const vesselOpeningRelations = relations(vesselOpenings, ({ one }) => ({
  user: one(users, { fields: [vesselOpenings.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [vesselOpenings.vesselId], references: [vessels.id] }),
  matchedFixture: one(fixtures, { fields: [vesselOpenings.matchedFixtureId], references: [fixtures.id] }),
}));

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

export const laytimeSheetRelations = relations(laytimeSheets, ({ one }) => ({
  user: one(users, { fields: [laytimeSheets.userId], references: [users.id] }),
  voyage: one(voyages, { fields: [laytimeSheets.voyageId], references: [voyages.id] }),
}));

export const insertFixtureSchema = createInsertSchema(fixtures).omit({ createdAt: true, status: true });
export const insertLaytimeSchema = createInsertSchema(laytimeCalculations).omit({ createdAt: true, timeUsedHours: true, demurrageAmount: true, despatchAmount: true });
export const insertCargoPositionSchema = createInsertSchema(cargoPositions).omit({ createdAt: true, status: true });
export const insertBrokerCommissionSchema = createInsertSchema(brokerCommissions).omit({ id: true, createdAt: true });
export const insertBrokerContactSchema = createInsertSchema(brokerContacts).omit({ id: true, createdAt: true });
export const insertCargoOrderSchema = createInsertSchema(cargoOrders).omit({ id: true, createdAt: true });
export const insertVesselOpeningSchema = createInsertSchema(vesselOpenings).omit({ id: true, createdAt: true });
export const insertVoyageEstimationSchema = createInsertSchema(voyageEstimations).omit({ id: true, createdAt: true });
export const insertCharterPartySchema = createInsertSchema(charterParties).omit({ id: true, createdAt: true });
export const insertHirePaymentSchema = createInsertSchema(hirePayments).omit({ id: true, createdAt: true });
export const insertOffHireEventSchema = createInsertSchema(offHireEvents).omit({ id: true, createdAt: true });
export const insertLaytimeSheetSchema = createInsertSchema(laytimeSheets).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertFixture = z.infer<typeof insertFixtureSchema>;
export type Fixture = typeof fixtures.$inferSelect;
export type InsertLaytime = z.infer<typeof insertLaytimeSchema>;
export type LaytimeCalculation = typeof laytimeCalculations.$inferSelect;
export type InsertCargoPosition = z.infer<typeof insertCargoPositionSchema>;
export type CargoPosition = typeof cargoPositions.$inferSelect;
export type InsertBrokerCommission = z.infer<typeof insertBrokerCommissionSchema>;
export type BrokerCommission = typeof brokerCommissions.$inferSelect;
export type InsertBrokerContact = z.infer<typeof insertBrokerContactSchema>;
export type BrokerContact = typeof brokerContacts.$inferSelect;
export type InsertCargoOrder = z.infer<typeof insertCargoOrderSchema>;
export type CargoOrder = typeof cargoOrders.$inferSelect;
export type InsertVesselOpening = z.infer<typeof insertVesselOpeningSchema>;
export type VesselOpening = typeof vesselOpenings.$inferSelect;
export type InsertVoyageEstimation = z.infer<typeof insertVoyageEstimationSchema>;
export type VoyageEstimation = typeof voyageEstimations.$inferSelect;
export type InsertCharterParty = z.infer<typeof insertCharterPartySchema>;
export type CharterParty = typeof charterParties.$inferSelect;
export type InsertHirePayment = z.infer<typeof insertHirePaymentSchema>;
export type HirePayment = typeof hirePayments.$inferSelect;
export type InsertOffHireEvent = z.infer<typeof insertOffHireEventSchema>;
export type OffHireEvent = typeof offHireEvents.$inferSelect;
export type InsertLaytimeSheet = z.infer<typeof insertLaytimeSheetSchema>;
export type LaytimeSheet = typeof laytimeSheets.$inferSelect;

