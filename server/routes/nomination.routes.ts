import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { insertDirectNominationSchema } from "@shared/schema";
import { sendNominationEmail, sendNominationResponseEmail } from "../email";
import { emitToUser } from "../socket";
import { logAction } from "../audit";
import { eventBus } from "../events";

const router = Router();

router.get("/pending-count", isAuthenticated, async (req: any, res) => {
  try {
    const cnt = await storage.getPendingNominationCountForAgent(req.user.claims.sub);
    res.json({ count: cnt });
  } catch (error) {
    res.status(500).json({ message: "Failed to get pending count" });
  }
});


router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const role = req.user.userRole || req.user.activeRole;
    const sent = await storage.getNominationsByNominator(userId);
    const received = await storage.getNominationsByAgent(userId);
    res.json({ sent, received });
  } catch (error) {
    res.status(500).json({ message: "Failed to get nominations" });
  }
});


router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const nomParsed = insertDirectNominationSchema.partial().safeParse(req.body);
    if (!nomParsed.success) return res.status(400).json({ error: "Invalid input", details: nomParsed.error.errors });
    const { agentUserId, agentCompanyId, portId, vesselName, vesselId, purposeOfCall, eta, etd, notes } = req.body;
    if (!agentUserId || !portId || !vesselName || !purposeOfCall) {
      return res.status(400).json({ message: "agentUserId, portId, vesselName, purposeOfCall zorunludur" });
    }
    if (agentUserId === req.user.claims.sub) {
      return res.status(400).json({ message: "Kendinizi nomine edemezsiniz" });
    }
    const nom = await storage.createNomination({
      nominatorUserId: req.user.claims.sub,
      agentUserId,
      agentCompanyId: agentCompanyId ?? null,
      portId: parseInt(portId),
      vesselName,
      vesselId: vesselId ?? null,
      purposeOfCall,
      eta: eta ? new Date(eta) : null,
      etd: etd ? new Date(etd) : null,
      notes: notes ?? null,
    });
    // Notify agent via event bus (handled by notification.listener)
    eventBus.emitEvent("nomination.created", { nominationId: nom.id, agentUserId });

    // Notify agent (email)
    const agentUser = await storage.getUser(agentUserId);
    if (agentUser?.email) {
      const enriched = await storage.getNominationById(nom.id);
      sendNominationEmail({
        agentEmail: agentUser.email,
        agentCompanyName: enriched?.agentCompanyName || [agentUser.firstName, agentUser.lastName].filter(Boolean).join(" ") || agentUserId,
        portName: enriched?.portName || `Port #${portId}`,
        vesselName: vesselName,
        note: notes || undefined,
        shipownerName: [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ") || undefined,
      }).catch(err => console.error("[email] Nomination email failed (non-blocking):", err));
    }

    res.status(201).json(nom);
  } catch (error) {
    res.status(500).json({ message: "Failed to create nomination" });
  }
});


router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const nom = await storage.getNominationById(id);
    if (!nom) return res.status(404).json({ message: "Nomination not found" });
    if (nom.nominatorUserId !== req.user.claims.sub && nom.agentUserId !== req.user.claims.sub) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(nom);
  } catch (error) {
    res.status(500).json({ message: "Failed to get nomination" });
  }
});


router.patch("/:id/respond", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ message: "status must be accepted or declined" });
    }
    const nom = await storage.getNominationById(id);
    if (!nom) return res.status(404).json({ message: "Nomination not found" });
    if (nom.agentUserId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
    if (nom.status !== "pending") return res.status(409).json({ message: "Already responded" });
    const updated = await storage.updateNominationStatus(id, status);
    // Notify nominator (in-app)
    const statusLabel = status === "accepted" ? "accepted" : "declined";
    await storage.createNotification({
      userId: nom.nominatorUserId,
      type: "nomination_response",
      title: "Nomination Response",
      message: `${nom.agentName || nom.agentCompanyName || "The agent"} ${statusLabel} your nomination`,
      link: "/nominations",
    });

    // Notify nominator (email)
    const nominatorUser = await storage.getUser(nom.nominatorUserId);
    if (nominatorUser?.email) {
      sendNominationResponseEmail({
        nominatorEmail: nominatorUser.email,
        nominatorName: [nominatorUser.firstName, nominatorUser.lastName].filter(Boolean).join(" ") || "Dear User",
        agentCompanyName: nom.agentCompanyName || nom.agentName || "Agent",
        status: status as "accepted" | "declined",
        portName: nom.portName || `Port #${nom.portId}`,
        vesselName: nom.vesselName,
        eta: nom.eta ? new Date(nom.eta).toLocaleString("tr-TR") : undefined,
        notes: nom.notes || undefined,
      }).catch(err => console.error("[email] Nomination response email failed (non-blocking):", err));
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to respond to nomination" });
  }
});


export default router;
