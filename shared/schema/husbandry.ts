import { relations } from "drizzle-orm";
import { pgTable, varchar, integer, real, timestamp, boolean, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";
import { voyages, portCalls } from "./voyage";
import { invoices } from "./finance";

export const husbandryOrders = pgTable("husbandry_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceType: text("service_type").notNull(),
  description: text("description").notNull(),
  requestedDate: timestamp("requested_date"),
  completedDate: timestamp("completed_date"),
  vendor: text("vendor"),
  cost: real("cost"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("requested"),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crewChanges = pgTable("crew_changes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  husbandryOrderId: integer("husbandry_order_id").notNull().references(() => husbandryOrders.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  changeType: text("change_type").notNull(),
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

export const husbandryOrderRelations = relations(husbandryOrders, ({ one, many }) => ({
  vessel: one(vessels, { fields: [husbandryOrders.vesselId], references: [vessels.id] }),
  voyage: one(voyages, { fields: [husbandryOrders.voyageId], references: [voyages.id] }),
  portCall: one(portCalls, { fields: [husbandryOrders.portCallId], references: [portCalls.id] }),
  user: one(users, { fields: [husbandryOrders.userId], references: [users.id] }),
  invoice: one(invoices, { fields: [husbandryOrders.invoiceId], references: [invoices.id] }),
  crewChanges: many(crewChanges),
}));

export const crewChangeRelations = relations(crewChanges, ({ one }) => ({
  husbandryOrder: one(husbandryOrders, { fields: [crewChanges.husbandryOrderId], references: [husbandryOrders.id] }),
  vessel: one(vessels, { fields: [crewChanges.vesselId], references: [vessels.id] }),
}));

export const insertHusbandryOrderSchema = createInsertSchema(husbandryOrders).omit({ id: true, createdAt: true });
export const insertCrewChangeSchema = createInsertSchema(crewChanges).omit({ id: true, createdAt: true });

export type InsertHusbandryOrder = z.infer<typeof insertHusbandryOrderSchema>;
export type HusbandryOrder = typeof husbandryOrders.$inferSelect;
export type InsertCrewChange = z.infer<typeof insertCrewChangeSchema>;
export type CrewChange = typeof crewChanges.$inferSelect;
