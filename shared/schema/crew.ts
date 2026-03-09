import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";

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
  certType: text("cert_type").default("stcw"),
  status: text("status").default("valid"),
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
  status: text("status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  renewalStatus: text("renewal_status").notNull().default("none"),
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

export const crewDocConfig = pgTable("crew_doc_config", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  agencyName: text("agency_name"),
  agencyAddress: text("agency_address"),
  agentName: text("agent_name"),
  agentPhone: text("agent_phone"),
  agentEmail: text("agent_email"),
  customFields: text("custom_fields"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const vesselCertificateRelations = relations(vesselCertificates, ({ one }) => ({
  user: one(users, { fields: [vesselCertificates.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [vesselCertificates.vesselId], references: [vessels.id] }),
}));

export const insertVesselCrewSchema = createInsertSchema(vesselCrew).omit({ createdAt: true });
export const insertCrewStcwCertificateSchema = createInsertSchema(crewStcwCertificates).omit({ id: true, createdAt: true });
export const insertCrewPayrollSchema = createInsertSchema(crewPayroll).omit({ id: true, createdAt: true });
export const insertVesselCertificateSchema = createInsertSchema(vesselCertificates).omit({ createdAt: true, status: true });
export const insertCrewDocConfigSchema = createInsertSchema(crewDocConfig).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertVesselCrew = z.infer<typeof insertVesselCrewSchema>;
export type VesselCrew = typeof vesselCrew.$inferSelect;
export type InsertCrewStcwCertificate = z.infer<typeof insertCrewStcwCertificateSchema>;
export type CrewStcwCertificate = typeof crewStcwCertificates.$inferSelect;
export type CrewStcwCert = CrewStcwCertificate;
export type InsertCrewStcwCert = InsertCrewStcwCertificate;
export type InsertCrewPayroll = z.infer<typeof insertCrewPayrollSchema>;
export type CrewPayroll = typeof crewPayroll.$inferSelect;
export type InsertVesselCertificate = z.infer<typeof insertVesselCertificateSchema>;
export type VesselCertificate = typeof vesselCertificates.$inferSelect;
export type InsertCrewDocConfig = z.infer<typeof insertCrewDocConfigSchema>;
export type CrewDocConfig = typeof crewDocConfig.$inferSelect;
