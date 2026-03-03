import { sendContactEmail } from "../email";
import { parsePaginationParams, paginateArray } from "../utils/pagination";
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

router.get("/agent-stats/:companyProfileId", async (req, res) => {
  try {
    const companyProfileId = parseInt(req.params.companyProfileId);
    const profile = await storage.getCompanyProfile(companyProfileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const bids = await storage.getTenderBidsByAgent(profile.userId);
    const selectedBids = bids.filter(b => b.status === "selected").length;
    const winRate = bids.length > 0 ? Math.round((selectedBids / bids.length) * 100) : 0;

    const reviews = await storage.getReviewsByCompany(companyProfileId);
    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      totalBids: bids.length,
      selectedBids,
      winRate,
      avgRating,
      totalReviews: reviews.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch agent stats" });
  }
});

// ─── TRUST SCORE ──────────────────────────────────────────────────────────

router.get("/trust-score/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const allVoyages = await storage.getVoyagesByUser(userId);
    const completedVoyages = allVoyages.filter(v => v.status === "completed").length;
    const finishedVoyages = allVoyages.filter(v => ["completed", "cancelled"].includes(v.status)).length;
    const successRate = finishedVoyages > 0 ? Math.round((completedVoyages / finishedVoyages) * 100) : null;

    const profile = await storage.getCompanyProfileByUser(userId);
    let avgRating = 0;
    let reviewCount = 0;
    let bidWinRate = null;

    if (profile) {
      const reviews = await storage.getReviewsByCompany(profile.id);
      avgRating = reviews.length > 0
        ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10
        : 0;
      reviewCount = reviews.length;

      const bids = await storage.getTenderBidsByAgent(userId);
      if (bids.length > 0) {
        const won = bids.filter(b => b.status === "selected").length;
        bidWinRate = Math.round((won / bids.length) * 100);
      }
    }

    const voyageReviewsResult = await db.execute(
      drizzleSql.raw(`SELECT AVG(rating)::numeric(4,1) AS avg_rating, COUNT(*) AS cnt FROM voyage_reviews WHERE reviewee_user_id = '${userId}'`)
    );
    const vr = voyageReviewsResult.rows[0] as any;
    const voyageAvgRating = vr?.avg_rating ? parseFloat(vr.avg_rating) : 0;
    const voyageReviewCount = parseInt(vr?.cnt ?? "0");

    const combinedAvg = (reviewCount + voyageReviewCount) > 0
      ? Math.round(((avgRating * reviewCount + voyageAvgRating * voyageReviewCount) / (reviewCount + voyageReviewCount)) * 10) / 10
      : 0;

    res.json({
      completedVoyages,
      totalVoyages: allVoyages.length,
      successRate,
      avgRating: combinedAvg,
      reviewCount: reviewCount + voyageReviewCount,
      bidWinRate,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch trust score" });
  }
});

// ─── VERIFICATION ─────────────────────────────────────────────────────────

router.post("/company-profile/request-verification", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const profile = await storage.getCompanyProfileByUser(userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    const { taxNumber, mtoRegistrationNumber, pandiClubName } = req.body;
    if (!taxNumber) return res.status(400).json({ message: "Tax number is required" });
    const updated = await storage.requestVerification(profile.id, userId, { taxNumber, mtoRegistrationNumber, pandiClubName });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to request verification" });
  }
});

router.get("/admin/pending-verifications", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const pending = await storage.getPendingVerifications();
    res.json(pending);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending verifications" });
  }
});

router.post("/admin/verify-company/:profileId", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const profileId = parseInt(req.params.profileId);
    const { action, note } = req.body;
    let updated;
    if (action === "approve") {
      updated = await storage.approveVerification(profileId, note);
    } else if (action === "reject") {
      if (!note) return res.status(400).json({ message: "Rejection note required" });
      updated = await storage.rejectVerification(profileId, note);
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
    if (!updated) return res.status(404).json({ message: "Profile not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update verification" });
  }
});

// ─── ENDORSEMENTS ─────────────────────────────────────────────────────────

router.get("/endorsements/:companyProfileId", async (req, res) => {
  try {
    const id = parseInt(req.params.companyProfileId);
    const list = await storage.getEndorsements(id);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch endorsements" });
  }
});

