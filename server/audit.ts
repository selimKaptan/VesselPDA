import { db } from "./db";
import { auditLogs } from "@shared/schema";

export type AuditAction = "create" | "update" | "delete" | "approve" | "login" | "select" | "cancel" | "pay" | "ban" | "unban";

export function logAction(
  userId: string | null | undefined,
  action: AuditAction,
  entityType: string,
  entityId?: number | null,
  details?: Record<string, unknown> | null,
  ipAddress?: string | null,
): void {
  db.insert(auditLogs).values({
    userId: userId || null,
    action,
    entityType,
    entityId: entityId ?? null,
    details: details ?? null,
    ipAddress: ipAddress ?? null,
  }).execute().catch((err) => {
    console.warn("[audit] Failed to write audit log (non-critical):", err?.message);
  });
}

export function getClientIp(req: any): string | null {
  return (
    req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}
