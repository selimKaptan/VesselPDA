import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, serial } from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "../models/auth";

export interface OrgPermissions {
  canCreateProforma?: boolean;
  canApproveProforma?: boolean;
  canCreateTender?: boolean;
  canManageVoyages?: boolean;
  canManageVessels?: boolean;
  canViewFinance?: boolean;
  canManageTeam?: boolean;
  canSendMessages?: boolean;
}

export const DEFAULT_ORG_PERMISSIONS: Record<string, OrgPermissions> = {
  owner:   { canCreateProforma: true, canApproveProforma: true, canCreateTender: true, canManageVoyages: true, canManageVessels: true, canViewFinance: true, canManageTeam: true, canSendMessages: true },
  admin:   { canCreateProforma: true, canApproveProforma: true, canCreateTender: true, canManageVoyages: true, canManageVessels: true, canViewFinance: true, canManageTeam: true, canSendMessages: true },
  manager: { canCreateProforma: true, canApproveProforma: false, canCreateTender: true, canManageVoyages: true, canManageVessels: true, canViewFinance: false, canManageTeam: false, canSendMessages: true },
  member:  { canCreateProforma: true, canApproveProforma: false, canCreateTender: false, canManageVoyages: true, canManageVessels: false, canViewFinance: false, canManageTeam: false, canSendMessages: true },
  viewer:  { canCreateProforma: false, canApproveProforma: false, canCreateTender: false, canManageVoyages: false, canManageVessels: false, canViewFinance: false, canManageTeam: false, canSendMessages: false },
};

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  type: text("type").default("other"),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  logoUrl: text("logo_url"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  country: text("country"),
  taxId: text("tax_id"),
  subscriptionPlan: text("subscription_plan").default("free"),
  maxMembers: integer("max_members").default(5),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  displayName: text("display_name"),
  department: text("department"),
  jobTitle: text("job_title"),
  permissions: jsonb("permissions").$type<OrgPermissions>().default({}),
  invitedBy: varchar("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  roleId: integer("role_id"),
});

export const organizationInvites = pgTable("organization_invites", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"),
  token: text("token").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  invites: many(organizationInvites),
}));

export const orgMemberRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
}));

export const orgInviteRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, { fields: [organizationInvites.organizationId], references: [organizations.id] }),
}));

export const insertOrgSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().optional(),
  logoUrl: z.string().optional(),
  industry: z.string().optional(),
  maxMembers: z.number().int().optional(),
});

export const insertOrgInviteSchema = z.object({
  email: z.string().email(),
  orgRole: z.string().default("member"),
  role: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
});

export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type InsertOrgInvite = z.infer<typeof insertOrgInviteSchema>;
