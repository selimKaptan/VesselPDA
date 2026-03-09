import { db, eq, and, isNull, asc, desc, cached, invalidateCacheByPrefix } from "./base";
import {
  bunkerOrders, bunkerRobs, bunkerPrices,
  cargoPositions, fixtures,
  type BunkerOrder, type InsertBunkerOrder,
  type BunkerRob, type InsertBunkerRob,
  type BunkerPrice, type InsertBunkerPrice,
  type CargoPosition, type InsertCargoPosition,
  type Fixture, type InsertFixture,
} from "@shared/schema";

async function getBunkerOrders(vesselId: number): Promise<BunkerOrder[]> {
  return db.select().from(bunkerOrders)
    .where(eq(bunkerOrders.vesselId, vesselId))
    .orderBy(desc(bunkerOrders.orderDate));
}

async function createBunkerOrder(data: InsertBunkerOrder): Promise<BunkerOrder> {
  const [order] = await db.insert(bunkerOrders).values(data as any).returning();
  return order;
}

async function updateBunkerOrder(id: number, data: Partial<InsertBunkerOrder>): Promise<BunkerOrder | undefined> {
  const [updated] = await db.update(bunkerOrders).set(data).where(eq(bunkerOrders.id, id)).returning();
  return updated;
}

async function deleteBunkerOrder(id: number): Promise<boolean> {
  const [deleted] = await db.delete(bunkerOrders).where(eq(bunkerOrders.id, id)).returning();
  return !!deleted;
}

async function getBunkerRobs(vesselId: number): Promise<BunkerRob[]> {
  return db.select().from(bunkerRobs)
    .where(eq(bunkerRobs.vesselId, vesselId))
    .orderBy(desc(bunkerRobs.reportDate));
}

async function createBunkerRob(data: InsertBunkerRob): Promise<BunkerRob> {
  const [rob] = await db.insert(bunkerRobs).values(data as any).returning();
  return rob;
}

async function getBunkerStats(vesselId: number): Promise<any> {
  const orders = await getBunkerOrders(vesselId);
  const robs = await getBunkerRobs(vesselId);
  const latestRob = robs[0];
  const totalCost = orders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
  const totalDelivered = orders.reduce((sum, o) => sum + (o.quantityDelivered || 0), 0);
  return {
    latestRob,
    totalCost,
    totalDelivered,
    orderCount: orders.length,
    lastReportDate: latestRob?.reportDate || null,
  };
}

async function getBunkerPrices(): Promise<BunkerPrice[]> {
  return cached("bunker:prices", "long", () =>
    db.select().from(bunkerPrices)
      .orderBy(asc(bunkerPrices.region), asc(bunkerPrices.portName))
  );
}

async function upsertBunkerPrice(data: InsertBunkerPrice): Promise<BunkerPrice> {
  const [row] = await db.insert(bunkerPrices).values({ ...data, updatedAt: new Date() }).returning();
  invalidateCacheByPrefix("bunker:", "long");
  return row;
}

async function deleteBunkerPrice(id: number): Promise<boolean> {
  const result = await db.delete(bunkerPrices).where(eq(bunkerPrices.id, id));
  return (result as any).rowCount > 0;
}

async function getCargoPositions(): Promise<CargoPosition[]> {
  return db.select().from(cargoPositions)
    .where(eq(cargoPositions.status, "active"))
    .orderBy(desc(cargoPositions.createdAt));
}

async function getMyCargoPositions(userId: string): Promise<CargoPosition[]> {
  return db.select().from(cargoPositions)
    .where(eq(cargoPositions.userId, userId))
    .orderBy(desc(cargoPositions.createdAt));
}

async function createCargoPosition(data: InsertCargoPosition): Promise<CargoPosition> {
  const [row] = await db.insert(cargoPositions).values({ ...data, status: "active" }).returning();
  return row;
}

async function updateCargoPosition(id: number, data: Partial<InsertCargoPosition & { status?: string }>): Promise<CargoPosition | undefined> {
  const [row] = await db.update(cargoPositions).set(data).where(eq(cargoPositions.id, id)).returning();
  return row;
}

async function deleteCargoPosition(id: number): Promise<boolean> {
  const result = await db.delete(cargoPositions).where(eq(cargoPositions.id, id));
  return (result as any).rowCount > 0;
}

async function getFixtures(userId: string): Promise<Fixture[]> {
  return db.select().from(fixtures)
    .where(and(eq(fixtures.userId, userId), isNull(fixtures.deletedAt)))
    .orderBy(desc(fixtures.createdAt));
}

async function getAllFixtures(): Promise<Fixture[]> {
  return db.select().from(fixtures)
    .where(isNull(fixtures.deletedAt))
    .orderBy(desc(fixtures.createdAt));
}

async function getFixture(id: number): Promise<Fixture | undefined> {
  const [row] = await db.select().from(fixtures).where(eq(fixtures.id, id));
  return row;
}

async function createFixture(data: InsertFixture): Promise<Fixture> {
  const [row] = await db.insert(fixtures).values({ ...data, status: "negotiating" }).returning();
  return row;
}

async function updateFixture(id: number, data: Partial<InsertFixture & { status?: string; recapText?: string }>): Promise<Fixture | undefined> {
  const [row] = await db.update(fixtures).set(data).where(eq(fixtures.id, id)).returning();
  return row;
}

async function deleteFixture(id: number): Promise<boolean> {
  const [updated] = await db.update(fixtures)
    .set({ deletedAt: new Date() })
    .where(and(eq(fixtures.id, id), isNull(fixtures.deletedAt)))
    .returning();
  return !!updated;
}

async function restoreFixture(id: number): Promise<boolean> {
  const [updated] = await db.update(fixtures)
    .set({ deletedAt: null })
    .where(eq(fixtures.id, id))
    .returning();
  return !!updated;
}

export const bunkerStorage = {
  getBunkerOrders,
  createBunkerOrder,
  updateBunkerOrder,
  deleteBunkerOrder,
  getBunkerRobs,
  createBunkerRob,
  getBunkerStats,
  getBunkerPrices,
  upsertBunkerPrice,
  deleteBunkerPrice,
  getCargoPositions,
  getMyCargoPositions,
  createCargoPosition,
  updateCargoPosition,
  deleteCargoPosition,
  getFixtures,
  getAllFixtures,
  getFixture,
  createFixture,
  updateFixture,
  deleteFixture,
  restoreFixture,
};
