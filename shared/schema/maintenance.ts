import { relations } from "drizzle-orm";
import { pgTable, varchar, integer, real, timestamp, text, serial, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";
import { voyages } from "./voyage";

export const vesselEquipment = pgTable("vessel_equipment", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 200 }).notNull(),
  equipmentType: varchar("equipment_type", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 200 }),
  model: varchar("model", { length: 200 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  installDate: timestamp("install_date"),
  location: varchar("location", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const maintenanceJobs = pgTable("maintenance_jobs", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull().references(() => vesselEquipment.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  jobName: varchar("job_name", { length: 300 }).notNull(),
  jobDescription: text("job_description"),
  intervalType: varchar("interval_type", { length: 50 }).default("days"),
  intervalValue: integer("interval_value"),
  lastDoneDate: timestamp("last_done_date"),
  lastDoneRunningHours: real("last_done_running_hours"),
  nextDueDate: timestamp("next_due_date"),
  priority: varchar("priority", { length: 20 }).default("routine"),
  status: varchar("status", { length: 30 }).default("pending"),
  assignedTo: varchar("assigned_to", { length: 200 }),
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
  partsUsed: text("parts_used"),
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bunkerOrders = pgTable("bunker_orders", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  port: varchar("port", { length: 200 }),
  orderDate: timestamp("order_date"),
  deliveryDate: timestamp("delivery_date"),
  fuelType: varchar("fuel_type", { length: 50 }).notNull(),
  quantityOrdered: real("quantity_ordered").notNull(),
  quantityDelivered: real("quantity_delivered"),
  pricePerMt: real("price_per_mt"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  totalCost: real("total_cost"),
  supplier: varchar("supplier", { length: 200 }),
  bdnNumber: varchar("bdn_number", { length: 100 }),
  sulphurContent: real("sulphur_content"),
  status: varchar("status", { length: 30 }).default("ordered"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bunkerRobs = pgTable("bunker_robs", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  reportDate: timestamp("report_date").notNull(),
  hfoRob: real("hfo_rob").default(0),
  mgoRob: real("mgo_rob").default(0),
  lsfoRob: real("lsfo_rob").default(0),
  vlsfoRob: real("vlsfo_rob").default(0),
  hfoConsumed: real("hfo_consumed").default(0),
  mgoConsumed: real("mgo_consumed").default(0),
  lsfoConsumed: real("lsfo_consumed").default(0),
  vlsfoConsumed: real("vlsfo_consumed").default(0),
  reportedBy: varchar("reported_by").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const noonReports = pgTable("noon_reports", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reportDate: timestamp("report_date").notNull(),
  reportTime: varchar("report_time", { length: 10 }).default("12:00"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  positionDescription: varchar("position_description", { length: 500 }),
  speedOverGround: real("speed_over_ground"),
  speedThroughWater: real("speed_through_water"),
  rpm: integer("rpm"),
  distanceLastNoon: real("distance_last_noon"),
  distanceToGo: real("distance_to_go"),
  eta: timestamp("eta"),
  seaState: integer("sea_state"),
  windForce: integer("wind_force"),
  windDirection: varchar("wind_direction", { length: 10 }),
  swellHeight: real("swell_height"),
  hfoConsumed: real("hfo_consumed").default(0),
  mgoConsumed: real("mgo_consumed").default(0),
  lsfoConsumed: real("lsfo_consumed").default(0),
  hfoRob: real("hfo_rob"),
  mgoRob: real("mgo_rob"),
  lsfoRob: real("lsfo_rob"),
  mainEngineHours: real("main_engine_hours"),
  auxEngineHours: real("aux_engine_hours"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PMS: EQUIPMENT REGISTRY (Ekipman Ağacı) ─────────────────────────────────

export const equipmentCategories = pgTable("equipment_categories", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  level: integer("level").default(0),
  sortOrder: integer("sort_order").default(0),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equipmentItems = pgTable("equipment_items", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => equipmentCategories.id, { onDelete: "set null" }),
  parentEquipmentId: integer("parent_equipment_id"),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  manufacturer: varchar("manufacturer", { length: 200 }),
  model: varchar("model", { length: 200 }),
  serialNumber: varchar("serial_number", { length: 200 }),
  location: varchar("location", { length: 200 }),
  department: varchar("department", { length: 100 }),
  criticalityLevel: varchar("criticality_level", { length: 20 }).default("normal"),
  status: varchar("status", { length: 30 }).default("operational"),
  commissionDate: timestamp("commission_date"),
  lastOverhaulDate: timestamp("last_overhaul_date"),
  hasRunningHours: boolean("has_running_hours").default(false),
  currentRunningHours: real("current_running_hours").default(0),
  lastRunningHoursUpdate: timestamp("last_running_hours_update"),
  dailyAvgRunningHours: real("daily_avg_running_hours"),
  classRelevant: boolean("class_relevant").default(false),
  classCode: varchar("class_code", { length: 50 }),
  manualFileUrl: varchar("manual_file_url", { length: 500 }),
  drawingFileUrl: varchar("drawing_file_url", { length: 500 }),
  photoUrl: varchar("photo_url", { length: 500 }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PMS: MAINTENANCE JOBS (Bakım Görevleri) ─────────────────────────────────

export const pmsJobs = pgTable("pms_jobs", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  equipmentId: integer("equipment_id").references(() => equipmentItems.id, { onDelete: "cascade" }),
  jobCode: varchar("job_code", { length: 50 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  procedure: text("procedure"),
  safetyPrecautions: text("safety_precautions"),
  intervalType: varchar("interval_type", { length: 20 }).notNull().default("calendar"),
  calendarIntervalDays: integer("calendar_interval_days"),
  calendarIntervalMonths: integer("calendar_interval_months"),
  runningHoursInterval: real("running_hours_interval"),
  status: varchar("status", { length: 20 }).default("active"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  lastDoneDate: timestamp("last_done_date"),
  lastDoneRunningHours: real("last_done_running_hours"),
  lastDoneBy: varchar("last_done_by", { length: 200 }),
  lastDoneWorkOrderId: integer("last_done_work_order_id"),
  nextDueDate: timestamp("next_due_date"),
  nextDueRunningHours: real("next_due_running_hours"),
  isOverdue: boolean("is_overdue").default(false),
  overdueDays: integer("overdue_days").default(0),
  classRelated: boolean("class_related").default(false),
  classRequirement: varchar("class_requirement", { length: 200 }),
  regulatoryBody: varchar("regulatory_body", { length: 100 }),
  requiredSparePartIds: jsonb("required_spare_part_ids"),
  estimatedDurationHours: real("estimated_duration_hours"),
  estimatedCost: real("estimated_cost"),
  assignedDepartment: varchar("assigned_department", { length: 100 }),
  assignedRank: varchar("assigned_rank", { length: 100 }),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PMS: WORK ORDERS (İş Emirleri) ──────────────────────────────────────────

export const workOrders = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  pmsJobId: integer("pms_job_id").references(() => pmsJobs.id, { onDelete: "set null" }),
  equipmentId: integer("equipment_id").references(() => equipmentItems.id, { onDelete: "set null" }),
  workOrderNumber: varchar("work_order_number", { length: 50 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  workType: varchar("work_type", { length: 30 }).default("planned"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  status: varchar("status", { length: 20 }).default("open"),
  plannedStartDate: timestamp("planned_start_date"),
  plannedEndDate: timestamp("planned_end_date"),
  actualStartDate: timestamp("actual_start_date"),
  actualEndDate: timestamp("actual_end_date"),
  requestedBy: varchar("requested_by").references(() => users.id),
  assignedTo: varchar("assigned_to", { length: 200 }),
  approvedBy: varchar("approved_by").references(() => users.id),
  completedBy: varchar("completed_by").references(() => users.id),
  runningHoursAtStart: real("running_hours_at_start"),
  runningHoursAtComplete: real("running_hours_at_complete"),
  laborHours: real("labor_hours"),
  materialCost: real("material_cost"),
  externalCost: real("external_cost"),
  totalCost: real("total_cost"),
  findings: text("findings"),
  recommendations: text("recommendations"),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  attachments: jsonb("attachments"),
  photos: jsonb("photos"),
  masterApproval: boolean("master_approval").default(false),
  masterApprovalDate: timestamp("master_approval_date"),
  superintendentApproval: boolean("superintendent_approval").default(false),
  superintendentApprovalDate: timestamp("superintendent_approval_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PMS: RUNNING HOURS LOG (Çalışma Saatleri) ───────────────────────────────

export const runningHoursLog = pgTable("running_hours_log", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  equipmentId: integer("equipment_id").notNull().references(() => equipmentItems.id, { onDelete: "cascade" }),
  recordDate: timestamp("record_date").notNull(),
  runningHours: real("running_hours").notNull(),
  previousRunningHours: real("previous_running_hours"),
  hoursIncrement: real("hours_increment"),
  recordedBy: varchar("recorded_by").references(() => users.id),
  source: varchar("source", { length: 30 }).default("manual"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PMS: CLASS & SURVEY (Klas Sörveyleri) ───────────────────────────────────

export const classSurveys = pgTable("class_surveys", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  surveyType: varchar("survey_type", { length: 50 }).notNull(),
  classificationSociety: varchar("classification_society", { length: 100 }),
  surveyCode: varchar("survey_code", { length: 50 }),
  dueDate: timestamp("due_date"),
  windowStartDate: timestamp("window_start_date"),
  windowEndDate: timestamp("window_end_date"),
  completedDate: timestamp("completed_date"),
  status: varchar("status", { length: 20 }).default("upcoming"),
  result: varchar("result", { length: 30 }),
  surveyor: varchar("surveyor", { length: 200 }),
  port: varchar("port", { length: 200 }),
  notes: text("notes"),
  conditions: jsonb("conditions"),
  recommendations: jsonb("recommendations"),
  relatedJobIds: jsonb("related_job_ids"),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  reportFileUrl: varchar("report_file_url", { length: 500 }),
  certificateFileUrl: varchar("certificate_file_url", { length: 500 }),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PMS: TEMPLATES (Bakım Şablonları) ───────────────────────────────────────

export const pmsTemplates = pgTable("pms_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  vesselType: varchar("vessel_type", { length: 100 }),
  description: text("description"),
  equipmentTree: jsonb("equipment_tree"),
  maintenanceJobs: jsonb("maintenance_jobs"),
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PMS: CONDITION REPORTS (Durum Raporları) ────────────────────────────────

export const conditionReports = pgTable("condition_reports", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  equipmentId: integer("equipment_id").references(() => equipmentItems.id, { onDelete: "set null" }),
  reportType: varchar("report_type", { length: 30 }).default("condition"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  condition: varchar("condition", { length: 20 }).default("satisfactory"),
  reportedBy: varchar("reported_by").references(() => users.id),
  reportedDate: timestamp("reported_date").defaultNow(),
  photos: jsonb("photos"),
  attachments: jsonb("attachments"),
  actionRequired: boolean("action_required").default(false),
  workOrderId: integer("work_order_id"),
  resolvedDate: timestamp("resolved_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── INSERT SCHEMAS & TYPES ───────────────────────────────────────────────────

export const insertVesselEquipmentSchema = createInsertSchema(vesselEquipment).omit({ id: true, createdAt: true });
export const insertMaintenanceJobSchema = createInsertSchema(maintenanceJobs).omit({ id: true, createdAt: true });
export const insertBunkerOrderSchema = createInsertSchema(bunkerOrders).omit({ id: true, createdAt: true });
export const insertBunkerRobSchema = createInsertSchema(bunkerRobs).omit({ id: true, createdAt: true });
export const insertNoonReportSchema = createInsertSchema(noonReports).omit({ id: true, createdAt: true });

export const insertEquipmentCategorySchema = createInsertSchema(equipmentCategories).omit({ id: true, createdAt: true });
export const insertEquipmentItemSchema = createInsertSchema(equipmentItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmsJobSchema = createInsertSchema(pmsJobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRunningHoursLogSchema = createInsertSchema(runningHoursLog).omit({ id: true, createdAt: true });
export const insertClassSurveySchema = createInsertSchema(classSurveys).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPmsTemplateSchema = createInsertSchema(pmsTemplates).omit({ id: true, createdAt: true });
export const insertConditionReportSchema = createInsertSchema(conditionReports).omit({ id: true, createdAt: true });

export type InsertVesselEquipment = z.infer<typeof insertVesselEquipmentSchema>;
export type VesselEquipment = typeof vesselEquipment.$inferSelect;
export type InsertMaintenanceJob = z.infer<typeof insertMaintenanceJobSchema>;
export type MaintenanceJob = typeof maintenanceJobs.$inferSelect;
export type InsertBunkerOrder = z.infer<typeof insertBunkerOrderSchema>;
export type BunkerOrder = typeof bunkerOrders.$inferSelect;
export type InsertBunkerRob = z.infer<typeof insertBunkerRobSchema>;
export type BunkerRob = typeof bunkerRobs.$inferSelect;
export type InsertNoonReport = z.infer<typeof insertNoonReportSchema>;
export type NoonReport = typeof noonReports.$inferSelect;

export type EquipmentCategory = typeof equipmentCategories.$inferSelect;
export type EquipmentItem = typeof equipmentItems.$inferSelect;
export type PmsJob = typeof pmsJobs.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type RunningHoursEntry = typeof runningHoursLog.$inferSelect;
export type ClassSurvey = typeof classSurveys.$inferSelect;
export type PmsTemplate = typeof pmsTemplates.$inferSelect;
export type ConditionReport = typeof conditionReports.$inferSelect;
