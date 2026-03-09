import { db, eq, and, asc, desc } from "./base";
import {
  vesselEquipment, maintenanceJobs,
  type VesselEquipment, type InsertVesselEquipment,
  type MaintenanceJob, type InsertMaintenanceJob,
} from "@shared/schema";

async function getVesselEquipment(vesselId: number): Promise<VesselEquipment[]> {
  return db.select().from(vesselEquipment).where(eq(vesselEquipment.vesselId, vesselId)).orderBy(vesselEquipment.name);
}

async function createVesselEquipment(data: InsertVesselEquipment): Promise<VesselEquipment> {
  const [row] = await db.insert(vesselEquipment).values(data).returning();
  return row;
}

async function updateVesselEquipment(id: number, data: Partial<InsertVesselEquipment>): Promise<VesselEquipment | undefined> {
  const [row] = await db.update(vesselEquipment).set(data).where(eq(vesselEquipment.id, id)).returning();
  return row;
}

async function deleteVesselEquipment(id: number): Promise<boolean> {
  const [deleted] = await db.delete(vesselEquipment).where(eq(vesselEquipment.id, id)).returning();
  return !!deleted;
}

async function getMaintenanceJobs(vesselId: number, options?: { equipmentId?: number; status?: string }): Promise<any[]> {
  const conditions = [eq(maintenanceJobs.vesselId, vesselId)];
  if (options?.equipmentId) conditions.push(eq(maintenanceJobs.equipmentId, options.equipmentId));
  if (options?.status) conditions.push(eq(maintenanceJobs.status, options.status));
  return db.select().from(maintenanceJobs)
    .where(and(...conditions))
    .orderBy(desc(maintenanceJobs.nextDueDate), desc(maintenanceJobs.createdAt));
}

async function createMaintenanceJob(data: InsertMaintenanceJob): Promise<MaintenanceJob> {
  const [row] = await db.insert(maintenanceJobs).values(data).returning();
  return row;
}

async function updateMaintenanceJob(id: number, data: Partial<InsertMaintenanceJob>): Promise<MaintenanceJob | undefined> {
  const [row] = await db.update(maintenanceJobs).set(data).where(eq(maintenanceJobs.id, id)).returning();
  return row;
}

async function getMaintenanceSummary(vesselId: number): Promise<any> {
  const jobs = await getMaintenanceJobs(vesselId);
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    total: jobs.length,
    overdue: jobs.filter(j => j.status === 'overdue' || (j.nextDueDate && new Date(j.nextDueDate) < now && j.status !== 'completed')).length,
    upcoming: jobs.filter(j => j.nextDueDate && new Date(j.nextDueDate) >= now && new Date(j.nextDueDate) <= thirtyDays && j.status !== 'completed').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };
}

export const maintenanceStorage = {
  getVesselEquipment,
  createVesselEquipment,
  updateVesselEquipment,
  deleteVesselEquipment,
  getMaintenanceJobs,
  createMaintenanceJob,
  updateMaintenanceJob,
  getMaintenanceSummary,
};
