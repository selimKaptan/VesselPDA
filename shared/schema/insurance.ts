import { pgTable, varchar, integer, real, timestamp, boolean, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";

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

export const insertInsurancePolicySchema = createInsertSchema(insurancePolicies).omit({ id: true, createdAt: true });
export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaims).omit({ id: true, createdAt: true });

export type InsertInsurancePolicy = z.infer<typeof insertInsurancePolicySchema>;
export type InsurancePolicy = typeof insurancePolicies.$inferSelect;
export type InsertInsuranceClaim = z.infer<typeof insertInsuranceClaimSchema>;
export type InsuranceClaim = typeof insuranceClaims.$inferSelect;
