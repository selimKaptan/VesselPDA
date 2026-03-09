import { eventBus } from "../event-bus";
import { db } from "../../db";
import { auditLogs } from "@shared/schema";

const AUDIT_EVENTS = [
  "proforma.created",
  "proforma.approved",
  "proforma.rejected",
  "voyage.created",
  "voyage.statusChanged",
  "invoice.created",
  "invoice.paid",
  "invoice.overdue",
  "tender.created",
  "tender.bidReceived",
  "tender.nominated",
  "nomination.created",
  "nomination.responded",
  "fda.created",
  "da-advance.created",
];

for (const event of AUDIT_EVENTS) {
  eventBus.on(event, async (data: any) => {
    try {
      const entityType = event.split(".")[0];
      const entityIdKey = `${entityType}Id`;
      await db.insert(auditLogs).values({
        userId: data.userId || data.agentUserId || null,
        action: event,
        entityType,
        entityId: data[entityIdKey] ?? null,
        details: data,
      });
    } catch (err) {
      console.error(`[audit.listener] Failed to log ${event}:`, err);
    }
  });
}
