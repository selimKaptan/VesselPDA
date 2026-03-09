import { pgTable, varchar, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";

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

export const insertCiiRecordSchema = createInsertSchema(ciiRecords).omit({ id: true, createdAt: true });
export const insertEuEtsRecordSchema = createInsertSchema(euEtsRecords).omit({ id: true, createdAt: true });
export const insertDcsReportSchema = createInsertSchema(dcsReports).omit({ id: true, createdAt: true });

export type InsertCiiRecord = z.infer<typeof insertCiiRecordSchema>;
export type CiiRecord = typeof ciiRecords.$inferSelect;
export type InsertEuEtsRecord = z.infer<typeof insertEuEtsRecordSchema>;
export type EuEtsRecord = typeof euEtsRecords.$inferSelect;
export type InsertDcsReport = z.infer<typeof insertDcsReportSchema>;
export type DcsReport = typeof dcsReports.$inferSelect;
