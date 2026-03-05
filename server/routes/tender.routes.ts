import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { saveBase64File } from "../file-storage";
import { insertPortTenderSchema, insertTenderBidSchema } from "@shared/schema";
import { sendBidReceivedEmail, sendBidSelectedEmail, sendNewTenderEmail, sendNominationEmail } from "../email";
import { emitToUser, emitToConversation, emitToVoyage } from "../socket";
import { logAction, getClientIp } from "../audit";
import { logVoyageActivity } from "../voyage-activity";
import { db, pool } from "../db";
import { sql as drizzleSql, eq, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const isAdminUser = user.userRole === "admin";
    const effectiveRole = isAdminUser ? (user.activeRole || "shipowner") : user.userRole;

    if (effectiveRole === "agent") {
      if (isAdminUser) {
        // Admin in agent view: show ALL open tenders (own tenders shown but can't bid on them)
        const allOpen = await storage.getPortTenders({ status: "open" });
        return res.json({ role: "agent", tenders: allOpen, ownUserId: userId });
      }
      const profile = await storage.getCompanyProfileByUser(userId);
      const servedPorts = (profile?.servedPorts as number[]) || [];
      const tenders = await Promise.all(
        servedPorts.map(portId => storage.getPortTenders({ portId, status: "open" }))
      );
      const flat = tenders.flat();
      const unique = flat.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
      return res.json({ role: "agent", tenders: unique });
    }

    const myTenders = await storage.getPortTenders({ userId });
    return res.json({ role: "shipowner", tenders: myTenders });
  } catch (error) {
    console.error("[tenders:GET] fetch failed:", error);
    next(error);
  }
});


router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const tenderParsed = insertPortTenderSchema.partial().safeParse(req.body);
    if (!tenderParsed.success) return res.status(400).json({ error: "Invalid input", details: tenderParsed.error.errors });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;
    if (effectiveRole !== "shipowner") {
      return res.status(403).json({ message: "Only shipowners and brokers can create tenders" });
    }

    const { portId, vesselName, description, cargoInfo, expiryHours, grt, nrt, flag, cargoType, cargoQuantity, previousPort, q88Base64 } = req.body;
    if (!portId) return res.status(400).json({ message: "Port is required" });
    if (!vesselName) return res.status(400).json({ message: "Vessel name is required" });
    if (!flag) return res.status(400).json({ message: "Flag is required" });
    if (!grt) return res.status(400).json({ message: "GRT is required" });
    if (!nrt) return res.status(400).json({ message: "NRT is required" });
    if (!cargoType) return res.status(400).json({ message: "Cargo type is required" });
    if (!cargoQuantity) return res.status(400).json({ message: "Cargo quantity is required" });
    if (!previousPort) return res.status(400).json({ message: "Previous port is required" });
    if (![24, 48].includes(Number(expiryHours))) {
      return res.status(400).json({ message: "Expiry must be 24 or 48 hours" });
    }

    const tender = await storage.createPortTender({
      userId,
      portId: Number(portId),
      vesselName: vesselName || null,
      description: description || null,
      cargoInfo: cargoInfo || null,
      grt: grt ? Number(grt) : null,
      nrt: nrt ? Number(nrt) : null,
      flag: flag || null,
      cargoType: cargoType || null,
      cargoQuantity: cargoQuantity || null,
      previousPort: previousPort || null,
      q88Base64: q88Base64 || null,
      expiryHours: Number(expiryHours),
    });

    logAction(userId, "create", "tender", tender.id, { portId: Number(portId), vesselName, cargoType, expiryHours: Number(expiryHours) }, getClientIp(req));
    const agents = await storage.getAgentsByPort(Number(portId));
    res.json({ tender, agentCount: agents.length });

    // Notify agents serving this port — async, non-blocking
    try {
      const port = await storage.getPort(Number(portId));
      const agentUsers = await Promise.all(agents.slice(0, 50).map((a: any) => storage.getUser(a.userId)));
      for (const agentUser of agentUsers) {
        if (agentUser?.email) {
          sendNewTenderEmail({
            agentEmail: agentUser.email,
            agentName: agentUser.firstName || undefined,
            portName: (port as any)?.name || `Port #${portId}`,
            vesselName: vesselName || undefined,
            cargoType: cargoType || undefined,
            cargoQuantity: cargoQuantity || undefined,
            expiryHours: Number(expiryHours),
            tenderId: tender.id,
          }).catch(e => console.warn("[email] sendNewTenderEmail failed:", e));
        }
      }
    } catch (emailErr) { console.warn("[email] sendNewTenderEmail batch failed (non-critical):", emailErr); }
  } catch (error) {
    console.error("Create tender error:", error);
    res.status(500).json({ message: "Failed to create tender" });
  }
});


