import { eventBus } from "../event-bus";
import { storage } from "../../storage";

eventBus.on("proforma.approved", async (data: any) => {
  try {
    await storage.createNotification({
      userId: data.userId,
      type: "pda_approved",
      title: "Proforma Approved",
      message: `Your proforma has been approved.`,
      link: `/proformas/${data.proformaId}`,
    });
  } catch (err) {
    console.error("[notification.listener] proforma.approved:", err);
  }
});

eventBus.on("proforma.rejected", async (data: any) => {
  try {
    await storage.createNotification({
      userId: data.userId,
      type: "pda_rejected",
      title: "Proforma Rejected",
      message: data.reason ? `Proforma rejected: ${data.reason}` : "Your proforma has been rejected.",
      link: `/proformas/${data.proformaId}`,
    });
  } catch (err) {
    console.error("[notification.listener] proforma.rejected:", err);
  }
});

eventBus.on("tender.bidReceived", async (data: any) => {
  try {
    const tender = await storage.getPortTenderById(data.tenderId);
    if (tender) {
      await storage.createNotification({
        userId: tender.userId,
        type: "bid_received",
        title: "New Bid Received",
        message: `A new bid has been submitted for your tender.`,
        link: `/tenders/${data.tenderId}`,
      });
    }
  } catch (err) {
    console.error("[notification.listener] tender.bidReceived:", err);
  }
});

eventBus.on("tender.nominated", async (data: any) => {
  try {
    await storage.createNotification({
      userId: data.agentUserId,
      type: "tender_nominated",
      title: "You Have Been Nominated",
      message: "You have been nominated as the winning agent for a tender.",
      link: `/tenders/${data.tenderId}`,
    });
  } catch (err) {
    console.error("[notification.listener] tender.nominated:", err);
  }
});

eventBus.on("nomination.created", async (data: any) => {
  try {
    await storage.createNotification({
      userId: data.agentUserId,
      type: "nomination_received",
      title: "New Nomination",
      message: "You have received a new direct nomination.",
      link: `/nominations/${data.nominationId}`,
    });
  } catch (err) {
    console.error("[notification.listener] nomination.created:", err);
  }
});

eventBus.on("message.received", async (data: any) => {
  try {
    await storage.createNotification({
      userId: data.receiverId,
      type: "new_message",
      title: "New Message",
      message: "You have a new message.",
      link: `/messages`,
    });
  } catch (err) {
    console.error("[notification.listener] message.received:", err);
  }
});

eventBus.on("invoice.overdue", async (data: any) => {
  try {
    await storage.createNotification({
      userId: data.userId,
      type: "invoice_overdue",
      title: "Invoice Overdue",
      message: `An invoice is ${data.daysOverdue} days overdue.`,
      link: `/invoices/${data.invoiceId}`,
    });
  } catch (err) {
    console.error("[notification.listener] invoice.overdue:", err);
  }
});
