import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "../models/auth";
import { vessels } from "./vessel";
import { voyages } from "./voyage";
import { ports } from "./port";

export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  docType: text("doc_type").notNull().default("other"),
  content: text("content").notNull(),
  variables: jsonb("variables").default([]),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sanctionsChecks = pgTable("sanctions_checks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  checkType: text("check_type").notNull(),
  entityName: text("entity_name").notNull(),
  imoNumber: text("imo_number"),
  flag: text("flag"),
  result: text("result").notNull().default("clear"),
  matchedList: text("matched_list"),
  details: jsonb("details"),
  checkedAt: timestamp("checked_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  changes: jsonb("changes"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passagePlans = pgTable("passage_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title", { length: 300 }).notNull(),
  departurePort: varchar("departure_port", { length: 200 }),
  destinationPort: varchar("destination_port", { length: 200 }),
  plannedDeparture: timestamp("planned_departure"),
  plannedArrival: timestamp("planned_arrival"),
  status: varchar("status", { length: 20 }).default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passageWaypoints = pgTable("passage_waypoints", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  passagePlanId: integer("passage_plan_id").notNull().references(() => passagePlans.id, { onDelete: "cascade" }),
  sequenceNo: integer("sequence_no").notNull(),
  waypointName: varchar("waypoint_name", { length: 200 }),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  plannedSpeed: real("planned_speed"),
  plannedCourse: real("planned_course"),
  notes: text("notes"),
});

export const aiAnalysisHistory = pgTable("ai_analysis_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: varchar("file_name", { length: 300 }),
  fileType: varchar("file_type", { length: 50 }),
  detectedEvent: varchar("detected_event", { length: 50 }),
  confidence: real("confidence"),
  summary: text("summary"),
  fullAnalysis: jsonb("full_analysis"),
  actionTaken: varchar("action_taken", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cargoOperations = pgTable("cargo_operations", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  portId: integer("port_id").references(() => ports.id),
  operationType: text("operation_type").notNull().default("loading"),
  cargoType: text("cargo_type"),
  plannedQuantity: real("planned_quantity"),
  actualQuantity: real("actual_quantity"),
  unit: text("unit").default("MT"),
  startDatetime: timestamp("start_datetime"),
  endDatetime: timestamp("end_datetime"),
  completionPct: real("completion_pct").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselQ88 = pgTable("vessel_q88", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselName: varchar("vessel_name", { length: 200 }),
  imoNumber: varchar("imo_number", { length: 20 }),
  mmsi: varchar("mmsi", { length: 20 }),
  callSign: varchar("call_sign", { length: 20 }),
  flag: varchar("flag", { length: 100 }),
  portOfRegistry: varchar("port_of_registry", { length: 200 }),
  classificationSociety: varchar("classification_society", { length: 200 }),
  classNotation: varchar("class_notation", { length: 200 }),
  vesselType: varchar("vessel_type", { length: 100 }),
  yearBuilt: integer("year_built"),
  shipyard: varchar("shipyard", { length: 300 }),
  loa: real("loa"),
  lbp: real("lbp"),
  breadth: real("breadth"),
  depth: real("depth"),
  summerDraft: real("summer_draft"),
  summerDwt: real("summer_dwt"),
  summerDisplacement: real("summer_displacement"),
  grossTonnage: real("gross_tonnage"),
  netTonnage: real("net_tonnage"),
  lightship: real("lightship"),
  holdCount: integer("hold_count"),
  hatchCount: integer("hatch_count"),
  totalCapacityCbm: real("total_capacity_cbm"),
  grainCapacity: real("grain_capacity"),
  baleCapacity: real("bale_capacity"),
  craneCount: integer("crane_count"),
  craneSWL: real("crane_swl"),
  cargoGearDetails: text("cargo_gear_details"),
  mainEngine: varchar("main_engine", { length: 200 }),
  enginePower: varchar("engine_power", { length: 100 }),
  serviceSpeed: real("service_speed"),
  maxSpeed: real("max_speed"),
  fuelType: varchar("fuel_type", { length: 100 }),
  fuelConsumption: varchar("fuel_consumption", { length: 200 }),
  auxiliaryEngines: varchar("auxiliary_engines", { length: 200 }),
  bowThruster: boolean("bow_thruster").default(false),
  bowThrusterPower: varchar("bow_thruster_power", { length: 100 }),
  heavyFuelCapacity: real("heavy_fuel_capacity"),
  dieselOilCapacity: real("diesel_oil_capacity"),
  freshWaterCapacity: real("fresh_water_capacity"),
  ballastCapacity: real("ballast_capacity"),
  communicationEquipment: jsonb("communication_equipment").$type<string[]>().default([]),
  navigationEquipment: jsonb("navigation_equipment").$type<string[]>().default([]),
  lifeboats: varchar("lifeboats", { length: 200 }),
  lifeRafts: varchar("life_rafts", { length: 200 }),
  fireExtinguishing: varchar("fire_extinguishing", { length: 300 }),
  crewCapacity: integer("crew_capacity"),
  officerCabins: integer("officer_cabins"),
  crewCabins: integer("crew_cabins"),
  certificatesOnBoard: jsonb("certificates_on_board").$type<string[]>().default([]),
  specialEquipment: text("special_equipment"),
  iceClass: varchar("ice_class", { length: 50 }),
  fittedForHeavyLifts: boolean("fitted_for_heavy_lifts").default(false),
  co2Fitted: boolean("co2_fitted").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
  isPublic: boolean("is_public").default(false),
  version: integer("version").default(1),
  status: varchar("status", { length: 20 }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSanctionsCheckSchema = createInsertSchema(sanctionsChecks).omit({ id: true, checkedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertPassagePlanSchema = createInsertSchema(passagePlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPassageWaypointSchema = createInsertSchema(passageWaypoints).omit({ id: true });
export const insertCargoOperationSchema = createInsertSchema(cargoOperations).omit({ id: true, createdAt: true });
export const insertQ88Schema = createInsertSchema(vesselQ88).omit({ id: true, createdAt: true });

export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertSanctionsCheck = z.infer<typeof insertSanctionsCheckSchema>;
export type SanctionsCheck = typeof sanctionsChecks.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertPassagePlan = z.infer<typeof insertPassagePlanSchema>;
export type PassagePlan = typeof passagePlans.$inferSelect;
export type InsertPassageWaypoint = z.infer<typeof insertPassageWaypointSchema>;
export type PassageWaypoint = typeof passageWaypoints.$inferSelect;
export type InsertCargoOperation = z.infer<typeof insertCargoOperationSchema>;
export type CargoOperation = typeof cargoOperations.$inferSelect;
export type InsertVesselQ88 = z.infer<typeof insertQ88Schema>;
export type VesselQ88 = typeof vesselQ88.$inferSelect;
export type AiAnalysisEntry = typeof aiAnalysisHistory.$inferSelect;