router.get("/my-bids", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const bids = await storage.getTenderBidsByAgent(userId);
    res.json(bids);
  } catch (error) {
    console.error("Get my bids error:", error);
    res.status(500).json({ message: "Failed to get bids" });
  }
});


router.get("/badge-count", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.json({ count: 0 });

    const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;

    if (effectiveRole === "agent") {
      const profile = await storage.getCompanyProfileByUser(userId);
      const portIds = (profile?.servedPorts as number[]) || [];
      const count = await storage.getTenderCountForAgent(userId, portIds);
      return res.json({ count });
    }

    const myTenders = await storage.getPortTenders({ userId, status: "open" });
    const withBids = myTenders.filter(t => (t.bidCount || 0) > 0);
    return res.json({ count: withBids.length });
  } catch (error) {
    res.json({ count: 0 });
  }
});


router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const tenderId = parseInt(req.params.id);
    const tender = await storage.getPortTenderById(tenderId);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    const isAdminUser = user.userRole === "admin";
    const effectiveRole = isAdminUser ? (user.activeRole || "shipowner") : user.userRole;

    // Agent view (real agents + admin testing in agent mode)
    if (effectiveRole === "agent") {
      if (!isAdminUser) {
        // Real agents: must serve this port
        const profile = await storage.getCompanyProfileByUser(userId);
        const servedPorts = (profile?.servedPorts as number[]) || [];
        if (!servedPorts.includes(tender.portId)) {
          return res.status(403).json({ message: "This tender is not in your served ports" });
        }
      }
      // Admin in agent mode or real agent: show agent view if not the owner
      if (tender.userId !== userId) {
        const bids = await storage.getTenderBids(tenderId);
        const myBid = bids.find(b => b.agentUserId === userId) || null;
        return res.json({ tender, bids: myBid ? [myBid] : [], myBid, isOwner: false });
      }
    }

    if (!isAdminUser) {
      if (effectiveRole === "provider") {
        return res.status(403).json({ message: "Access denied" });
      }
      if (effectiveRole === "shipowner" && tender.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const bids = await storage.getTenderBids(tenderId);
    const bidsNoPdf = bids.map(({ proformaPdfBase64, ...b }) => ({
      ...b,
      hasPdf: !!proformaPdfBase64,
    }));
    res.json({ tender, bids: bidsNoPdf, myBid: null, isOwner: tender.userId === userId });
  } catch (error) {
    console.error("Get tender error:", error);
    res.status(500).json({ message: "Failed to get tender" });
  }
});


router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const tenderId = parseInt(req.params.id);
    const tender = await storage.getPortTenderById(tenderId);
    if (!tender) return res.status(404).json({ message: "Not found" });
    if (tender.userId !== userId && !(await isAdmin(req))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (tender.status !== "open") {
      return res.status(400).json({ message: "Can only cancel open tenders" });
    }
    await storage.updatePortTenderStatus(tenderId, "cancelled");
    logAction(userId, "delete", "tender", tenderId, { status: "cancelled" }, getClientIp(req));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel tender" });
  }
});


