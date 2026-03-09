import { pgTable, varchar, integer, real, timestamp, boolean, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";
import { maintenanceJobs, vesselEquipment } from "./maintenance";

export const drydockProjects = pgTable("drydock_projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  projectName: varchar("project_name", { length: 300 }).notNull(),
  dockType: varchar("dock_type", { length: 50 }).default("special_survey"),
  shipyard: varchar("shipyard", { length: 300 }),
  shipyardLocation: varchar("shipyard_location", { length: 200 }),
  plannedStart: timestamp("planned_start"),
  plannedEnd: timestamp("planned_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  plannedBudget: real("planned_budget"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  actualCost: real("actual_cost").default(0),
  superintendent: varchar("superintendent", { length: 200 }),
  classSurveyor: varchar("class_surveyor", { length: 200 }),
  status: varchar("status", { length: 30 }).default("planned"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const drydockJobs = pgTable("drydock_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => drydockProjects.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobNumber: varchar("job_number", { length: 50 }),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  plannedDays: real("planned_days"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  status: varchar("status", { length: 30 }).default("pending"),
  contractor: varchar("contractor", { length: 200 }),
  startDate: timestamp("start_date"),
  completionDate: timestamp("completion_date"),
  approvedBy: varchar("approved_by", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselDefects = pgTable("vessel_defects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  defectNumber: varchar("defect_number", { length: 50 }),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 200 }),
  defectType: varchar("defect_type", { length: 50 }).default("defect"),
  reportedDate: timestamp("reported_date").notNull(),
  priority: varchar("priority", { length: 20 }).default("routine"),
  status: varchar("status", { length: 30 }).default("open"),
  assignedTo: varchar("assigned_to", { length: 200 }),
  targetCloseDate: timestamp("target_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  maintenanceJobId: integer("maintenance_job_id").references(() => maintenanceJobs.id, { onDelete: "set null" }),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  reportedBy: varchar("reported_by", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pscInspections = pgTable("psc_inspections", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  inspectionDate: timestamp("inspection_date").notNull(),
  port: varchar("port", { length: 300 }).notNull(),
  pscAuthority: varchar("psc_authority", { length: 200 }),
  inspectorName: varchar("inspector_name", { length: 200 }),
  result: varchar("result", { length: 20 }).default("pass"),
  deficiencyCount: integer("deficiency_count").default(0),
  detention: boolean("detention").default(false),
  detentionReason: text("detention_reason"),
  releasedDate: timestamp("released_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pscDeficiencies = pgTable("psc_deficiencies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  inspectionId: integer("inspection_id").notNull().references(() => pscInspections.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  deficiencyCode: varchar("deficiency_code", { length: 50 }),
  description: text("description").notNull(),
  actionRequired: text("action_required"),
  rectificationDeadline: timestamp("rectification_deadline"),
  rectifiedDate: timestamp("rectified_date"),
  status: varchar("status", { length: 20 }).default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const spareParts = pgTable("spare_parts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  partNumber: varchar("part_number", { length: 200 }),
  drawingNumber: varchar("drawing_number", { length: 200 }),
  description: varchar("description", { length: 500 }).notNull(),
  maker: varchar("maker", { length: 200 }),
  makerRef: varchar("maker_ref", { length: 200 }),
  equipmentId: integer("equipment_id").references(() => vesselEquipment.id, { onDelete: "set null" }),
  locationOnboard: varchar("location_onboard", { length: 200 }),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }).default("piece"),
  quantityOnboard: integer("quantity_onboard").default(0),
  minimumStock: integer("minimum_stock").default(1),
  quantityOrdered: integer("quantity_ordered").default(0),
  unitPrice: real("unit_price"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sparePartRequisitions = pgTable("spare_part_requisitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  requisitionNumber: varchar("requisition_number", { length: 100 }),
  requestedDate: timestamp("requested_date").notNull(),
  requiredBy: timestamp("required_by"),
  priority: varchar("priority", { length: 20 }).default("normal"),
  status: varchar("status", { length: 30 }).default("pending"),
  approvedBy: varchar("approved_by", { length: 200 }),
  supplier: varchar("supplier", { length: 200 }),
  orderNumber: varchar("order_number", { length: 200 }),
  totalCost: real("total_cost"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sparePartRequisitionItems = pgTable("spare_part_requisition_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requisitionId: integer("requisition_id").notNull().references(() => sparePartRequisitions.id, { onDelete: "cascade" }),
  sparePartId: integer("spare_part_id").references(() => spareParts.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }).notNull(),
  partNumber: varchar("part_number", { length: 200 }),
  quantity: integer("quantity").notNull().default(1),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  estimatedUnitPrice: real("estimated_unit_price"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDrydockProjectSchema = createInsertSchema(drydockProjects).omit({ id: true, createdAt: true });
export const insertDrydockJobSchema = createInsertSchema(drydockJobs).omit({ id: true, createdAt: true });
export const insertVesselDefectSchema = createInsertSchema(vesselDefects).omit({ id: true, createdAt: true });
export const insertPscInspectionSchema = createInsertSchema(pscInspections).omit({ id: true, createdAt: true });
export const insertPscDeficiencySchema = createInsertSchema(pscDeficiencies).omit({ id: true, createdAt: true });
export const insertSparePartSchema = createInsertSchema(spareParts).omit({ id: true, createdAt: true });
export const insertSparePartRequisitionSchema = createInsertSchema(sparePartRequisitions).omit({ id: true, createdAt: true });
export const insertSparePartRequisitionItemSchema = createInsertSchema(sparePartRequisitionItems).omit({ id: true, createdAt: true });

export type InsertDrydockProject = z.infer<typeof insertDrydockProjectSchema>;
export type DrydockProject = typeof drydockProjects.$inferSelect;
export type InsertDrydockJob = z.infer<typeof insertDrydockJobSchema>;
export type DrydockJob = typeof drydockJobs.$inferSelect;
export type InsertVesselDefect = z.infer<typeof insertVesselDefectSchema>;
export type VesselDefect = typeof vesselDefects.$inferSelect;
export type InsertPscInspection = z.infer<typeof insertPscInspectionSchema>;
export type PscInspection = typeof pscInspections.$inferSelect;
export type InsertPscDeficiency = z.infer<typeof insertPscDeficiencySchema>;
export type PscDeficiency = typeof pscDeficiencies.$inferSelect;
export type InsertSparePart = z.infer<typeof insertSparePartSchema>;
export type SparePart = typeof spareParts.$inferSelect;
export type InsertSparePartRequisition = z.infer<typeof insertSparePartRequisitionSchema>;
export type SparePartRequisition = typeof sparePartRequisitions.$inferSelect;
export type InsertSparePartRequisitionItem = z.infer<typeof insertSparePartRequisitionItemSchema>;
export type SparePartRequisitionItem = typeof sparePartRequisitionItems.$inferSelect;
