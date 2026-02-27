import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  userRole: varchar("user_role").notNull().default("shipowner"),
  activeRole: varchar("active_role"),
  roleConfirmed: boolean("role_confirmed").notNull().default(false),
  subscriptionPlan: varchar("subscription_plan").notNull().default("free"),
  proformaCount: integer("proforma_count").notNull().default(0),
  proformaLimit: integer("proforma_limit").notNull().default(1),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordTokenExpiry: timestamp("reset_password_token_expiry"),
  isSuspended: boolean("is_suspended").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companyProfiles = pgTable("company_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyName: text("company_name").notNull(),
  companyType: varchar("company_type").notNull().default("agent"),
  description: text("description"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  country: text("country").default("Turkey"),
  servedPorts: jsonb("served_ports").$type<number[]>().default([]),
  serviceTypes: jsonb("service_types").$type<string[]>().default([]),
  logoUrl: text("logo_url"),
  isFeatured: boolean("is_featured").notNull().default(false),
  featuredUntil: timestamp("featured_until"),
  isActive: boolean("is_active").notNull().default(true),
  isApproved: boolean("is_approved").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = typeof companyProfiles.$inferInsert;