router.post("/:id/bids", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const bidParsed = insertTenderBidSchema.partial().safeParse(req.body);
    if (!bidParsed.success) return res.status(400).json({ error: "Invalid input", details: bidParsed.error.errors });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const tenderId = parseInt(req.params.id);
    const tender = await storage.getPortTenderById(tenderId);
    if (!tender) return res.status(404).json({ message: "Tender not found" });
    if (tender.status !== "open") return res.status(400).json({ message: "Tender is no longer open" });

    const expiresAt = new Date(tender.createdAt).getTime() + tender.expiryHours * 3600000;
    if (Date.now() > expiresAt) return res.status(400).json({ message: "Tender has expired" });

    const existingBids = await storage.getTenderBids(tenderId);
    if (existingBids.some(b => b.agentUserId === userId)) {
      return res.status(400).json({ message: "You have already submitted a bid for this tender" });
    }

    const profile = await storage.getCompanyProfileByUser(userId);
    const { notes, totalAmount, currency, proformaPdfBase64 } = req.body;

    if (proformaPdfBase64 && proformaPdfBase64.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "PDF file is too large (max 5MB)" });
    }

    // Save base64 PDF to filesystem; store URL in DB instead of raw base64
    let pdfUrl: string | null = null;
    let pdfBase64ToStore: string | null = null;
    if (proformaPdfBase64) {
      try {
        pdfUrl = saveBase64File(proformaPdfBase64, "bids");
      } catch {
        pdfBase64ToStore = proformaPdfBase64; // fallback: store in DB if FS write fails
      }
    }

    const bid = await storage.createTenderBid({
      tenderId,
      agentUserId: userId,
      agentCompanyId: profile?.id || null,
      proformaPdfBase64: pdfBase64ToStore,
      proformaPdfUrl: pdfUrl,
      notes: notes || null,
      totalAmount: totalAmount || null,
      currency: currency || "USD",
    });

    logAction(userId, "create", "tender_bid", bid.id, { tenderId, totalAmount, currency }, getClientIp(req));
    res.json(bid);

    // Notify tender owner — async, non-blocking
    try {
      const owner = await storage.getUser(tender.userId);
      const port = await storage.getPort(tender.portId);
      const portName = (port as any)?.name || `Port #${tender.portId}`;
      const agentName = profile?.companyName || user.firstName || "An agent";
      if (owner?.email) {
        await sendBidReceivedEmail({
          ownerEmail: owner.email,
          ownerName: owner.firstName || owner.email,
          agentName,
          portName,
          vesselName: tender.vesselName || undefined,
          totalAmount: totalAmount || undefined,
          currency: currency || "USD",
          tenderId,
        });
      }
      await storage.createNotification({
        userId: tender.userId,
        type: "bid_received",
        title: "New Bid Received",
        message: `${agentName} submitted a bid for ${portName}${tender.vesselName ? ` — ${tender.vesselName}` : ""}`,
        link: `/tenders/${tenderId}`,
      });
    } catch (emailErr) { console.warn("[email] sendBidReceivedEmail failed (non-critical):", emailErr); }
  } catch (error) {
    console.error("Create bid error:", error);
    res.status(500).json({ message: "Failed to submit bid" });
  }
});


router.post("/:id/bids/:bidId/select", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const tenderId = parseInt(req.params.id);
    const bidId = parseInt(req.params.bidId);

    const tender = await storage.getPortTenderById(tenderId);
    if (!tender) return res.status(404).json({ message: "Not found" });
    if (tender.userId !== userId && !(await isAdmin(req))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const bids = await storage.getTenderBids(tenderId);
    for (const bid of bids) {
      await storage.updateTenderBidStatus(bid.id, bid.id === bidId ? "selected" : "rejected");
    }
    await storage.updatePortTenderStatus(tenderId, "closed");

    const selectedBid = bids.find(b => b.id === bidId);
    logAction(userId, "select", "tender_bid", bidId, { tenderId, selectedBidId: bidId }, getClientIp(req));
    res.json({ success: true, selectedBid });

    // Notify the winning agent — async, non-blocking
    try {
      if (selectedBid) {
        const agent = await storage.getUser(selectedBid.agentUserId);
        const port = await storage.getPort(tender.portId);
        const portName = (port as any)?.name || `Port #${tender.portId}`;
        if (agent?.email) {
          await sendBidSelectedEmail({
            agentEmail: agent.email,
            agentName: agent.firstName || undefined,
            portName,
            vesselName: tender.vesselName || undefined,
            tenderId,
          });
        }
        await storage.createNotification({
          userId: selectedBid.agentUserId,
          type: "bid_selected",
          title: "Your Bid Was Selected!",
          message: `Your bid for ${portName}${tender.vesselName ? ` — ${tender.vesselName}` : ""} has been selected.`,
          link: `/tenders/${tenderId}`,
        });
      }
    } catch (emailErr) { console.warn("[email] sendBidSelectedEmail failed (non-critical):", emailErr); }
  } catch (error) {
    console.error("Select bid error:", error);
    res.status(500).json({ message: "Failed to select bid" });
  }
});


