import { relations } from "drizzle-orm";
import { pgTable, varchar, integer, real, timestamp, text, serial } from "drizzle-orm/pg-core";
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

export const insertVesselEquipmentSchema = createInsertSchema(vesselEquipment).omit({ id: true, createdAt: true });
export const insertMaintenanceJobSchema = createInsertSchema(maintenanceJobs).omit({ id: true, createdAt: true });
export const insertBunkerOrderSchema = createInsertSchema(bunkerOrders).omit({ id: true, createdAt: true });
export const insertBunkerRobSchema = createInsertSchema(bunkerRobs).omit({ id: true, createdAt: true });
export const insertNoonReportSchema = createInsertSchema(noonReports).omit({ id: true, createdAt: true });

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
