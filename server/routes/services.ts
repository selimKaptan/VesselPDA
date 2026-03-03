import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

// ─── SERVICE REQUESTS ─────────────────────────────────────────────────────────

router.get("/service-requests", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const role = req.user?.activeRole || req.user?.userRole || "shipowner";
    if (role === "provider") {
      const profile = await storage.getCompanyProfile(userId);
      const portIds: number[] = (profile?.servedPorts as any[]) || [];
      const requests = await storage.getServiceRequestsByPort(portIds);
      const myOffers = await storage.getProviderOffersByUser(userId);
      res.json({ requests, myOffers });
    } else {
      const requests = await storage.getServiceRequestsByUser(userId);
      res.json({ requests, myOffers: [] });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch service requests" });
  }
});

router.post("/service-requests", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const data = { ...req.body, requesterId: userId };
    if (data.preferredDate) data.preferredDate = new Date(data.preferredDate);
    const request = await storage.createServiceRequest(data);
    // Notify providers in this port
    const providers = await storage.getAgentsByPort(data.portId);
    for (const p of providers) {
      if (p.userId) {
        await storage.createNotification({
          userId: p.userId,
          type: "service_request",
          title: "Yeni Hizmet Talebi",
          message: `${data.serviceType} hizmeti için yeni bir talep oluşturuldu: ${data.vesselName}`,
          link: `/service-requests/${request.id}`,
        });
      }
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to create service request" });
  }
});

router.get("/service-requests/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const request = await storage.getServiceRequestById(id);
    if (!request) return res.status(404).json({ message: "Not found" });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch service request" });
  }
});

router.post("/service-requests/:id/offers", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const serviceRequestId = parseInt(req.params.id);
    const companyId = await storage.getProviderCompanyIdByUser(userId);
    const offer = await storage.createServiceOffer({
      ...req.body,
      serviceRequestId,
      providerUserId: userId,
      providerCompanyId: companyId,
    });
    // Notify requester
    const sr = await storage.getServiceRequestById(serviceRequestId);
    if (sr) {
      await storage.createNotification({
        userId: sr.requesterId,
        type: "service_offer",
        title: "Yeni Hizmet Teklifi",
        message: `${sr.vesselName} için hizmet talebinize yeni bir teklif geldi`,
        link: `/service-requests/${serviceRequestId}`,
      });
    }
    res.json(offer);
  } catch (error) {
    res.status(500).json({ message: "Failed to submit offer" });
  }
});

router.post("/service-requests/:id/offers/:offerId/select", isAuthenticated, async (req: any, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const offerId = parseInt(req.params.offerId);
    const offer = await storage.selectServiceOffer(offerId, requestId);
    if (!offer) return res.status(404).json({ message: "Offer not found" });
    // Notify selected provider
    await storage.createNotification({
      userId: offer.providerUserId,
      type: "service_offer_selected",
      title: "Teklifiniz Seçildi",
      message: "Hizmet teklifiniz kabul edildi",
      link: `/service-requests/${requestId}`,
    });
    res.json(offer);
  } catch (error) {
    res.status(500).json({ message: "Failed to select offer" });
  }
});

router.patch("/service-requests/:id/status", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const request = await storage.updateServiceRequestStatus(id, status);
    if (!request) return res.status(404).json({ message: "Not found" });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to update status" });
  }
});


export default router;
