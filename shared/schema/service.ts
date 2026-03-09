import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companyProfiles } from "../models/auth";
import { ports } from "./port";
import { voyages } from "./voyage";

export const serviceRequests = pgTable("service_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  portId: integer("port_id").notNull().references(() => ports.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  vesselName: text("vessel_name").notNull(),
  grt: real("grt"),
  serviceType: text("service_type").notNull().default("other"),
  description: text("description").notNull(),
  quantity: real("quantity"),
  unit: text("unit"),
  preferredDate: timestamp("preferred_date"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceOffers = pgTable("service_offers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  serviceRequestId: integer("service_request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  providerUserId: varchar("provider_user_id").notNull().references(() => users.id),
  providerCompanyId: integer("provider_company_id").references(() => companyProfiles.id),
  price: real("price").notNull(),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  estimatedDuration: text("estimated_duration"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const endorsements = pgTable("endorsements", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id),
  toCompanyProfileId: integer("to_company_profile_id").notNull().references(() => companyProfiles.id),
  relationship: varchar("relationship", { length: 100 }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceRequestRelations = relations(serviceRequests, ({ one, many }) => ({
  requester: one(users, { fields: [serviceRequests.requesterId], references: [users.id] }),
  port: one(ports, { fields: [serviceRequests.portId], references: [ports.id] }),
  voyage: one(voyages, { fields: [serviceRequests.voyageId], references: [voyages.id] }),
  offers: many(serviceOffers),
}));

export const serviceOfferRelations = relations(serviceOffers, ({ one }) => ({
  serviceRequest: one(serviceRequests, { fields: [serviceOffers.serviceRequestId], references: [serviceRequests.id] }),
  provider: one(users, { fields: [serviceOffers.providerUserId], references: [users.id] }),
  providerCompany: one(companyProfiles, { fields: [serviceOffers.providerCompanyId], references: [companyProfiles.id] }),
}));

export const endorsementRelations = relations(endorsements, ({ one }) => ({
  fromUser: one(users, { fields: [endorsements.fromUserId], references: [users.id] }),
  toCompanyProfile: one(companyProfiles, { fields: [endorsements.toCompanyProfileId], references: [companyProfiles.id] }),
}));

export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ createdAt: true, status: true });
export const insertServiceOfferSchema = createInsertSchema(serviceOffers).omit({ createdAt: true, status: true });
export const insertEndorsementSchema = createInsertSchema(endorsements).omit({ createdAt: true });

export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceOffer = z.infer<typeof insertServiceOfferSchema>;
export type ServiceOffer = typeof serviceOffers.$inferSelect;
export type InsertEndorsement = z.infer<typeof insertEndorsementSchema>;
export type Endorsement = typeof endorsements.$inferSelect;
