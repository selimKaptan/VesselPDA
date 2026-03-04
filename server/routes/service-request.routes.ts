import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { insertServiceRequestSchema } from "@shared/schema";
import { emitToUser } from "../socket";
import { logAction } from "../audit";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
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


router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const srParsed = insertServiceRequestSchema.partial().safeParse(req.body);
    if (!srParsed.success) return res.status(400).json({ error: "Invalid input", details: srParsed.error.errors });
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


router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const request = await storage.getServiceRequestById(id);
    if (!request) return res.status(404).json({ message: "Not found" });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch service request" });
  }
});


router.post("/:id/offers", isAuthenticated, async (req: any, res) => {
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


router.post("/:id/offers/:offerId/select", isAuthenticated, async (req: any, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const offerId = parseInt(req.params.offerId);
    const offer = await storage.selectServiceOffer(offerId, requestId);
    if (!offer) return res.status(404).json({ message: "Offer not found" });
    // Notify selected provider
    await storage.createNotification({
      userId: offer.providerUserId,
      type: "service_offer_selected",
      title: "Your Offer Was Accepted",
      message: "Your service offer has been accepted.",
      link: `/service-requests/${requestId}`,
    });
    res.json(offer);
  } catch (error) {
    res.status(500).json({ message: "Failed to select offer" });
  }
});


router.patch("/:id/status", isAuthenticated, async (req: any, res) => {
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
