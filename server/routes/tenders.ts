import { sendNominationEmail, sendNominationResponseEmail, sendBidReceivedEmail, sendBidSelectedEmail, sendNewTenderEmail } from "../email";
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

// ─── TENDER ROUTES ──────────────────────────────────────────────────────────

router.get("/tenders", isAuthenticated, async (req: any, res) => {
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
    console.error("Get tenders error:", error);
    res.status(500).json({ message: "Failed to get tenders" });
  }
});

router.post("/tenders", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
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

router.get("/tenders/my-bids", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const bids = await storage.getTenderBidsByAgent(userId);
    res.json(bids);
  } catch (error) {
    console.error("Get my bids error:", error);
    res.status(500).json({ message: "Failed to get bids" });
  }
});

router.get("/tenders/badge-count", isAuthenticated, async (req: any, res) => {
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

router.get("/tenders/:id", isAuthenticated, async (req: any, res) => {
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

router.delete("/tenders/:id", isAuthenticated, async (req: any, res) => {
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

router.post("/tenders/:id/bids", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
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

    const bid = await storage.createTenderBid({
      tenderId,
      agentUserId: userId,
      agentCompanyId: profile?.id || null,
      proformaPdfBase64: proformaPdfBase64 || null,
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

router.post("/tenders/:id/bids/:bidId/select", isAuthenticated, async (req: any, res) => {
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

router.post("/tenders/:id/nominate", isAuthenticated, async (req: any, res) => {
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
      title: "Tebrikler! Nominasyon Onaylandı",
      message: `${portNameForNotif}${tender.vesselName ? ` — ${tender.vesselName}` : ""} için nominasyon resmi olarak onaylandı.`,
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

      // Notify agent about the new conversation
      await storage.createNotification({
        userId: selectedBid.agentUserId,
        type: "message",
        title: "Sohbet Açıldı",
        message: `Nominasyon seferi için armatörle yeni bir sohbet oluşturuldu.`,
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

// Fetch voyage + conversation linked to a tender (for post-nomination UI)
router.get("/tenders/:id/voyage", isAuthenticated, async (req: any, res) => {
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

// ─── VESSEL TRACK ─────────────────────────────────────────────────────────────
function seededRandom(seed: number): number {
  let t = (seed ^ 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// TODO: Replace MOCK_AIS_DATA with real AIS API call when API key is available
// Compatible with: MarineTraffic API v2, VesselFinder, AISHub, or any MMSI/position-based AIS provider
// Integration point: replace the MOCK_AIS_DATA array + the search filter below
// Expected field format per vessel: { mmsi, name, flag, vesselType, lat, lng, heading, speed, destination, eta, status }
const MOCK_AIS_DATA = [
  { mmsi: "271000001", name: "MV MARMARA STAR", flag: "🇹🇷", vesselType: "Bulk Carrier", lat: 40.9823, lng: 28.6542, heading: 45, speed: 10.2, destination: "ISTANBUL", eta: "2026-02-26T18:00:00Z", status: "underway" },
  { mmsi: "271000002", name: "MV AEGEAN PIONEER", flag: "🇹🇷", vesselType: "General Cargo", lat: 38.4337, lng: 26.7673, heading: 270, speed: 8.5, destination: "IZMIR", eta: "2026-02-26T20:00:00Z", status: "underway" },
  { mmsi: "271000003", name: "MV BOSPHORUS TRADER", flag: "🇹🇷", vesselType: "Container Ship", lat: 41.0210, lng: 29.1102, heading: 180, speed: 0, destination: "ISTANBUL", eta: null, status: "anchored" },
  { mmsi: "248000001", name: "MV HELLAS SPIRIT", flag: "🇬🇷", vesselType: "Tanker", lat: 37.8510, lng: 23.9200, heading: 90, speed: 12.1, destination: "MERSIN", eta: "2026-02-27T10:00:00Z", status: "underway" },
  { mmsi: "271000004", name: "MV MERSIN PRIDE", flag: "🇹🇷", vesselType: "Bulk Carrier", lat: 36.7825, lng: 34.6001, heading: 0, speed: 0, destination: "MERSIN", eta: null, status: "moored" },
  { mmsi: "271000005", name: "MV CANAKKALE GUARDIAN", flag: "🇹🇷", vesselType: "RoRo", lat: 40.1490, lng: 26.3990, heading: 315, speed: 14.3, destination: "CANAKKALE", eta: "2026-02-26T16:30:00Z", status: "underway" },
  { mmsi: "229000001", name: "MV MALTA VENTURE", flag: "🇲🇹", vesselType: "General Cargo", lat: 39.4210, lng: 32.8540, heading: 200, speed: 9.8, destination: "ISKENDERUN", eta: "2026-02-27T08:00:00Z", status: "underway" },
  { mmsi: "271000006", name: "MV TRABZON CARRIER", flag: "🇹🇷", vesselType: "Bulk Carrier", lat: 41.0020, lng: 39.7340, heading: 0, speed: 0, destination: "TRABZON", eta: null, status: "moored" },
  { mmsi: "271000007", name: "MV SAMSUN BREEZE", flag: "🇹🇷", vesselType: "Container Ship", lat: 41.2820, lng: 36.3320, heading: 90, speed: 11.5, destination: "SAMSUN", eta: "2026-02-26T22:00:00Z", status: "underway" },
  { mmsi: "255000001", name: "MV MADEIRA STREAM", flag: "🇵🇹", vesselType: "Tanker", lat: 40.5660, lng: 27.5900, heading: 135, speed: 7.2, destination: "TEKIRDAG", eta: "2026-02-27T06:00:00Z", status: "underway" },
  { mmsi: "271000008", name: "MV IZMIR STAR", flag: "🇹🇷", vesselType: "General Cargo", lat: 38.6990, lng: 27.0990, heading: 0, speed: 0, destination: "IZMIR", eta: null, status: "anchored" },
  { mmsi: "636000001", name: "MV LIBERIA HAWK", flag: "🇱🇷", vesselType: "Bulk Carrier", lat: 36.5990, lng: 36.1620, heading: 270, speed: 13.4, destination: "ISKENDERUN", eta: "2026-02-26T23:00:00Z", status: "underway" },
  { mmsi: "538000001", name: "MV MARSHALL TIDE", flag: "🇲🇭", vesselType: "Tanker", lat: 41.5680, lng: 31.4500, heading: 60, speed: 10.0, destination: "ZONGULDAK", eta: "2026-02-27T04:00:00Z", status: "underway" },
  { mmsi: "271000009", name: "MV BANDIRMA EXPRESS", flag: "🇹🇷", vesselType: "Ferry", lat: 40.3490, lng: 27.9670, heading: 0, speed: 0, destination: "BANDIRMA", eta: null, status: "moored" },
  { mmsi: "311000001", name: "MV BAHAMAS CHIEF", flag: "🇧🇸", vesselType: "Container Ship", lat: 36.8820, lng: 30.6870, heading: 315, speed: 15.2, destination: "ANTALYA", eta: "2026-02-26T19:00:00Z", status: "underway" },
];

router.get("/tenders/:id/bids/:bidId/pdf", isAuthenticated, async (req: any, res) => {
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

// ─── DIRECT NOMINATIONS ──────────────────────────────────────────────────────

router.get("/nominations/pending-count", isAuthenticated, async (req: any, res) => {
  try {
    const cnt = await storage.getPendingNominationCountForAgent(req.user.claims.sub);
    res.json({ count: cnt });
  } catch (error) {
    res.status(500).json({ message: "Failed to get pending count" });
  }
});

router.get("/nominations", isAuthenticated, async (req: any, res) => {
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

router.post("/nominations", isAuthenticated, async (req: any, res) => {
  try {
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
    // Notify agent (in-app)
    await storage.createNotification({
      userId: agentUserId,
      type: "nomination",
      title: "Yeni Nominasyon",
      message: `${req.user.name || "Bir armatör"} sizi ${vesselName} gemisi için nomine etti`,
      link: "/nominations",
    });

    // Notify agent (email)
    const agentUser = await storage.getUser(agentUserId);
    if (agentUser?.email) {
      const enriched = await storage.getNominationById(nom.id);
      sendNominationEmail({
        agentEmail: agentUser.email,
        agentCompanyName: enriched?.agentCompanyName || agentUser.name || agentUserId,
        portName: enriched?.portName || `Port #${portId}`,
        vesselName: vesselName,
        eta: eta ? new Date(eta).toLocaleString("tr-TR") : undefined,
        note: notes || undefined,
        shipownerName: req.user.name || undefined,
      }).catch(err => console.error("[email] Nomination email failed (non-blocking):", err));
    }

    res.status(201).json(nom);
  } catch (error) {
    res.status(500).json({ message: "Failed to create nomination" });
  }
});

router.get("/nominations/:id", isAuthenticated, async (req: any, res) => {
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

router.patch("/nominations/:id/respond", isAuthenticated, async (req: any, res) => {
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
    const statusLabel = status === "accepted" ? "kabul etti" : "reddetti";
    await storage.createNotification({
      userId: nom.nominatorUserId,
      type: "nomination_response",
      title: "Nominasyon Yanıtlandı",
      message: `${nom.agentName || nom.agentCompanyName || "Acente"} nominasyonunuzu ${statusLabel}`,
      link: "/nominations",
    });

    // Notify nominator (email)
    const nominatorUser = await storage.getUser(nom.nominatorUserId);
    if (nominatorUser?.email) {
      sendNominationResponseEmail({
        nominatorEmail: nominatorUser.email,
        nominatorName: nominatorUser.name || "Sayın Kullanıcı",
        agentCompanyName: nom.agentCompanyName || nom.agentName || "Acente",
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
