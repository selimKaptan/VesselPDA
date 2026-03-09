import { db, eq, desc, sql } from "./base";
import { users } from "@shared/models/auth";
import type { User } from "@shared/models/auth";

async function getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

async function updateUserRole(userId: string, role: string): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ userRole: role, roleConfirmed: true, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

async function updateUserOnboarding(userId: string, data: { onboardingCompleted?: boolean; onboardingStep?: number }): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

async function updateActiveRole(userId: string, activeRole: string): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ activeRole, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

async function incrementProformaCount(userId: string): Promise<void> {
  await db.update(users)
    .set({ proformaCount: sql`${users.proformaCount} + 1` })
    .where(eq(users.id, userId));
}

async function updateSubscription(userId: string, plan: string, limit: number): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ subscriptionPlan: plan, proformaLimit: limit, proformaCount: 0, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

async function getAllUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(desc(users.createdAt));
}

async function updateUserSubscription(userId: string, plan: string): Promise<User | undefined> {
  const limitMap: Record<string, number> = { free: 1, standard: 10, unlimited: 9999 };
  const limit = limitMap[plan] ?? 1;
  const [updated] = await db.update(users)
    .set({ subscriptionPlan: plan, proformaLimit: limit, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

async function suspendUser(userId: string, suspended: boolean): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ isSuspended: suspended, updatedAt: new Date() } as any)
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export const userStorage = {
  getUser,
  updateUserRole,
  updateUserOnboarding,
  updateActiveRole,
  incrementProformaCount,
  updateSubscription,
  getAllUsers,
  updateUserSubscription,
  suspendUser,
};
