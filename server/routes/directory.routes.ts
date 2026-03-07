import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { db, pool } from "../db";
import { sql as drizzleSql, eq, desc } from "drizzle-orm";
import { insertAgentReviewSchema } from "@shared/schema";
import { checkSanctions, getSanctionsStatus } from "../sanctions";
import { logAction } from "../audit";
import { cached, invalidateCacheByPrefix } from "../cache";

const router = Router();

router.get("/api/agent-stats/:companyProfileId", async (req, res) => {
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


router.get("/api/trust-score/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const trustUser = await storage.getUser(userId);
    const trustRole = trustUser?.userRole || "shipowner";
    const allVoyages = await storage.getVoyagesByUser(userId, trustRole);
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

    const voyageReviewsResult = await pool.query(
      `SELECT AVG(rating)::numeric(4,1) AS avg_rating, COUNT(*) AS cnt FROM voyage_reviews WHERE reviewee_user_id = $1`,
      [userId]
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


router.get("/api/endorsements/:companyProfileId", async (req, res) => {
  try {
    const id = parseInt(req.params.companyProfileId);
    const list = await storage.getEndorsements(id);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch endorsements" });
  }
});


router.post("/api/endorsements", isAuthenticated, async (req: any, res) => {
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


router.delete("/api/endorsements/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const deleted = await storage.deleteEndorsement(parseInt(req.params.id), userId);
    if (!deleted) return res.status(404).json({ message: "Not found or not yours" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete endorsement" });
  }
});


router.get("/api/fleets", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const result = await pool.query(
      `SELECT f.*,
              COUNT(fv.vessel_id)::int AS vessel_count,
              COALESCE(ARRAY_AGG(fv.vessel_id) FILTER (WHERE fv.vessel_id IS NOT NULL), '{}') AS vessel_ids,
              COALESCE(ARRAY_AGG(v.mmsi) FILTER (WHERE v.mmsi IS NOT NULL AND v.mmsi <> ''), '{}') AS vessel_mmsis
       FROM fleets f
       LEFT JOIN fleet_vessels fv ON fv.fleet_id = f.id
       LEFT JOIN vessels v ON v.id = fv.vessel_id
       WHERE f.user_id = $1 AND f.is_active = true
       GROUP BY f.id
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch fleets" });
  }
});


router.post("/api/fleets", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { name, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Fleet name is required" });
    const result = await pool.query(
      `INSERT INTO fleets (user_id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, name.trim(), description?.trim() || null, color || "#2563EB"]
    );
    res.json({ ...result.rows[0], vessel_count: 0, vessel_ids: [], vessel_mmsis: [] });
  } catch (error) {
    res.status(500).json({ message: "Failed to create fleet" });
  }
});


router.put("/api/fleets/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { name, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Fleet name is required" });
    const result = await pool.query(
      `UPDATE fleets SET name = $1, description = $2, color = $3 WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name.trim(), description?.trim() || null, color || "#2563EB", req.params.id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Failed to update fleet" });
  }
});


router.delete("/api/fleets/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const result = await pool.query(
      `DELETE FROM fleets WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: "Fleet not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete fleet" });
  }
});


