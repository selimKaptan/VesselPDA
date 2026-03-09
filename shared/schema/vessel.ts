import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, serial, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "../models/auth";

export const vessels = pgTable("vessels", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyProfileId: integer("company_profile_id").references(() => companyProfiles.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  flag: text("flag").notNull(),
  vesselType: text("vessel_type").notNull(),
  grt: real("grt").notNull(),
  nrt: real("nrt").notNull(),
  dwt: real("dwt"),
  loa: real("loa"),
  beam: real("beam"),
  imoNumber: text("imo_number"),
  mmsi: text("mmsi"),
  callSign: text("call_sign"),
  yearBuilt: integer("year_built"),
  fleetStatus: text("fleet_status").default("idle"),
  datalasticUuid: text("datalastic_uuid"),
  enginePower: real("engine_power"),
  engineType: text("engine_type"),
  classificationSociety: text("classification_society"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselRelations = relations(vessels, ({ one }) => ({
  user: one(users, { fields: [vessels.userId], references: [users.id] }),
}));

export const vesselWatchlist = pgTable("vessel_watchlist", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  mmsi: text("mmsi"),
  imo: text("imo"),
  vesselName: text("vessel_name").notNull(),
  flag: text("flag"),
  vesselType: text("vessel_type"),
  notes: text("notes"),
  addedAt: timestamp("added_at").defaultNow(),
});

export const vesselWatchlistRelations = relations(vesselWatchlist, ({ one }) => ({
  user: one(users, { fields: [vesselWatchlist.userId], references: [users.id] }),
}));

export const vesselPositions = pgTable("vessel_positions", {
  id: serial("id").primaryKey(),
  watchlistItemId: integer("watchlist_item_id").references(() => vesselWatchlist.id, { onDelete: "set null" }),
  mmsi: text("mmsi").notNull(),
  imo: text("imo"),
  vesselName: text("vessel_name"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  speed: real("speed"),
  course: real("course"),
  heading: real("heading"),
  navigationStatus: text("navigation_status"),
  destination: text("destination"),
  eta: timestamp("eta"),
  draught: real("draught"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  mmsiTimestampIdx: index("vessel_positions_mmsi_timestamp_idx").on(table.mmsi, table.timestamp),
}));

export const vesselPositionsRelations = relations(vesselPositions, ({ one }) => ({
  watchlistItem: one(vesselWatchlist, { fields: [vesselPositions.watchlistItemId], references: [vesselWatchlist.id] }),
}));

export const fleets = pgTable("fleets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#2563EB"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fleetVessels = pgTable("fleet_vessels", {
  fleetId: integer("fleet_id").notNull().references(() => fleets.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.fleetId, t.vesselId] }),
}));

export const fleetsRelations = relations(fleets, ({ one, many }) => ({
  user: one(users, { fields: [fleets.userId], references: [users.id] }),
  fleetVessels: many(fleetVessels),
}));

export const fleetVesselsRelations = relations(fleetVessels, ({ one }) => ({
  fleet: one(fleets, { fields: [fleetVessels.fleetId], references: [fleets.id] }),
  vessel: one(vessels, { fields: [fleetVessels.vesselId], references: [vessels.id] }),
}));

export const insertVesselSchema = createInsertSchema(vessels).omit({ createdAt: true });
export const insertVesselWatchlistSchema = createInsertSchema(vesselWatchlist).omit({ addedAt: true });
export const insertVesselPositionSchema = createInsertSchema(vesselPositions).omit({ timestamp: true });
export const insertFleetSchema = createInsertSchema(fleets).omit({ createdAt: true });

export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type Vessel = typeof vessels.$inferSelect;
export type InsertVesselWatchlist = z.infer<typeof insertVesselWatchlistSchema>;
export type VesselWatchlistItem = typeof vesselWatchlist.$inferSelect;
export type InsertVesselPosition = z.infer<typeof insertVesselPositionSchema>;
export type VesselPositionRecord = typeof vesselPositions.$inferSelect;
export type InsertFleet = z.infer<typeof insertFleetSchema>;
export type Fleet = typeof fleets.$inferSelect;
