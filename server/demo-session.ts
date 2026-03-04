import { randomUUID } from "crypto";

export type DemoRole = "ship_agent" | "shipowner" | "ship_broker" | "ship_provider";

export const VALID_DEMO_ROLES: DemoRole[] = ["ship_agent", "shipowner", "ship_broker", "ship_provider"];

export interface DemoSession {
  token: string;
  role: DemoRole;
  createdAt: Date;
  lastAccessedAt: Date;
}

const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map<string, DemoSession>();

export function createDemoSession(role: DemoRole = "ship_agent"): DemoSession {
  const token = `demo_${randomUUID().replace(/-/g, "")}`;
  const now = new Date();
  const session: DemoSession = { token, role, createdAt: now, lastAccessedAt: now };
  sessions.set(token, session);
  return session;
}

export function getDemoSession(token: string): DemoSession | null {
  const session = sessions.get(token);
  if (!session) return null;
  const age = Date.now() - session.createdAt.getTime();
  if (age > DEMO_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  session.lastAccessedAt = new Date();
  return session;
}

export function updateDemoRole(token: string, role: DemoRole): DemoSession | null {
  const session = getDemoSession(token);
  if (!session) return null;
  session.role = role;
  return session;
}

export function deleteDemoSession(token: string): void {
  sessions.delete(token);
}

export function cleanExpiredDemoSessions(): number {
  const now = Date.now();
  let deleted = 0;
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt.getTime() > DEMO_TTL_MS) {
      sessions.delete(token);
      deleted++;
    }
  }
  return deleted;
}

export function getDemoSessionCount(): number {
  return sessions.size;
}

export function listDemoSessions(): DemoSession[] {
  return Array.from(sessions.values());
}