router.post("/endorsements", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { toCompanyProfileId, relationship, message } = req.body;
    if (!toCompanyProfileId || !relationship) return res.status(400).json({ message: "Profile and relationship required" });
    const existing = await storage.getUserEndorsementForProfile(userId, parseInt(toCompanyProfileId));
    if (existing) return res.status(409).json({ message: "You have already endorsed this company" });
    const endo = await storage.createEndorsement({ fromUserId: userId, toCompanyProfileId: parseInt(toCompanyProfileId), relationship, message });
    res.status(201).json(endo);
  } catch (error) {
    res.status(500).json({ message: "Failed to create endorsement" });
  }
});

router.delete("/endorsements/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const deleted = await storage.deleteEndorsement(parseInt(req.params.id), userId);
    if (!deleted) return res.status(404).json({ message: "Not found or not yours" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete endorsement" });
  }
});

router.get("/service-ports", async (req, res) => {
  try {
    const profiles = await storage.getPublicCompanyProfiles();
    const allPorts = await storage.getPorts();
    const portMap = new Map(allPorts.map(p => [p.id, p]));

    const portCompanyMap: Record<number, { port: any; companies: any[] }> = {};
    for (const profile of profiles) {
      const served = (profile.servedPorts as number[]) || [];
      for (const portId of served) {
        if (!portCompanyMap[portId]) {
          const port = portMap.get(portId);
          if (!port) continue;
          portCompanyMap[portId] = { port, companies: [] };
        }
        portCompanyMap[portId].companies.push({
          id: profile.id,
          companyName: profile.companyName,
          companyType: profile.companyType,
          serviceTypes: profile.serviceTypes,
          city: profile.city,
          country: profile.country,
          isFeatured: profile.isFeatured,
          phone: profile.phone,
          email: profile.email,
          website: profile.website,
          logoUrl: profile.logoUrl,
        });
      }
    }

    const result = Object.values(portCompanyMap)
      .filter(entry => entry.companies.length > 0)
      .sort((a, b) => b.companies.length - a.companies.length);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch service ports" });
  }
});

router.get("/directory", async (req, res) => {
  try {
    const companyType = req.query.type as string | undefined;
    const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
    const search = (req.query.search as string || "").toLowerCase();
    const { page, limit } = parsePaginationParams(req.query);
    let profiles = await storage.getPublicCompanyProfiles({ companyType, portId });

    if (search) {
      profiles = profiles.filter((p: any) =>
        p.companyName?.toLowerCase().includes(search) ||
        p.city?.toLowerCase().includes(search) ||
        p.country?.toLowerCase().includes(search)
      );
    }

    // Attach avgRating and reviewCount for agent profiles
    const agentProfiles = profiles.filter((p: any) => p.companyType === "agent");
    let enriched: any[] = profiles.map((p: any) => ({ ...p, avgRating: null, reviewCount: 0 }));
    if (agentProfiles.length > 0) {
      const reviewsMap = new Map<number, { sum: number; count: number }>();
      await Promise.all(agentProfiles.map(async (p: any) => {
        const reviews = await storage.getReviewsByCompany(p.id);
        if (reviews.length > 0) {
          const sum = reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
          reviewsMap.set(p.id, { sum, count: reviews.length });
        }
      }));
      enriched = profiles.map((p: any) => {
        const rating = reviewsMap.get(p.id);
        return rating
          ? { ...p, avgRating: Math.round((rating.sum / rating.count) * 10) / 10, reviewCount: rating.count }
          : { ...p, avgRating: null, reviewCount: 0 };
      });
    }

    res.json(paginateArray(enriched, page, limit));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch directory" });
  }
});

router.get("/directory/featured", async (req, res) => {
  try {
    const profiles = await storage.getFeaturedCompanyProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch featured profiles" });
  }
});

