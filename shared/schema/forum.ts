import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";

export const forumCategories = pgTable("forum_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#2563EB"),
  description: text("description"),
  topicCount: integer("topic_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumTopics = pgTable("forum_topics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => forumCategories.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  dislikeCount: integer("dislike_count").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumReplies = pgTable("forum_replies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  topicId: integer("topic_id").notNull().references(() => forumTopics.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  likeCount: integer("like_count").notNull().default(0),
  dislikeCount: integer("dislike_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumLikes = pgTable("forum_likes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  topicId: integer("topic_id").references(() => forumTopics.id),
  replyId: integer("reply_id").references(() => forumReplies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumDislikes = pgTable("forum_dislikes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  topicId: integer("topic_id").references(() => forumTopics.id),
  replyId: integer("reply_id").references(() => forumReplies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forumTopicRelations = relations(forumTopics, ({ one, many }) => ({
  category: one(forumCategories, { fields: [forumTopics.categoryId], references: [forumCategories.id] }),
  user: one(users, { fields: [forumTopics.userId], references: [users.id] }),
  replies: many(forumReplies),
}));

export const forumReplyRelations = relations(forumReplies, ({ one }) => ({
  topic: one(forumTopics, { fields: [forumReplies.topicId], references: [forumTopics.id] }),
  user: one(users, { fields: [forumReplies.userId], references: [users.id] }),
}));

export const insertForumCategorySchema = createInsertSchema(forumCategories).omit({ createdAt: true });
export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({ createdAt: true, lastActivityAt: true, viewCount: true, replyCount: true, likeCount: true, dislikeCount: true, isPinned: true, isLocked: true });
export const insertForumReplySchema = createInsertSchema(forumReplies).omit({ createdAt: true, likeCount: true, dislikeCount: true });

export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;
export type ForumCategory = typeof forumCategories.$inferSelect;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type ForumTopic = typeof forumTopics.$inferSelect;
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type ForumReply = typeof forumReplies.$inferSelect;
export type ForumLike = typeof forumLikes.$inferSelect;
export type ForumDislike = typeof forumDislikes.$inferSelect;
