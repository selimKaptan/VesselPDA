import { db, eq, and, desc, count, sql } from "./base";
import { emitToUser } from "../socket";
import {
  notifications, feedbacks, notificationPreferences,
  type Notification, type InsertNotification,
  type Feedback, type InsertFeedback,
  type NotificationPreference, type InsertNotificationPreference,
} from "@shared/schema";

async function createNotification(data: InsertNotification): Promise<Notification> {
  const [row] = await db.insert(notifications).values(data).returning();
  try { emitToUser(data.userId, "new_notification", row); } catch {}
  return row;
}

async function getNotifications(userId: string): Promise<Notification[]> {
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

async function getUnreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return row?.cnt ?? 0;
}

async function markNotificationRead(id: number, userId: string): Promise<void> {
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}

async function getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined> {
  const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  return prefs;
}

async function upsertNotificationPreferences(userId: string, data: Partial<InsertNotificationPreference>): Promise<NotificationPreference> {
  const [existing] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  if (existing) {
    const [updated] = await db.update(notificationPreferences).set({ ...data, updatedAt: new Date() }).where(eq(notificationPreferences.userId, userId)).returning();
    return updated;
  } else {
    const [created] = await db.insert(notificationPreferences).values({ ...data, userId } as any).returning();
    return created;
  }
}

async function createFeedback(data: InsertFeedback): Promise<Feedback> {
  const [row] = await db.insert(feedbacks).values(data).returning();
  return row;
}

async function getAllFeedbacks(): Promise<Feedback[]> {
  return db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt));
}

export const notificationStorage = {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  upsertNotificationPreferences,
  createFeedback,
  getAllFeedbacks,
};
