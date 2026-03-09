import { db, eq, asc, desc } from "./base";
import {
  husbandryOrders, crewChanges,
  type HusbandryOrder, type InsertHusbandryOrder,
  type CrewChange, type InsertCrewChange,
} from "@shared/schema";

async function getHusbandryOrders(userId: string): Promise<HusbandryOrder[]> {
  return db.select().from(husbandryOrders).where(eq(husbandryOrders.userId, userId)).orderBy(desc(husbandryOrders.createdAt));
}

async function getVesselHusbandryOrders(vesselId: number): Promise<HusbandryOrder[]> {
  return db.select().from(husbandryOrders).where(eq(husbandryOrders.vesselId, vesselId)).orderBy(desc(husbandryOrders.createdAt));
}

async function createHusbandryOrder(data: InsertHusbandryOrder): Promise<HusbandryOrder> {
  const [row] = await db.insert(husbandryOrders).values(data).returning();
  return row;
}

async function updateHusbandryOrder(id: number, data: Partial<InsertHusbandryOrder>): Promise<HusbandryOrder | undefined> {
  const [row] = await db.update(husbandryOrders).set(data).where(eq(husbandryOrders.id, id)).returning();
  return row;
}

async function deleteHusbandryOrder(id: number): Promise<boolean> {
  const [deleted] = await db.delete(husbandryOrders).where(eq(husbandryOrders.id, id)).returning();
  return !!deleted;
}

async function getCrewChanges(husbandryOrderId: number): Promise<CrewChange[]> {
  return db.select().from(crewChanges).where(eq(crewChanges.husbandryOrderId, husbandryOrderId)).orderBy(asc(crewChanges.changeDate));
}

async function createCrewChange(data: InsertCrewChange): Promise<CrewChange> {
  const [row] = await db.insert(crewChanges).values(data).returning();
  return row;
}

async function updateCrewChange(id: number, data: Partial<InsertCrewChange>): Promise<CrewChange | undefined> {
  const [row] = await db.update(crewChanges).set(data).where(eq(crewChanges.id, id)).returning();
  return row;
}

export const husbandryStorage = {
  getHusbandryOrders,
  getVesselHusbandryOrders,
  createHusbandryOrder,
  updateHusbandryOrder,
  deleteHusbandryOrder,
  getCrewChanges,
  createCrewChange,
  updateCrewChange,
};