router.post("/:id/nominate", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const tenderId = parseInt(req.params.id);
    const { note, extraEmails } = req.body;

    const tender = await storage.getPortTenderById(tenderId);
    if (!tender) return res.status(404).json({ message: "Not found" });
    if (tender.userId !== userId && !(await isAdmin(req))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const bids = await storage.getTenderBids(tenderId);
    const selectedBid = bids.find(b => b.status === "selected");
    if (!selectedBid) return res.status(400).json({ message: "No bid selected yet" });

    await storage.updatePortTenderStatus(tenderId, "nominated", selectedBid.agentUserId);

    // In-app notification for the nominated agent
    const port = await storage.getPort(tender.portId);
    const portNameForNotif = (port as any)?.name || tender.portName || `Port #${tender.portId}`;
    await storage.createNotification({
      userId: selectedBid.agentUserId,
      type: "nomination",
      title: "Nomination Confirmed",
      message: `Your nomination for ${portNameForNotif}${tender.vesselName ? ` — ${tender.vesselName}` : ""} has been officially confirmed.`,
      link: `/tenders/${tenderId}`,
    });

    // Auto-create voyage for both shipowner and agent
    let autoVoyageId: number | null = null;
    let autoConversationId: number | null = null;
    try {
      const existingVoyage = await storage.getVoyageByTenderId(tenderId);
      let voyage = existingVoyage;
      if (!voyage) {
        voyage = await storage.createVoyage({
          userId: tender.userId,
          agentUserId: selectedBid.agentUserId,
          tenderId,
          portId: tender.portId,
          vesselName: tender.vesselName ?? null,
          flag: tender.flag ?? null,
          grt: tender.grt ?? null,
          status: "planned",
          purposeOfCall: tender.cargoType || "Loading",
        } as any);
      }
      autoVoyageId = voyage.id;

      // Create or get conversation linked to voyage
      const conversation = await storage.getOrCreateConversation(
        tender.userId,
        selectedBid.agentUserId,
        voyage.id
      );
      autoConversationId = conversation.id;

      if (autoVoyageId) {
        logVoyageActivity({ 
          voyageId: autoVoyageId, 
          userId, 
          activityType: 'nomination_sent', 
          title: 'Agent nominated for port call' 
        });
      }

      // Notify agent about the new conversation
      await storage.createNotification({
        userId: selectedBid.agentUserId,
        type: "message",
        title: "Conversation Started",
        message: "A new conversation has been created with the shipowner for the nominated voyage.",
        link: `/messages/${conversation.id}`,
      });
    } catch (voyageErr) {
      console.error("[nominate] Voyage/conversation auto-create failed (non-blocking):", voyageErr);
    }

    const extraEmailsList: string[] = Array.isArray(extraEmails)
      ? extraEmails
      : typeof extraEmails === "string"
        ? extraEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
        : [];

    if (selectedBid.agentEmail) {
      sendNominationEmail({
        agentEmail: selectedBid.agentEmail,
        agentCompanyName: selectedBid.companyName || `${selectedBid.agentFirstName} ${selectedBid.agentLastName}`,
        extraEmails: extraEmailsList,
        portName: tender.portName,
        vesselName: tender.vesselName ?? undefined,
        flag: tender.flag ?? undefined,
        grt: tender.grt ?? undefined,
        nrt: tender.nrt ?? undefined,
        cargoType: tender.cargoType ?? undefined,
        cargoQuantity: tender.cargoQuantity ?? undefined,
        previousPort: tender.previousPort ?? undefined,
        note: note || undefined,
      }).catch(err => console.error("[email] Nomination email failed (non-blocking):", err));
    }

    res.json({
      success: true,
      nominatedAgent: {
        companyName: selectedBid.companyName,
        email: selectedBid.agentEmail,
        agentFirstName: selectedBid.agentFirstName,
        agentLastName: selectedBid.agentLastName,
      },
      note: note || null,
      extraEmails: extraEmailsList,
      emailSent: !!selectedBid.agentEmail,
      voyageId: autoVoyageId,
      conversationId: autoConversationId,
    });
  } catch (error) {
    console.error("Nominate error:", error);
    res.status(500).json({ message: "Failed to process nomination" });
  }
});


router.get("/:id/voyage", isAuthenticated, async (req: any, res) => {
  try {
    const tenderId = parseInt(req.params.id);
    const userId = req.user.claims.sub;
    const voyage = await storage.getVoyageByTenderId(tenderId);
    if (!voyage) return res.json(null);
    // Only participants can see this
    if (voyage.userId !== userId && voyage.agentUserId !== userId && !(await isAdmin(req))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // Find conversation between the two parties
    const conversation = await storage.getOrCreateConversation(voyage.userId, voyage.agentUserId!, voyage.id);
    res.json({ voyageId: voyage.id, conversationId: conversation.id });
  } catch (err) {
    console.error("GET /api/tenders/:id/voyage error:", err);
    res.status(500).json({ message: "Failed to fetch voyage info" });
  }
});


router.get("/:id/bids/:bidId/pdf", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const tenderId = parseInt(req.params.id);
    const bidId = parseInt(req.params.bidId);

    const tender = await storage.getPortTenderById(tenderId);
    if (!tender) return res.status(404).json({ message: "Not found" });

    const bids = await storage.getTenderBids(tenderId);
    const bid = bids.find(b => b.id === bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    const isOwner = tender.userId === userId;
    const isThisAgent = bid.agentUserId === userId;
    if (!isOwner && !isThisAgent && !(await isAdmin(req))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const allBids = await storage.getTenderBids(tenderId);
    const fullBid = allBids.find(b => b.id === bidId);
    res.json({ proformaPdfBase64: fullBid?.proformaPdfBase64 || null });
  } catch (error) {
    res.status(500).json({ message: "Failed to get PDF" });
  }
});


export default router;
