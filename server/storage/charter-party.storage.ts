import { db, eq, desc } from "./base";
import {
  charterParties, hirePayments, offHireEvents,
  type CharterParty, type InsertCharterParty,
  type HirePayment, type InsertHirePayment,
  type OffHireEvent, type InsertOffHireEvent,
} from "@shared/schema";

async function getCharterParties(userId: string): Promise<CharterParty[]> {
  return db.select().from(charterParties).where(eq(charterParties.userId, userId)).orderBy(desc(charterParties.cpDate));
}

async function getCharterParty(id: number): Promise<CharterParty | undefined> {
  const [row] = await db.select().from(charterParties).where(eq(charterParties.id, id));
  return row;
}

async function createCharterParty(data: InsertCharterParty): Promise<CharterParty> {
  const [row] = await db.insert(charterParties).values(data).returning();
  return row;
}

async function updateCharterParty(id: number, data: Partial<InsertCharterParty>): Promise<CharterParty | undefined> {
  const [row] = await db.update(charterParties).set(data).where(eq(charterParties.id, id)).returning();
  return row;
}

async function deleteCharterParty(id: number): Promise<boolean> {
  const [deleted] = await db.delete(charterParties).where(eq(charterParties.id, id)).returning();
  return !!deleted;
}

async function getHirePayments(charterPartyId: number): Promise<HirePayment[]> {
  return db.select().from(hirePayments).where(eq(hirePayments.charterPartyId, charterPartyId)).orderBy(desc(hirePayments.periodFrom));
}

async function createHirePayment(data: InsertHirePayment): Promise<HirePayment> {
  const [row] = await db.insert(hirePayments).values(data).returning();
  return row;
}

async function updateHirePayment(id: number, data: Partial<InsertHirePayment>): Promise<HirePayment | undefined> {
  const [row] = await db.update(hirePayments).set(data).where(eq(hirePayments.id, id)).returning();
  return row;
}

async function getOffHireEvents(charterPartyId: number): Promise<OffHireEvent[]> {
  return db.select().from(offHireEvents).where(eq(offHireEvents.charterPartyId, charterPartyId)).orderBy(desc(offHireEvents.startDatetime));
}

async function createOffHireEvent(data: InsertOffHireEvent): Promise<OffHireEvent> {
  const [row] = await db.insert(offHireEvents).values(data).returning();
  return row;
}

async function updateOffHireEvent(id: number, data: Partial<InsertOffHireEvent>): Promise<OffHireEvent | undefined> {
  const [row] = await db.update(offHireEvents).set(data).where(eq(offHireEvents.id, id)).returning();
  return row;
}

export const charterPartyStorage = {
  getCharterParties,
  getCharterParty,
  createCharterParty,
  updateCharterParty,
  deleteCharterParty,
  getHirePayments,
  createHirePayment,
  updateHirePayment,
  getOffHireEvents,
  createOffHireEvent,
  updateOffHireEvent,
};
