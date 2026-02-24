import {
  type User, type UpsertUser,
  type Vessel, type InsertVessel,
  type Port, type InsertPort,
  type TariffCategory, type InsertTariffCategory,
  type TariffRate, type InsertTariffRate,
  type Proforma, type InsertProforma,
  vessels, ports, tariffCategories, tariffRates, proformas,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lte, gte, or, isNull, desc } from "drizzle-orm";

export interface IStorage {
  getVesselsByUser(userId: string): Promise<Vessel[]>;
  getVessel(id: number, userId: string): Promise<Vessel | undefined>;
  createVessel(vessel: InsertVessel): Promise<Vessel>;
  updateVessel(id: number, userId: string, data: Partial<InsertVessel>): Promise<Vessel | undefined>;
  deleteVessel(id: number, userId: string): Promise<boolean>;

  getPorts(): Promise<Port[]>;
  getPort(id: number): Promise<Port | undefined>;
  createPort(port: InsertPort): Promise<Port>;

  getTariffCategories(portId: number): Promise<TariffCategory[]>;
  createTariffCategory(cat: InsertTariffCategory): Promise<TariffCategory>;
  getTariffRates(categoryId: number): Promise<TariffRate[]>;
  createTariffRate(rate: InsertTariffRate): Promise<TariffRate>;
  getTariffRateForGrt(categoryId: number, grt: number): Promise<TariffRate | undefined>;

  getProformasByUser(userId: string): Promise<Proforma[]>;
  getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined>;
  createProforma(proforma: InsertProforma): Promise<Proforma>;
  deleteProforma(id: number, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getVesselsByUser(userId: string): Promise<Vessel[]> {
    return db.select().from(vessels).where(eq(vessels.userId, userId));
  }

  async getVessel(id: number, userId: string): Promise<Vessel | undefined> {
    const [vessel] = await db.select().from(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId)));
    return vessel;
  }

  async createVessel(vessel: InsertVessel): Promise<Vessel> {
    const [created] = await db.insert(vessels).values(vessel).returning();
    return created;
  }

  async updateVessel(id: number, userId: string, data: Partial<InsertVessel>): Promise<Vessel | undefined> {
    const [updated] = await db.update(vessels).set(data).where(and(eq(vessels.id, id), eq(vessels.userId, userId))).returning();
    return updated;
  }

  async deleteVessel(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(vessels).where(and(eq(vessels.id, id), eq(vessels.userId, userId))).returning();
    return result.length > 0;
  }

  async getPorts(): Promise<Port[]> {
    return db.select().from(ports);
  }

  async getPort(id: number): Promise<Port | undefined> {
    const [port] = await db.select().from(ports).where(eq(ports.id, id));
    return port;
  }

  async createPort(port: InsertPort): Promise<Port> {
    const [created] = await db.insert(ports).values(port).returning();
    return created;
  }

  async getTariffCategories(portId: number): Promise<TariffCategory[]> {
    return db.select().from(tariffCategories).where(eq(tariffCategories.portId, portId));
  }

  async createTariffCategory(cat: InsertTariffCategory): Promise<TariffCategory> {
    const [created] = await db.insert(tariffCategories).values(cat).returning();
    return created;
  }

  async getTariffRates(categoryId: number): Promise<TariffRate[]> {
    return db.select().from(tariffRates).where(eq(tariffRates.categoryId, categoryId));
  }

  async createTariffRate(rate: InsertTariffRate): Promise<TariffRate> {
    const [created] = await db.insert(tariffRates).values(rate).returning();
    return created;
  }

  async getTariffRateForGrt(categoryId: number, grt: number): Promise<TariffRate | undefined> {
    const rates = await db.select().from(tariffRates)
      .where(eq(tariffRates.categoryId, categoryId));
    
    const matching = rates.find(r => 
      grt >= r.minGrt && (r.maxGrt === null || grt <= r.maxGrt)
    );
    return matching || rates[rates.length - 1];
  }

  async getProformasByUser(userId: string): Promise<Proforma[]> {
    return db.select().from(proformas)
      .where(eq(proformas.userId, userId))
      .orderBy(desc(proformas.createdAt));
  }

  async getProforma(id: number, userId: string): Promise<(Proforma & { vessel?: Vessel; port?: Port }) | undefined> {
    const [proforma] = await db.select().from(proformas)
      .where(and(eq(proformas.id, id), eq(proformas.userId, userId)));
    
    if (!proforma) return undefined;

    const [vessel] = await db.select().from(vessels).where(eq(vessels.id, proforma.vesselId));
    const [port] = await db.select().from(ports).where(eq(ports.id, proforma.portId));

    return { ...proforma, vessel, port };
  }

  async createProforma(proforma: InsertProforma): Promise<Proforma> {
    const [created] = await db.insert(proformas).values(proforma).returning();
    return created;
  }

  async deleteProforma(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(proformas)
      .where(and(eq(proformas.id, id), eq(proformas.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
