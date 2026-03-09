import { db, eq, and, desc, count } from "./base";
import {
  directNominations, users, ports, companyProfiles,
  type DirectNomination, type InsertDirectNomination,
} from "@shared/schema";

async function _enrichNominations(rows: any[]): Promise<any[]> {
  return Promise.all(rows.map(async (nom) => {
    const [nominator] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, nom.nominatorUserId));
    const [agent] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, nom.agentUserId));
    const [port] = await db.select({ name: ports.name, code: ports.code }).from(ports).where(eq(ports.id, nom.portId));
    let agentCompanyName: string | null = null;
    if (nom.agentCompanyId) {
      const [cp] = await db.select({ companyName: companyProfiles.companyName }).from(companyProfiles).where(eq(companyProfiles.id, nom.agentCompanyId));
      agentCompanyName = cp?.companyName ?? null;
    }
    return {
      ...nom,
      nominatorName: [nominator?.firstName, nominator?.lastName].filter(Boolean).join(" ") || nominator?.email || "User",
      agentName: [agent?.firstName, agent?.lastName].filter(Boolean).join(" ") || agent?.email || "Agent",
      agentCompanyName,
      portName: port?.name ?? `Port #${nom.portId}`,
      portCode: port?.code ?? null,
    };
  }));
}

async function createNomination(data: InsertDirectNomination): Promise<DirectNomination> {
  const [nom] = await db.insert(directNominations).values(data).returning();
  return nom;
}

async function getNominationsByNominator(userId: string): Promise<any[]> {
  const rows = await db.select().from(directNominations)
    .where(eq(directNominations.nominatorUserId, userId))
    .orderBy(desc(directNominations.createdAt));
  return _enrichNominations(rows);
}

async function getNominationsByAgent(userId: string): Promise<any[]> {
  const rows = await db.select().from(directNominations)
    .where(eq(directNominations.agentUserId, userId))
    .orderBy(desc(directNominations.createdAt));
  return _enrichNominations(rows);
}

async function getNominationById(id: number): Promise<any | undefined> {
  const [row] = await db.select().from(directNominations).where(eq(directNominations.id, id));
  if (!row) return undefined;
  const enriched = await _enrichNominations([row]);
  return enriched[0];
}

async function updateNominationStatus(id: number, status: string): Promise<DirectNomination | undefined> {
  const [updated] = await db.update(directNominations)
    .set({ status, respondedAt: new Date() })
    .where(eq(directNominations.id, id))
    .returning();
  return updated;
}

async function getPendingNominationCountForAgent(userId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(directNominations)
    .where(and(eq(directNominations.agentUserId, userId), eq(directNominations.status, "pending")));
  return Number(row?.cnt ?? 0);
}

export const nominationStorage = {
  createNomination,
  getNominationsByNominator,
  getNominationsByAgent,
  getNominationById,
  updateNominationStatus,
  getPendingNominationCountForAgent,
};