router.get("/directory/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const profile = await storage.getCompanyProfile(id);
    if (!profile || !profile.isActive) return res.status(404).json({ message: "Profile not found" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

router.get("/reviews/:companyProfileId", async (req, res) => {
  try {
    const companyProfileId = parseInt(req.params.companyProfileId);
    const reviews = await storage.getReviewsByCompany(companyProfileId);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

router.post("/reviews", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;
    if (effectiveRole !== "shipowner") {
      return res.status(403).json({ message: "Only shipowners and brokers can leave reviews" });
    }

    const { companyProfileId, tenderId, rating, comment } = req.body;
    if (!companyProfileId) return res.status(400).json({ message: "companyProfileId is required" });
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be between 1 and 5" });

    const profile = await storage.getCompanyProfile(companyProfileId);
    if (!profile) return res.status(404).json({ message: "Company profile not found" });

    let vesselName: string | undefined;
    let portName: string | undefined;

    if (tenderId) {
      const existing = await storage.getMyReviewForTender(userId, tenderId);
      if (existing) return res.status(400).json({ message: "You have already reviewed this job" });

      const tender = await storage.getPortTenderById(tenderId);
      if (tender) {
        if (tender.nominatedAgentId !== profile.userId) {
          return res.status(403).json({ message: "This agent was not nominated for that tender" });
        }
        if (tender.userId !== userId) {
          return res.status(403).json({ message: "This is not your tender" });
        }
        vesselName = tender.vesselName;
        portName = tender.portName;
      }
    }

    const review = await storage.createReview({
      companyProfileId,
      reviewerUserId: userId,
      tenderId: tenderId || null,
      rating,
      comment: comment || null,
      vesselName: vesselName || null,
      portName: portName || null,
    });

    res.json(review);
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ message: "Failed to create review" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const [users, proformas, companies] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllProformas(),
      storage.getAllCompanyProfiles(),
    ]);
    res.json({
      userCount: users.length,
      proformaCount: proformas.length,
      companyCount: companies.length,
    });
  } catch {
    res.json({ userCount: 0, proformaCount: 0, companyCount: 0 });
  }
});

router.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ ok: false, error: "All fields are required" });
  }
  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "Invalid email address" });
  }
  sendContactEmail({ name: String(name), email: String(email), subject: String(subject), message: String(message) });
  return res.json({ ok: true });
});

router.get("/activity-feed", async (_req, res) => {
  try {
    const activities: { type: string; message: string; timestamp: string; icon: string }[] = [];

    const allVessels = await storage.getAllVessels();
    const vesselMap = new Map(allVessels.map(v => [v.id, v]));
    const allPorts = await storage.getPorts();
    const portMap = new Map(allPorts.map(p => [p.id, p]));

    const allProformas = await storage.getAllProformas();
    for (const p of allProformas.slice(0, 8)) {
      const vessel = p.vesselId ? vesselMap.get(p.vesselId) : null;
      const port = p.portId ? portMap.get(p.portId) : null;
      const vesselName = vessel?.name || "a vessel";
      const portName = port?.name || "port";
      activities.push({
        type: "proforma",
        message: `Proforma generated for ${vesselName} at ${portName}`,
        timestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        icon: "filetext",
      });
    }

    const sortedVessels = allVessels
      .filter(v => v.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    for (const v of sortedVessels.slice(0, 6)) {
      activities.push({
        type: "vessel",
        message: `${v.name} (${v.flag}) registered to the fleet`,
        timestamp: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
        icon: "ship",
      });
    }

    const allProfiles = await storage.getAllCompanyProfiles();
    const sortedProfiles = allProfiles
      .filter(p => p.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    for (const p of sortedProfiles.slice(0, 6)) {
      const typeLabel = p.companyType === "agent" ? "Ship Agent" : "Service Provider";
      activities.push({
        type: "company",
        message: `${p.companyName} joined as ${typeLabel}`,
        timestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        icon: "building",
      });
    }

    const allUsers = await storage.getAllUsers();
    const sortedUsers = allUsers
      .filter(u => u.createdAt && u.userRole !== "admin")
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    for (const u of sortedUsers.slice(0, 4)) {
      const roleLabel = u.userRole === "agent" ? "Ship Agent" : u.userRole === "provider" ? "Service Provider" : "Shipowner";
      const name = u.firstName || "A maritime professional";
      activities.push({
        type: "user",
        message: `${name} joined VesselPDA as ${roleLabel}`,
        timestamp: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        icon: "user",
      });
    }

    const recentTopics = await storage.getForumTopics({ sort: "latest", limit: 6 });
    for (const t of recentTopics) {
      activities.push({
        type: "forum",
        message: `"${t.title}" posted in the forum`,
        timestamp: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
        icon: "message-square",
      });
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(activities.slice(0, 20));
  } catch (error) {
    console.error("Activity feed error:", error);
    res.status(500).json({ message: "Failed to fetch activity feed" });
  }
});


export default router;
