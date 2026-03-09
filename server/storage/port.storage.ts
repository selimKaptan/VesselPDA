import { db, eq, and, or, ilike, desc, asc, lte, gte, cached } from "./base";
import {
  ports, tariffCategories, tariffRates, portAlerts,
  type Port, type InsertPort,
  type TariffCategory, type InsertTariffCategory,
  type TariffRate, type InsertTariffRate,
  type PortAlert, type InsertPortAlert,
} from "@shared/schema";

async function getPorts(limit = 100, country?: string): Promise<Port[]> {
  const key = `ports:${country ?? "all"}:${limit}`;
  return cached(key, "daily", async () => {
    if (country) {
      return db.select().from(ports)
        .where(eq(ports.country, country))
        .orderBy(ports.name);
    }
    return db.select().from(ports).orderBy(ports.name).limit(limit);
  });
}

async function searchPorts(query: string, countryCode?: string): Promise<Port[]> {
  const conditions: any[] = [
    or(
      ilike(ports.name, `%${query}%`),
      ilike(ports.code, `%${query}%`)
    ),
  ];
  if (countryCode) {
    conditions.push(eq(ports.country, countryCode.toUpperCase()));
  }
  return db.select().from(ports)
    .where(and(...conditions))
    .orderBy(ports.name)
    .limit(30);
}

async function getPortByCode(code: string): Promise<Port | undefined> {
  const [port] = await db.select().from(ports).where(ilike(ports.code, code));
  return port;
}

async function getPort(id: number): Promise<Port | undefined> {
  const [port] = await db.select().from(ports).where(eq(ports.id, id));
  return port;
}

async function createPort(port: InsertPort): Promise<Port> {
  const [created] = await db.insert(ports).values(port as any).returning();
  return created;
}

async function updatePortCoords(id: number, lat: number, lng: number): Promise<void> {
  await db.update(ports).set({ latitude: lat, longitude: lng }).where(eq(ports.id, id));
}

async function getTariffCategories(portId: number): Promise<TariffCategory[]> {
  return db.select().from(tariffCategories).where(eq(tariffCategories.portId, portId));
}

async function createTariffCategory(cat: InsertTariffCategory): Promise<TariffCategory> {
  const [created] = await db.insert(tariffCategories).values(cat as any).returning();
  return created;
}

async function getTariffRates(categoryId: number): Promise<TariffRate[]> {
  return db.select().from(tariffRates).where(eq(tariffRates.categoryId, categoryId));
}

async function createTariffRate(rate: InsertTariffRate): Promise<TariffRate> {
  const [created] = await db.insert(tariffRates).values(rate).returning();
  return created;
}

async function getTariffRateForGrt(categoryId: number, grt: number): Promise<TariffRate | undefined> {
  const rates = await db.select().from(tariffRates)
    .where(eq(tariffRates.categoryId, categoryId));
  const matching = rates.find(r =>
    grt >= r.minGrt && (r.maxGrt === null || grt <= r.maxGrt)
  );
  return matching || rates[rates.length - 1];
}

async function getPortAlerts(portId?: number, portName?: string): Promise<PortAlert[]> {
  const conditions: any[] = [eq(portAlerts.isActive, true)];
  if (portId) conditions.push(eq(portAlerts.portId, portId));
  const all = await db.select().from(portAlerts)
    .where(and(...conditions))
    .orderBy(desc(portAlerts.createdAt));
  if (portName && !portId) {
    const lower = portName.toLowerCase();
    return all.filter(a => !a.portName || a.portName.toLowerCase().includes(lower) || lower.includes(a.portName.toLowerCase()));
  }
  return all;
}

async function getAllPortAlerts(): Promise<PortAlert[]> {
  return db.select().from(portAlerts).orderBy(desc(portAlerts.createdAt));
}

async function createPortAlert(data: InsertPortAlert): Promise<PortAlert> {
  const [row] = await db.insert(portAlerts).values(data).returning();
  return row;
}

async function updatePortAlert(id: number, data: Partial<InsertPortAlert>): Promise<void> {
  await db.update(portAlerts).set(data).where(eq(portAlerts.id, id));
}

async function deletePortAlert(id: number): Promise<boolean> {
  const result = await db.delete(portAlerts).where(eq(portAlerts.id, id));
  return (result as any).rowCount > 0;
}

export const portStorage = {
  getPorts,
  searchPorts,
  getPortByCode,
  getPort,
  createPort,
  updatePortCoords,
  getTariffCategories,
  createTariffCategory,
  getTariffRates,
  createTariffRate,
  getTariffRateForGrt,
  getPortAlerts,
  getAllPortAlerts,
  createPortAlert,
  updatePortAlert,
  deletePortAlert,
};
