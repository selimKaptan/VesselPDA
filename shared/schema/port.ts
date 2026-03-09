import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";

export const ports = pgTable("ports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  code: text("code"),
  currency: text("currency").notNull().default("USD"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tariffCategories = pgTable("tariff_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  portId: integer("port_id").notNull().references(() => ports.id),
  name: text("name").notNull(),
  description: text("description"),
  calculationType: text("calculation_type").notNull().default("fixed"),
  baseUnit: text("base_unit"),
  overtimeRate: real("overtime_rate"),
  currency: text("currency").notNull().default("USD"),
});

export const tariffRates = pgTable("tariff_rates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => tariffCategories.id),
  minGrt: real("min_grt").notNull().default(0),
  maxGrt: real("max_grt"),
  rate: real("rate").notNull(),
  perUnit: text("per_unit"),
});

export const tariffCategoryRelations = relations(tariffCategories, ({ one, many }) => ({
  port: one(ports, { fields: [tariffCategories.portId], references: [ports.id] }),
  rates: many(tariffRates),
}));

export const tariffRateRelations = relations(tariffRates, ({ one }) => ({
  category: one(tariffCategories, { fields: [tariffRates.categoryId], references: [tariffCategories.id] }),
}));

export const portAlerts = pgTable("port_alerts", {
  id: serial("id").primaryKey(),
  portId: integer("port_id").references(() => ports.id, { onDelete: "set null" }),
  portName: text("port_name").notNull(),
  alertType: text("alert_type").notNull().default("other"),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portAlertRelations = relations(portAlerts, ({ one }) => ({
  port: one(ports, { fields: [portAlerts.portId], references: [ports.id] }),
  creator: one(users, { fields: [portAlerts.createdByUserId], references: [users.id] }),
}));

export const portCallChecklists = pgTable("port_call_checklists", {
  id: serial("id").primaryKey(),
  portCallId: integer("port_call_id").notNull(),
  title: text("title").notNull(),
  checklistType: text("checklist_type").notNull().default("arrival"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortSchema = createInsertSchema(ports).omit({ createdAt: true });
export const insertTariffCategorySchema = createInsertSchema(tariffCategories).omit({});
export const insertTariffRateSchema = createInsertSchema(tariffRates).omit({});
export const insertPortAlertSchema = createInsertSchema(portAlerts).omit({ createdAt: true });
export const insertPortCallChecklistSchema = createInsertSchema(portCallChecklists).omit({ id: true, createdAt: true });

export type InsertPort = z.infer<typeof insertPortSchema>;
export type Port = typeof ports.$inferSelect;
export type InsertTariffCategory = z.infer<typeof insertTariffCategorySchema>;
export type TariffCategory = typeof tariffCategories.$inferSelect;
export type InsertTariffRate = z.infer<typeof insertTariffRateSchema>;
export type TariffRate = typeof tariffRates.$inferSelect;
export type InsertPortAlert = z.infer<typeof insertPortAlertSchema>;
export type PortAlert = typeof portAlerts.$inferSelect;
export type InsertPortCallChecklist = z.infer<typeof insertPortCallChecklistSchema>;
export type PortCallChecklist = typeof portCallChecklists.$inferSelect;
