import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { voyages } from "./voyage";
import { serviceRequests } from "./service";

export const conversations = pgTable("conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  user1Id: varchar("user1_id").notNull().references(() => users.id),
  user2Id: varchar("user2_id").notNull().references(() => users.id),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  externalEmail: text("external_email"),
  externalEmailName: text("external_email_name"),
  externalEmailForward: boolean("external_email_forward").notNull().default(false),
});

export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  messageType: text("message_type").notNull().default("text"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  readAt: timestamp("read_at"),
  mentions: text("mentions"),
}, (table) => ({
  convIdx: index("messages_conv_idx").on(table.conversationId),
}));

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userReadIdx: index("notifications_user_read_idx").on(table.userId, table.isRead),
}));

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  emailOnProformaApproval: boolean("email_on_proforma_approval").default(true),
  emailOnFdaReady: boolean("email_on_fda_ready").default(true),
  emailOnInvoiceCreated: boolean("email_on_invoice_created").default(true),
  emailOnDaAdvance: boolean("email_on_da_advance").default(true),
  emailOnCertExpiry: boolean("email_on_cert_expiry").default(true),
  emailOnNewMessage: boolean("email_on_new_message").default(true),
  emailOnVoyageUpdate: boolean("email_on_voyage_update").default(false),
  emailOnInvoiceDue: boolean("email_on_invoice_due").default(true),
  emailOnCertificateExpiry: boolean("email_on_certificate_expiry").default(true),
  emailOnDaAdvanceDue: boolean("email_on_da_advance_due").default(true),
  emailOnPaymentReceived: boolean("email_on_payment_received").default(true),
  inAppOnAll: boolean("in_app_on_all").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const feedbacks = pgTable("feedbacks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  message: text("message").notNull(),
  pageUrl: text("page_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  user1: one(users, { fields: [conversations.user1Id], references: [users.id] }),
  user2: one(users, { fields: [conversations.user2Id], references: [users.id] }),
  messages: many(messages),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const notificationPreferenceRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }),
}));

export const insertConversationSchema = createInsertSchema(conversations).omit({ createdAt: true, lastMessageAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ createdAt: true, isRead: true, readAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ createdAt: true, isRead: true });
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({ id: true, updatedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ createdAt: true });

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbacks.$inferSelect;