router.post("/api/fleets/:id/vessels", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { vesselId } = req.body;
    if (!vesselId) return res.status(400).json({ message: "vesselId is required" });
    const fleet = await pool.query("SELECT id FROM fleets WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
    if (fleet.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
    await pool.query(
      `INSERT INTO fleet_vessels (fleet_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, vesselId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to add vessel to fleet" });
  }
});


router.delete("/api/fleets/:id/vessels/:vesselId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const fleet = await pool.query("SELECT id FROM fleets WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
    if (fleet.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
    await pool.query(
      `DELETE FROM fleet_vessels WHERE fleet_id = $1 AND vessel_id = $2`,
      [req.params.id, req.params.vesselId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove vessel from fleet" });
  }
});


router.get("/api/sanctions/check", isAuthenticated, async (req: any, res) => {
  try {
    const name = req.query.name as string;
    const imo = req.query.imo as string | undefined;
    if (!name) return res.status(400).json({ message: "name is required" });
    const result = checkSanctions(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to check sanctions" });
  }
});


router.get("/api/sanctions/status", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    res.json(getSanctionsStatus());
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sanctions status" });
  }
});


router.get("/api/directory", async (req, res) => {
  try {
    const companyType = req.query.type as string | undefined;
    const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
    const profiles = await storage.getPublicCompanyProfiles({ companyType, portId });
    // Attach avgRating and reviewCount for agent profiles
    const agentProfiles = profiles.filter(p => p.companyType === "agent");
    if (agentProfiles.length > 0) {
      const reviewsMap = new Map<number, { sum: number; count: number }>();
      await Promise.all(agentProfiles.map(async (p) => {
        const reviews = await storage.getReviewsByCompany(p.id);
        if (reviews.length > 0) {
          const sum = reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
          reviewsMap.set(p.id, { sum, count: reviews.length });
        }
      }));
      const enriched = profiles.map(p => {
        const rating = reviewsMap.get(p.id);
        return rating
          ? { ...p, avgRating: Math.round((rating.sum / rating.count) * 10) / 10, reviewCount: rating.count }
          : { ...p, avgRating: null, reviewCount: 0 };
      });
      res.json(enriched);
    } else {
      res.json(profiles.map(p => ({ ...p, avgRating: null, reviewCount: 0 })));
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch directory" });
  }
});


router.get("/api/directory/featured", async (req, res) => {
  try {
    const profiles = await cached('directory:featured', 'medium', () => storage.getFeaturedCompanyProfiles());
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch featured profiles" });
  }
});


router.get("/api/directory/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const profile = await storage.getCompanyProfile(id);
    if (!profile || !profile.isActive) return res.status(404).json({ message: "Profile not found" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});


router.get("/api/reviews/:companyProfileId", async (req, res) => {
  try {
    const companyProfileId = parseInt(req.params.companyProfileId);
    const reviews = await storage.getReviewsByCompany(companyProfileId);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});


router.post("/api/reviews", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const reviewParsed = insertAgentReviewSchema.partial().safeParse(req.body);
    if (!reviewParsed.success) return res.status(400).json({ error: "Invalid input", details: reviewParsed.error.errors });
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


router.get("/api/stats", async (_req, res) => {
  try {
    const stats = await cached('public-stats', 'medium', async () => {
      const [users, proformas, companies] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProformas(),
        storage.getAllCompanyProfiles(),
      ]);
      return {
        userCount: users.length,
        proformaCount: proformas.length,
        companyCount: companies.length,
      };
    });
    res.json(stats);
  } catch {
    res.json({ userCount: 0, proformaCount: 0, companyCount: 0 });
  }
});


router.get("/api/stats/trends", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    const months = Math.min(Math.max(parseInt(req.query.months as string) || 6, 1), 24);
    const isAdmin = user?.userRole === 'admin';
    const interval = `${months} months`;

    const [proformaRes, tenderRes, voyageRes] = await Promise.all([
      isAdmin
        ? pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COALESCE(SUM(total_usd::numeric), 0) as total_usd FROM proformas WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY 1 ORDER BY 1`)
        : pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COALESCE(SUM(total_usd::numeric), 0) as total_usd FROM proformas WHERE created_at > NOW() - INTERVAL '${interval}' AND user_id = $1 GROUP BY 1 ORDER BY 1`, [userId]),
      isAdmin
        ? pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COUNT(*) FILTER (WHERE status = 'nominated') as completed FROM port_tenders WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY 1 ORDER BY 1`)
        : pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COUNT(*) FILTER (WHERE status = 'nominated') as completed FROM port_tenders WHERE created_at > NOW() - INTERVAL '${interval}' AND user_id = $1 GROUP BY 1 ORDER BY 1`, [userId]),
      isAdmin
        ? pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COUNT(*) FILTER (WHERE status = 'completed') as completed FROM voyages WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY 1 ORDER BY 1`)
        : pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COUNT(*) FILTER (WHERE status = 'completed') as completed FROM voyages WHERE created_at > NOW() - INTERVAL '${interval}' AND (user_id = $1 OR agent_user_id = $1) GROUP BY 1 ORDER BY 1`, [userId]),
    ]);

    res.json({ proformaTrend: proformaRes.rows, tenderTrend: tenderRes.rows, voyageTrend: voyageRes.rows });
  } catch (error) {
    console.error("Stats trends error:", error);
    res.status(500).json({ message: "Failed to fetch trend data" });
  }
});


router.get("/api/stats/dashboard", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    const role = user?.userRole;

    let stats: any = {};

    if (role === 'admin') {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE is_suspended = false)::int as total_users,
          (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '30 days')::int as new_users_month,
          (SELECT COUNT(*) FROM proformas)::int as total_proformas,
          (SELECT COUNT(*) FROM proformas WHERE created_at > NOW() - INTERVAL '30 days')::int as proformas_month,
          (SELECT COUNT(*) FROM port_tenders WHERE status = 'open')::int as open_tenders,
          (SELECT COUNT(*) FROM voyages WHERE status = 'in_progress')::int as active_voyages,
          (SELECT COUNT(*) FROM company_profiles WHERE is_approved = true)::int as verified_companies,
          (SELECT COALESCE(SUM(total_usd::numeric), 0) FROM proformas WHERE created_at > NOW() - INTERVAL '30 days') as revenue_month
      `);
      stats = rows[0];
    } else if (role === 'shipowner' || role === 'broker') {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM vessels WHERE user_id = $1)::int as my_vessels,
          (SELECT COUNT(*) FROM port_tenders WHERE user_id = $1 AND status = 'open')::int as my_open_tenders,
          (SELECT COUNT(*) FROM port_tenders WHERE user_id = $1 AND status = 'nominated')::int as my_completed_tenders,
          (SELECT COUNT(*) FROM voyages WHERE user_id = $1 AND status = 'in_progress')::int as my_active_voyages,
          (SELECT COUNT(*) FROM proformas WHERE user_id = $1)::int as my_proformas,
          (SELECT COALESCE(SUM(total_usd::numeric), 0) FROM proformas WHERE user_id = $1) as my_total_spend,
          (SELECT COUNT(*) FROM proformas WHERE user_id = $1 AND status = 'sent')::int as pending_pda_approvals,
          (SELECT COUNT(*) FROM fda_accounts fa JOIN voyages v ON fa.voyage_id = v.id WHERE v.user_id = $1)::int as my_fda_count,
          (SELECT COUNT(*) FROM invoices i JOIN voyages v ON i.voyage_id = v.id WHERE v.user_id = $1 AND i.status = 'pending')::int as pending_invoice_count,
          (SELECT COUNT(*) FROM invoices i JOIN voyages v ON i.voyage_id = v.id WHERE v.user_id = $1 AND i.status = 'pending' AND i.due_date < NOW())::int as overdue_invoice_count,
          (SELECT COALESCE(SUM(i.amount), 0) FROM invoices i JOIN voyages v ON i.voyage_id = v.id WHERE v.user_id = $1 AND i.status = 'pending') as pending_invoice_total
      `, [userId]);
      stats = rows[0];
    } else if (role === 'agent') {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM tender_bids WHERE agent_user_id = $1)::int as my_bids,
          (SELECT COUNT(*) FROM tender_bids WHERE agent_user_id = $1 AND status = 'selected')::int as won_bids,
          (SELECT COUNT(*) FROM voyages WHERE agent_user_id = $1 AND status = 'in_progress')::int as active_voyages,
          (SELECT COUNT(*) FROM voyages WHERE agent_user_id = $1 AND status = 'completed')::int as completed_voyages,
          (SELECT COUNT(*) FROM direct_nominations WHERE agent_user_id = $1 AND status = 'pending')::int as pending_nominations,
          (SELECT COALESCE(AVG(ar.rating), 0) FROM agent_reviews ar JOIN company_profiles cp ON ar.company_profile_id = cp.id WHERE cp.user_id = $1) as avg_rating,
          (SELECT COUNT(*) FROM fda_accounts WHERE user_id = $1 AND status = 'draft')::int as draft_fda_count,
          (SELECT COUNT(*) FROM fda_accounts WHERE user_id = $1 AND status = 'approved')::int as approved_fda_count,
          (SELECT COUNT(*) FROM voyages v WHERE (v.user_id = $1 OR v.agent_user_id = $1)
            AND EXISTS (SELECT 1 FROM proformas p WHERE p.voyage_id = v.id AND p.approval_status IN ('approved','finalized'))
            AND NOT EXISTS (SELECT 1 FROM fda_accounts f WHERE f.voyage_id = v.id))::int as needs_fda_count
      `, [userId]);
      stats = rows[0];
    } else if (role === 'provider') {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM service_offers WHERE provider_user_id = $1)::int as my_offers,
          (SELECT COUNT(*) FROM service_offers WHERE provider_user_id = $1 AND status = 'selected')::int as won_offers,
          (SELECT COUNT(*) FROM service_requests WHERE status = 'open')::int as open_requests
      `, [userId]);
      stats = rows[0];
    }

    const [tenderDist, voyageDist] = await Promise.all([
      role === 'admin'
        ? pool.query(`SELECT status, COUNT(*) as count FROM port_tenders GROUP BY status`)
        : pool.query(`SELECT status, COUNT(*) as count FROM port_tenders WHERE user_id = $1 GROUP BY status`, [userId]),
      role === 'admin'
        ? pool.query(`SELECT status, COUNT(*) as count FROM voyages GROUP BY status`)
        : pool.query(`SELECT status, COUNT(*) as count FROM voyages WHERE user_id = $1 OR agent_user_id = $1 GROUP BY status`, [userId]),
    ]);

    res.json({ stats, tenderDistribution: tenderDist.rows, voyageDistribution: voyageDist.rows });
  } catch (error) {
    console.error("Stats dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});


router.get("/api/activity-feed", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      (
        SELECT 'proforma' as type,
          'Proforma generated for ' || COALESCE(v.name, 'a vessel') || ' at ' || COALESCE(p.name, 'port') as message,
          'filetext' as icon,
          pr.created_at
        FROM proformas pr
        LEFT JOIN vessels v ON pr.vessel_id = v.id
        LEFT JOIN ports p ON pr.port_id = p.id
        WHERE pr.created_at IS NOT NULL
        ORDER BY pr.created_at DESC LIMIT 8
      )
      UNION ALL
      (
        SELECT 'vessel' as type,
          v.name || ' (' || COALESCE(v.flag, '?') || ') registered to the fleet' as message,
          'ship' as icon,
          v.created_at
        FROM vessels v
        WHERE v.created_at IS NOT NULL
        ORDER BY v.created_at DESC LIMIT 6
      )
      UNION ALL
      (
        SELECT 'company' as type,
          cp.company_name || ' joined as ' ||
            CASE WHEN cp.company_type = 'agent' THEN 'Ship Agent' ELSE 'Service Provider' END as message,
          'building' as icon,
          cp.created_at
        FROM company_profiles cp
        WHERE cp.created_at IS NOT NULL
        ORDER BY cp.created_at DESC LIMIT 6
      )
      UNION ALL
      (
        SELECT 'user' as type,
          COALESCE(u.first_name, 'A maritime professional') || ' joined VesselPDA as ' ||
            CASE WHEN u.user_role = 'agent' THEN 'Ship Agent'
                 WHEN u.user_role = 'provider' THEN 'Service Provider'
                 ELSE 'Shipowner' END as message,
          'user' as icon,
          u.created_at
        FROM users u
        WHERE u.created_at IS NOT NULL AND u.user_role != 'admin'
        ORDER BY u.created_at DESC LIMIT 4
      )
      UNION ALL
      (
        SELECT 'forum' as type,
          '"' || ft.title || '" posted in the forum' as message,
          'message-square' as icon,
          ft.created_at
        FROM forum_topics ft
        WHERE ft.created_at IS NOT NULL
        ORDER BY ft.created_at DESC LIMIT 6
      )
      ORDER BY created_at DESC
      LIMIT 20
    `);

    const activities = rows.map((r: any) => ({
      type: r.type,
      message: r.message,
      timestamp: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      icon: r.icon,
    }));

    res.json(activities);
  } catch (error) {
    console.error("Activity feed error:", error);
    res.status(500).json({ message: "Failed to fetch activity feed" });
  }
});


export default router;
