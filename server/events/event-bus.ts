import { EventEmitter } from "events";

class AppEventBus extends EventEmitter {
  emitEvent(event: string, data: any) {
    console.log(`[event] ${event}`, JSON.stringify(data).slice(0, 200));
    this.emit(event, data);
  }
}

export const eventBus = new AppEventBus();
eventBus.setMaxListeners(50);

export type AppEvents = {
  "proforma.created": { proformaId: number; userId: string; vesselName: string; portName: string };
  "proforma.approved": { proformaId: number; userId: string; approvedBy: string };
  "proforma.rejected": { proformaId: number; userId: string; reason?: string };
  "voyage.created": { voyageId: number; userId: string; vesselName: string };
  "voyage.statusChanged": { voyageId: number; userId: string; oldStatus: string; newStatus: string };
  "invoice.created": { invoiceId: number; userId: string; amount: number; currency: string };
  "invoice.paid": { invoiceId: number; userId: string; amount: number };
  "invoice.overdue": { invoiceId: number; userId: string; daysOverdue: number };
  "tender.created": { tenderId: number; userId: string; portId: number };
  "tender.bidReceived": { tenderId: number; bidId: number; agentUserId: string };
  "tender.nominated": { tenderId: number; agentUserId: string };
  "nomination.created": { nominationId: number; agentUserId: string };
  "nomination.responded": { nominationId: number; status: string };
  "certificate.expiring": { certId: number; userId: string; daysLeft: number; vesselName: string };
  "message.received": { conversationId: number; senderId: string; receiverId: string };
  "fda.created": { fdaId: number; userId: string; voyageId?: number };
  "da-advance.created": { advanceId: number; userId: string; amount: number };
};
