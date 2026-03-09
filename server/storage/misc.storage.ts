import { db, eq, and, asc, desc } from "./base";
import {
  laytimeSheets, daAdvances, portExpenses,
  fdaMappingTemplates, documentTemplates,
  type LaytimeSheet, type InsertLaytimeSheet,
  type DaAdvance, type InsertDaAdvance,
  type PortExpense, type InsertPortExpense,
  type FdaMappingTemplate, type InsertFdaMappingTemplate,
} from "@shared/schema";

async function getLaytimeSheetsByUser(userId: string): Promise<LaytimeSheet[]> {
  return db.select().from(laytimeSheets).where(eq(laytimeSheets.userId, userId)).orderBy(desc(laytimeSheets.updatedAt));
}

async function getLaytimeSheetsByVoyage(voyageId: number): Promise<LaytimeSheet[]> {
  return db.select().from(laytimeSheets).where(eq(laytimeSheets.voyageId, voyageId)).orderBy(desc(laytimeSheets.updatedAt));
}

async function getLaytimeSheet(id: number): Promise<LaytimeSheet | undefined> {
  const [row] = await db.select().from(laytimeSheets).where(eq(laytimeSheets.id, id));
  return row;
}

async function createLaytimeSheet(data: InsertLaytimeSheet): Promise<LaytimeSheet> {
  const [row] = await db.insert(laytimeSheets).values(data).returning();
  return row;
}

async function updateLaytimeSheet(id: number, data: Partial<InsertLaytimeSheet>): Promise<LaytimeSheet> {
  const [row] = await db.update(laytimeSheets).set({ ...data, updatedAt: new Date() }).where(eq(laytimeSheets.id, id)).returning();
  return row;
}

async function deleteLaytimeSheet(id: number): Promise<void> {
  await db.delete(laytimeSheets).where(eq(laytimeSheets.id, id));
}

async function getDaAdvancesByUser(userId: string): Promise<DaAdvance[]> {
  return db.select().from(daAdvances).where(eq(daAdvances.userId, userId)).orderBy(desc(daAdvances.createdAt));
}

async function getDaAdvancesByVoyage(voyageId: number): Promise<DaAdvance[]> {
  return db.select().from(daAdvances).where(eq(daAdvances.voyageId, voyageId)).orderBy(desc(daAdvances.createdAt));
}

async function getDaAdvance(id: number): Promise<DaAdvance | undefined> {
  const [row] = await db.select().from(daAdvances).where(eq(daAdvances.id, id));
  return row;
}

async function createDaAdvance(data: InsertDaAdvance): Promise<DaAdvance> {
  const [row] = await db.insert(daAdvances).values(data).returning();
  return row;
}

async function updateDaAdvance(id: number, data: Partial<InsertDaAdvance>): Promise<DaAdvance> {
  const [row] = await db.update(daAdvances).set({ ...data, updatedAt: new Date() }).where(eq(daAdvances.id, id)).returning();
  return row;
}

async function deleteDaAdvance(id: number): Promise<void> {
  await db.delete(daAdvances).where(eq(daAdvances.id, id));
}

async function getPortExpensesByUser(userId: string): Promise<PortExpense[]> {
  return db.select().from(portExpenses)
    .where(eq(portExpenses.userId, userId))
    .orderBy(desc(portExpenses.expenseDate));
}

async function getPortExpensesByVoyage(voyageId: number): Promise<PortExpense[]> {
  return db.select().from(portExpenses)
    .where(eq(portExpenses.voyageId, voyageId))
    .orderBy(desc(portExpenses.expenseDate));
}

async function getPortExpensesByFda(fdaId: number): Promise<PortExpense[]> {
  return db.select().from(portExpenses)
    .where(eq(portExpenses.fdaId, fdaId))
    .orderBy(desc(portExpenses.expenseDate));
}

async function createPortExpense(data: InsertPortExpense): Promise<PortExpense> {
  const [expense] = await db.insert(portExpenses).values(data).returning();
  return expense;
}

async function updatePortExpense(id: number, data: Partial<InsertPortExpense>): Promise<PortExpense | undefined> {
  const [updated] = await db.update(portExpenses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(portExpenses.id, id))
    .returning();
  return updated;
}

async function deletePortExpense(id: number): Promise<boolean> {
  const result = await db.delete(portExpenses).where(eq(portExpenses.id, id)).returning();
  return result.length > 0;
}

async function getFdaMappingTemplates(userId: string): Promise<FdaMappingTemplate[]> {
  return db.select().from(fdaMappingTemplates)
    .where(eq(fdaMappingTemplates.userId, userId))
    .orderBy(desc(fdaMappingTemplates.createdAt));
}

async function createFdaMappingTemplate(data: InsertFdaMappingTemplate): Promise<FdaMappingTemplate> {
  const [created] = await db.insert(fdaMappingTemplates).values(data).returning();
  return created;
}

async function updateFdaMappingTemplate(id: number, userId: string, data: Partial<InsertFdaMappingTemplate>): Promise<FdaMappingTemplate | undefined> {
  const [updated] = await db.update(fdaMappingTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(fdaMappingTemplates.id, id), eq(fdaMappingTemplates.userId, userId)))
    .returning();
  return updated;
}

async function deleteFdaMappingTemplate(id: number, userId: string): Promise<boolean> {
  const [deleted] = await db.delete(fdaMappingTemplates)
    .where(and(eq(fdaMappingTemplates.id, id), eq(fdaMappingTemplates.userId, userId)))
    .returning();
  return !!deleted;
}

async function setFdaMappingTemplateDefault(id: number, userId: string): Promise<boolean> {
  await db.update(fdaMappingTemplates)
    .set({ isDefault: false })
    .where(eq(fdaMappingTemplates.userId, userId));
  const [updated] = await db.update(fdaMappingTemplates)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(fdaMappingTemplates.id, id), eq(fdaMappingTemplates.userId, userId)))
    .returning();
  return !!updated;
}

export const miscStorage = {
  getLaytimeSheetsByUser,
  getLaytimeSheetsByVoyage,
  getLaytimeSheet,
  createLaytimeSheet,
  updateLaytimeSheet,
  deleteLaytimeSheet,
  getDaAdvancesByUser,
  getDaAdvancesByVoyage,
  getDaAdvance,
  createDaAdvance,
  updateDaAdvance,
  deleteDaAdvance,
  getPortExpensesByUser,
  getPortExpensesByVoyage,
  getPortExpensesByFda,
  createPortExpense,
  updatePortExpense,
  deletePortExpense,
  getFdaMappingTemplates,
  createFdaMappingTemplate,
  updateFdaMappingTemplate,
  deleteFdaMappingTemplate,
  setFdaMappingTemplateDefault,
};
