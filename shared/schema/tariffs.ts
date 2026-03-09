import { pgTable, varchar, integer, real, timestamp, text, serial } from "drizzle-orm/pg-core";
import { z } from "zod";
import { ports } from "./port";

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

export type PilotageTariff = typeof pilotageTariffs.$inferSelect;
export type ExternalPilotageTariff = typeof externalPilotageTariffs.$inferSelect;
export type AgencyFee = typeof agencyFees.$inferSelect;
export type MarpolTariff = typeof marpolTariffs.$inferSelect;
export type LcbTariff = typeof lcbTariffs.$inferSelect;
export type TonnageTariff = typeof tonnageTariffs.$inferSelect;
export type CargoHandlingTariff = typeof cargoHandlingTariffs.$inferSelect;
export type BerthingTariff = typeof berthingTariffs.$inferSelect;
export type SupervisionFee = typeof supervisionFees.$inferSelect;
export type CustomTariffSection = typeof customTariffSections.$inferSelect;
export type CustomTariffEntry = typeof customTariffEntries.$inferSelect;
export type MiscExpense = typeof miscExpenses.$inferSelect;
export type ChamberFreightShare = typeof chamberFreightShare.$inferSelect;
export type HarbourMasterDue = typeof harbourMasterDues.$inferSelect;
export type SanitaryDue = typeof sanitaryDues.$inferSelect;
export type VtsFee = typeof vtsFees.$inferSelect;
export type PortAuthorityFee = typeof portAuthorityFees.$inferSelect;
export type OtherService = typeof otherServices.$inferSelect;
