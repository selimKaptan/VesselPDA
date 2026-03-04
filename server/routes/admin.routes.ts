import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, authStorage } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { db, pool } from "../db";
import { sql as drizzleSql, eq, desc } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";
import { emitToUser } from "../socket";
import { geocodeStats } from "../geocode-ports";
import { loadSanctionsList } from "../sanctions";
import { getOrFetchRates } from "../exchange-rates";

const router = Router();

router.post("/bootstrap", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const APPROVED_ADMINS = ["selim@barbarosshipping.com"];
    if (!user || !APPROVED_ADMINS.includes(user.email || "")) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const updated = await storage.updateUserRole(userId, "admin");
    await storage.updateActiveRole(userId, "admin");
    res.json({ success: true, userRole: updated?.userRole });
  } catch (error) {
    res.status(500).json({ message: "Bootstrap failed" });
  }
});


router.patch("/active-role", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    if (!(await isAdmin(req))) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { activeRole } = req.body;
    if (!["shipowner", "agent", "provider", "admin"].includes(activeRole)) {
      return res.status(400).json({ message: "Invalid role. Choose: shipowner, agent, provider, or admin" });
    }
    const updated = await storage.updateActiveRole(userId, activeRole);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update active role" });
  }
});


router.get("/users", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const page = req.query.page ? parseInt(req.query.page as string) : null;
    if (page && !isNaN(page) && page > 0) {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = (page - 1) * limit;
      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
        pool.query(`SELECT COUNT(*) as total FROM users`),
      ]);
      const total = parseInt(countRes.rows[0].total) || 0;
      return res.json({ data: dataRes.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    const allUsers = await storage.getAllUsers();
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});


router.patch("/users/:id/plan", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { plan } = req.body;
    if (!["free", "standard", "unlimited"].includes(plan)) return res.status(400).json({ message: "Invalid plan" });
    const updated = await storage.updateUserSubscription(req.params.id, plan);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update plan" });
  }
});


router.patch("/users/:id/suspend", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { suspended } = req.body;
    const updated = await storage.suspendUser(req.params.id, !!suspended);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update suspension status" });
  }
});


router.patch("/users/:id/verify-email", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    await authStorage.markEmailVerified(req.params.id);
    const users = await storage.getAllUsers();
    const updated = users.find((u: any) => u.id === req.params.id);
    if (!updated) return res.status(404).json({ message: "User not found" });
    console.log(`[admin] Manually verified email for user ${req.params.id}`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to verify email" });
  }
});


router.get("/company-profiles", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const profiles = await storage.getAllCompanyProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch company profiles" });
  }
});


router.get("/companies/pending", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const profiles = await storage.getPendingCompanyProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending company profiles" });
  }
});


router.post("/companies/:id/approve", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const id = parseInt(req.params.id);
    const profile = await storage.approveCompanyProfile(id);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    logAction(req.user?.claims?.sub, "approve", "company_profile", id, { companyName: profile.companyName }, getClientIp(req));
    // Notify company owner
    await storage.createNotification({
      userId: profile.userId,
      type: "system",
      title: "Company Profile Approved",
      message: `Your company profile for ${profile.companyName} has been approved and is now visible in the directory.`,
      link: "/company-profile",
    });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to approve company profile" });
  }
});


router.delete("/companies/:id/reject", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const id = parseInt(req.params.id);
    const profile = await storage.getCompanyProfile(id);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    await storage.rejectCompanyProfile(id);
    // Notify company owner
    await storage.createNotification({
      userId: profile.userId,
      type: "system",
      title: "Company Profile Rejected",
      message: `Your company profile for ${profile.companyName} was not approved. Please review and resubmit.`,
      link: "/company-profile",
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to reject company profile" });
  }
});


router.get("/stats", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });

    const [userStatsRes, contentStatsRes, tendersByPortRes, bidsRes, monthlyRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE user_role = 'agent') as agents,
          COUNT(*) FILTER (WHERE user_role = 'shipowner') as shipowners,
          COUNT(*) FILTER (WHERE user_role = 'provider') as providers,
          COUNT(*) FILTER (WHERE user_role = 'admin') as admins,
          COUNT(*) FILTER (WHERE subscription_plan = 'free') as plan_free,
          COUNT(*) FILTER (WHERE subscription_plan = 'standard') as plan_standard,
          COUNT(*) FILTER (WHERE subscription_plan = 'unlimited') as plan_unlimited,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as weekly_users
        FROM users
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM vessels) as total_vessels,
          (SELECT COUNT(*) FROM proformas) as total_proformas,
          (SELECT COUNT(*) FROM company_profiles) as total_company_profiles,
          (SELECT COUNT(*) FROM port_tenders) as total_tenders,
          (SELECT COUNT(*) FROM port_tenders WHERE status = 'open') as open_tenders
      `),
      pool.query(`
        SELECT COALESCE(p.name, 'Port #' || pt.port_id::text) as port, COUNT(*) as count
        FROM port_tenders pt
        LEFT JOIN ports p ON pt.port_id = p.id
        GROUP BY pt.port_id, p.name
        ORDER BY count DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_bids,
          COUNT(*) FILTER (WHERE status = 'selected') as selected_bids
        FROM tender_bids
      `),
      pool.query(`
        SELECT TO_CHAR(date_trunc('month', created_at), 'Mon YY') as month, COUNT(*) as count
        FROM proformas
        WHERE created_at >= date_trunc('month', NOW() - INTERVAL '5 months')
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at)
      `),
    ]);

    const us = userStatsRes.rows[0];
    const cs = contentStatsRes.rows[0];
    const br = bidsRes.rows[0];

    const totalBids = parseInt(br.total_bids) || 0;
    const selectedBids = parseInt(br.selected_bids) || 0;
    const bidConversionRate = totalBids > 0 ? Math.round((selectedBids / totalBids) * 100) : 0;

    const tendersByPort = tendersByPortRes.rows.map((r: any) => ({ port: r.port, count: parseInt(r.count) }));

    const monthlyMap = new Map(monthlyRes.rows.map((r: any) => [r.month, parseInt(r.count)]));
    const now = new Date();
    const monthlyProformas = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      return { month: label, count: monthlyMap.get(label) || 0 };
    });

    res.json({
      totalUsers: parseInt(us.total_users) || 0,
      weeklyUsers: parseInt(us.weekly_users) || 0,
      totalVessels: parseInt(cs.total_vessels) || 0,
      totalProformas: parseInt(cs.total_proformas) || 0,
      totalCompanyProfiles: parseInt(cs.total_company_profiles) || 0,
      totalTenders: parseInt(cs.total_tenders) || 0,
      openTendersCount: parseInt(cs.open_tenders) || 0,
      totalBids,
      bidConversionRate,
      tendersByPort,
      monthlyProformas,
      usersByRole: {
        shipowner: parseInt(us.shipowners) || 0,
        agent: parseInt(us.agents) || 0,
        provider: parseInt(us.providers) || 0,
        admin: parseInt(us.admins) || 0,
      },
      usersByPlan: {
        free: parseInt(us.plan_free) || 0,
        standard: parseInt(us.plan_standard) || 0,
        unlimited: parseInt(us.plan_unlimited) || 0,
      },
    });
  } catch (error) {
    console.error("[admin/stats]", error);
    res.status(500).json({ message: "Failed to fetch admin stats" });
  }
});


router.get("/stats/enhanced", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });

    const statsRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE user_role = 'shipowner') as shipowners,
        (SELECT COUNT(*) FROM users WHERE user_role = 'agent') as agents,
        (SELECT COUNT(*) FROM users WHERE user_role = 'provider') as providers,
        (SELECT COUNT(*) FROM users WHERE user_role = 'broker') as brokers,
        (SELECT COUNT(*) FROM users WHERE user_role = 'admin') as admins,
        (SELECT COUNT(*) FROM users WHERE subscription_plan = 'free') as plan_free,
        (SELECT COUNT(*) FROM users WHERE subscription_plan = 'standard') as plan_standard,
        (SELECT COUNT(*) FROM users WHERE subscription_plan = 'unlimited') as plan_unlimited,
        (SELECT COUNT(*) FROM voyages WHERE status IN ('in_progress', 'scheduled')) as active_voyages,
        (SELECT COUNT(*) FROM voyages) as total_voyages,
        (SELECT COUNT(*) FROM proformas WHERE created_at >= CURRENT_DATE) as today_proformas,
        (SELECT COUNT(*) FROM voyages WHERE created_at >= CURRENT_DATE) as today_voyages,
        (SELECT COUNT(*) FROM service_requests WHERE created_at >= CURRENT_DATE) as today_sr,
        (SELECT COUNT(*) FROM company_profiles WHERE verification_status = 'pending') as pending_verifications,
        (SELECT COUNT(*) FROM company_profiles WHERE is_approved = false AND (verification_status IS NULL OR verification_status != 'pending')) as pending_approvals
    `);

    const s = statsRes.rows[0];

    res.json({
      totalUsers: parseInt(s.total_users) || 0,
      usersByRole: {
        shipowner: parseInt(s.shipowners) || 0,
        agent: parseInt(s.agents) || 0,
        provider: parseInt(s.providers) || 0,
        broker: parseInt(s.brokers) || 0,
        admin: parseInt(s.admins) || 0,
      },
      usersByPlan: {
        free: parseInt(s.plan_free) || 0,
        standard: parseInt(s.plan_standard) || 0,
        unlimited: parseInt(s.plan_unlimited) || 0,
      },
      activeVoyages: parseInt(s.active_voyages) || 0,
      todayTransactions: (parseInt(s.today_proformas) || 0) + (parseInt(s.today_voyages) || 0) + (parseInt(s.today_sr) || 0),
      pendingApprovals: parseInt(s.pending_approvals) || 0,
      pendingVerifications: parseInt(s.pending_verifications) || 0,
      totalVoyages: parseInt(s.total_voyages) || 0,
      systemHealth: {
        dbOk: true,
        aisOk: !!process.env.AIS_STREAM_API_KEY,
        teOk: !!process.env.TRADING_ECONOMICS_API_KEY,
        resendOk: !!process.env.RESEND_API_KEY,
      },
    });
  } catch (error) {
    console.error("[admin/stats/enhanced]", error);
    res.status(500).json({ message: "Failed to fetch enhanced stats" });
  }
});


router.get("/activity", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const activities: any[] = [];

    // Recent proformas
    const pRows = await db.execute(drizzleSql`
      SELECT p.id, p.reference_number, p.created_at, u.first_name, u.last_name, u.email
      FROM proformas p LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC LIMIT 10
    `);
    const proformas: any[] = (pRows as any).rows ?? (pRows as any);
    for (const p of proformas) {
      activities.push({ type: "proforma", icon: "FileText", label: `Proforma created: ${p.reference_number || "#" + p.id}`, user: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email, createdAt: p.created_at });
    }

    // Recent voyages
    const vRows = await db.execute(drizzleSql`
      SELECT v.id, v.status, v.created_at, u.first_name, u.last_name, u.email
      FROM voyages v LEFT JOIN users u ON v.user_id = u.id
      ORDER BY v.created_at DESC LIMIT 8
    `);
    const vList: any[] = (vRows as any).rows ?? (vRows as any);
    for (const v of vList) {
      activities.push({ type: "voyage", icon: "Ship", label: `Voyage created (#${v.id})`, user: `${v.first_name || ""} ${v.last_name || ""}`.trim() || v.email, createdAt: v.created_at });
    }

    // Recent service requests
    const srRows2 = await db.execute(drizzleSql`
      SELECT s.id, s.service_type, s.created_at, u.first_name, u.last_name, u.email
      FROM service_requests s LEFT JOIN users u ON s.requester_id = u.id
      ORDER BY s.created_at DESC LIMIT 8
    `);
    const srList: any[] = (srRows2 as any).rows ?? (srRows2 as any);
    for (const s of srList) {
      activities.push({ type: "service_request", icon: "Wrench", label: `Hizmet talebi: ${s.service_type || "#" + s.id}`, user: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email, createdAt: s.created_at });
    }

    // Recent user registrations
    const uRows = await db.execute(drizzleSql`
      SELECT id, first_name, last_name, email, user_role, created_at FROM users ORDER BY created_at DESC LIMIT 8
    `);
    const uList: any[] = (uRows as any).rows ?? (uRows as any);
    for (const u of uList) {
      activities.push({ type: "user_register", icon: "UserPlus", label: `New registration: ${u.user_role}`, user: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email, createdAt: u.created_at });
    }

    // Sort by date desc and take top 20
    activities.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(activities.slice(0, 20));
  } catch (error) {
    console.error("[admin/activity]", error);
    res.status(500).json({ message: "Failed to fetch activity" });
  }
});


router.get("/reports/user-growth", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const next = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      return { label: d.toLocaleString("tr-TR", { month: "short", year: "2-digit" }), start: d.toISOString(), end: next.toISOString() };
    });

    const result = await Promise.all(months.map(async (m) => {
      const rows = await db.execute(drizzleSql`
        SELECT user_role, COUNT(*) as cnt FROM users
        WHERE created_at >= ${m.start} AND created_at < ${m.end}
        GROUP BY user_role
      `);
      const list: any[] = (rows as any).rows ?? (rows as any);
      const byRole: any = { shipowner: 0, agent: 0, provider: 0, broker: 0, admin: 0 };
      let total = 0;
      for (const r of list) { byRole[r.user_role] = (byRole[r.user_role] || 0) + parseInt(r.cnt); total += parseInt(r.cnt); }
      return { month: m.label, total, ...byRole };
    }));

    res.json(result);
  } catch (error) {
    console.error("[admin/reports/user-growth]", error);
    res.status(500).json({ message: "Failed to fetch user growth" });
  }
});


router.get("/reports/active-users", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const rows = await db.execute(drizzleSql`
      SELECT u.id, u.first_name, u.last_name, u.email, u.user_role, u.subscription_plan,
        (SELECT COUNT(*) FROM proformas WHERE user_id = u.id) as proforma_count,
        (SELECT COUNT(*) FROM voyages WHERE user_id = u.id) as voyage_count,
        (SELECT COUNT(*) FROM service_requests WHERE requester_id = u.id) as sr_count
      FROM users u
      WHERE u.user_role != 'admin'
      ORDER BY (
        (SELECT COUNT(*) FROM proformas WHERE user_id = u.id) +
        (SELECT COUNT(*) FROM voyages WHERE user_id = u.id) +
        (SELECT COUNT(*) FROM service_requests WHERE requester_id = u.id)
      ) DESC
      LIMIT 10
    `);
    const list: any[] = (rows as any).rows ?? (rows as any);
    res.json(list.map(r => ({
      id: r.id, name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email,
      email: r.email, role: r.user_role, plan: r.subscription_plan,
      proformaCount: parseInt(r.proforma_count || 0),
      voyageCount: parseInt(r.voyage_count || 0),
      srCount: parseInt(r.sr_count || 0),
      totalActivity: parseInt(r.proforma_count || 0) + parseInt(r.voyage_count || 0) + parseInt(r.sr_count || 0),
    })));
  } catch (error) {
    console.error("[admin/reports/active-users]", error);
    res.status(500).json({ message: "Failed to fetch active users" });
  }
});


router.delete("/users/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const adminId = req.user?.claims?.sub || req.user?.id;
    if (req.params.id === adminId) return res.status(400).json({ message: "You cannot delete your own account" });
    await db.execute(drizzleSql`DELETE FROM users WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[admin/delete-user]", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});


router.post("/users", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { email, password, firstName, lastName, userRole, subscriptionPlan } = req.body;
    if (!email || !password || !firstName || !lastName || !userRole) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    await db.execute(drizzleSql`
      INSERT INTO users (id, email, password_hash, first_name, last_name, user_role, active_role, subscription_plan, email_verified, role_confirmed, is_suspended, created_at)
      VALUES (${id}, ${email}, ${passwordHash}, ${firstName}, ${lastName}, ${userRole}, ${userRole}, ${subscriptionPlan || "free"}, true, true, false, NOW())
    `);
    res.json({ success: true, id });
  } catch (error: any) {
    console.error("[admin/create-user]", error);
    if (error?.code === "23505") return res.status(400).json({ message: "This email is already registered" });
    res.status(500).json({ message: "Failed to create user" });
  }
});


router.patch("/users/:id/role", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { userRole } = req.body;
    if (!["shipowner", "agent", "provider", "broker"].includes(userRole)) return res.status(400).json({ message: "Invalid role" });
    await db.execute(drizzleSql`UPDATE users SET user_role = ${userRole}, active_role = ${userRole} WHERE id = ${req.params.id}`);
    const allUsers = await storage.getAllUsers();
    const updated = allUsers.find((u: any) => u.id === req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update role" });
  }
});


router.get("/users/:id/activity", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const uid = req.params.id;
    const activities: any[] = [];

    const pRows = await db.execute(drizzleSql`SELECT id, reference_number, created_at FROM proformas WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 5`);
    const proformas: any[] = (pRows as any).rows ?? (pRows as any);
    for (const p of proformas) activities.push({ type: "proforma", label: `Proforma: ${p.reference_number || "#" + p.id}`, createdAt: p.created_at });

    const vRows2 = await db.execute(drizzleSql`SELECT id, status, created_at FROM voyages WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 5`);
    const vList2: any[] = (vRows2 as any).rows ?? (vRows2 as any);
    for (const v of vList2) activities.push({ type: "voyage", label: `Sefer #${v.id} (${v.status})`, createdAt: v.created_at });

    const srRows3 = await db.execute(drizzleSql`SELECT id, service_type, created_at FROM service_requests WHERE requester_id = ${uid} ORDER BY created_at DESC LIMIT 5`);
    const srList2: any[] = (srRows3 as any).rows ?? (srRows3 as any);
    for (const s of srList2) activities.push({ type: "service_request", label: `Hizmet: ${s.service_type || "#" + s.id}`, createdAt: s.created_at });

    activities.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(activities.slice(0, 15));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user activity" });
  }
});


router.post("/announce", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { title, message, targetRole } = req.body;
    if (!title || !message) return res.status(400).json({ message: "Title and message are required" });

    const allUsers = await storage.getAllUsers();
    const targets = targetRole && targetRole !== "all"
      ? allUsers.filter((u: any) => u.userRole === targetRole && !u.isSuspended)
      : allUsers.filter((u: any) => u.userRole !== "admin" && !u.isSuspended);

    let sent = 0;
    for (const u of targets) {
      await storage.createNotification({ userId: (u as any).id, type: "system", title, message, link: "/" });
      sent++;
    }
    res.json({ success: true, sent });
  } catch (error) {
    console.error("[admin/announce]", error);
    res.status(500).json({ message: "Failed to send announcement" });
  }
});


router.get("/voyages", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const page = req.query.page ? parseInt(req.query.page as string) : null;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = page && page > 0 ? (page - 1) * limit : 0;
    const effectiveLimit = page && page > 0 ? limit : 100;

    const [dataRes, countRes] = await Promise.all([
      pool.query(`
        SELECT v.id, v.status, v.created_at, v.eta, v.etd,
          u.first_name, u.last_name, u.email, u.user_role,
          ves.name as vessel_name, ves.imo_number,
          p.name as port_name
        FROM voyages v
        LEFT JOIN users u ON v.user_id = u.id
        LEFT JOIN vessels ves ON v.vessel_id = ves.id
        LEFT JOIN ports p ON v.port_id = p.id
        ORDER BY v.created_at DESC
        LIMIT $1 OFFSET $2
      `, [effectiveLimit, offset]),
      page && page > 0 ? pool.query(`SELECT COUNT(*) as total FROM voyages`) : Promise.resolve(null),
    ]);

    if (page && page > 0 && countRes) {
      const total = parseInt(countRes.rows[0].total) || 0;
      return res.json({ data: dataRes.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    res.json(dataRes.rows);
  } catch (error) {
    console.error("[admin/voyages]", error);
    res.status(500).json({ message: "Failed to fetch voyages" });
  }
});


router.get("/service-requests-list", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const rows = await db.execute(drizzleSql`
      SELECT s.id, s.service_type, s.status, s.description, s.created_at,
        u.first_name, u.last_name, u.email,
        p.name as port_name
      FROM service_requests s
      LEFT JOIN users u ON s.requester_id = u.id
      LEFT JOIN ports p ON s.port_id = p.id
      ORDER BY s.created_at DESC
      LIMIT 100
    `);
    const list: any[] = (rows as any).rows ?? (rows as any);
    res.json(list);
  } catch (error) {
    console.error("[admin/service-requests]", error);
    res.status(500).json({ message: "Failed to fetch service requests" });
  }
});


router.get("/geocode-status", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    res.json({
      total: geocodeStats.total,
      processed: geocodeStats.processed,
      found: geocodeStats.found,
      notFound: geocodeStats.notFound,
      running: geocodeStats.running,
      startedAt: geocodeStats.startedAt,
      remaining: geocodeStats.total - geocodeStats.processed,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch geocode status" });
  }
});


router.post("/cleanup-ports", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });

    const badPortIds = `
      SELECT p.id FROM ports p
      WHERE p.country = 'Turkey' AND (
        lower(p.name) LIKE '%demir saha%'
        OR lower(p.name) LIKE '%demirleme saha%'
        OR lower(p.name) LIKE '%samandira%'
        OR p.name ILIKE '%şamandıra%'
        OR lower(p.name) LIKE '%nolu demir%'
        OR lower(p.name) LIKE '%nolu demirleme%'
        OR lower(p.name) LIKE '% boya%'
      )
    `;
    const dupPortIds = `
      SELECT p.id FROM ports p
      WHERE p.country = 'Turkey'
        AND p.id NOT IN (SELECT MIN(p2.id) FROM ports p2 WHERE p2.country = 'Turkey' GROUP BY p2.code)
        AND p.code IN (SELECT p3.code FROM ports p3 WHERE p3.country = 'Turkey' GROUP BY p3.code HAVING COUNT(*) > 1)
    `;
    const allBadIds = `SELECT id FROM (${badPortIds} UNION ${dupPortIds}) sub`;

    const r1 = await pool.query(`DELETE FROM tariff_rates WHERE category_id IN (SELECT tc.id FROM tariff_categories tc WHERE tc.port_id IN (${allBadIds}))`);
    const r2 = await pool.query(`DELETE FROM tariff_categories WHERE port_id IN (${allBadIds})`);
    const r3 = await pool.query(`DELETE FROM ports WHERE id IN (${badPortIds})`);
    const r4 = await pool.query(`DELETE FROM ports WHERE id IN (${dupPortIds})`);

    const countResult = await pool.query(`SELECT COUNT(*) AS remaining FROM ports WHERE country = 'Turkey'`);
    const remaining = countResult.rows[0]?.remaining ?? "?";

    res.json({
      message: "Cleanup complete",
      deletedRates: (r1 as any).rowCount ?? 0,
      deletedCategories: (r2 as any).rowCount ?? 0,
      deletedBadPorts: (r3 as any).rowCount ?? 0,
      deletedDupPorts: (r4 as any).rowCount ?? 0,
      remainingTurkishPorts: remaining,
    });
  } catch (error: any) {
    console.error("Cleanup error:", error);
    res.status(500).json({ message: "Cleanup failed", error: error.message });
  }
});


router.get("/pending-verifications", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const pending = await storage.getPendingVerifications();
    res.json(pending);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending verifications" });
  }
});


router.post("/verify-company/:profileId", isAuthenticated, async (req: any, res) => {
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


router.post("/bunker-prices", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const price = await storage.upsertBunkerPrice({ ...req.body, updatedBy: userId });
    res.status(201).json(price);
  } catch {
    res.status(500).json({ message: "Failed to save bunker price" });
  }
});


router.patch("/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const price = await storage.upsertBunkerPrice({ ...req.body, updatedBy: userId });
    res.json(price);
  } catch {
    res.status(500).json({ message: "Failed to update bunker price" });
  }
});


router.delete("/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.deleteBunkerPrice(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete bunker price" });
  }
});


router.get("/port-alerts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const alerts = await storage.getAllPortAlerts();
    res.json(alerts);
  } catch {
    res.status(500).json({ message: "Failed to get all port alerts" });
  }
});


// ─── TARIFF TABLES CONSTANTS ────────────────────────────────────────────────
const ALLOWED_TARIFF_TABLES: Record<string, { label: string; feeFields: string[] }> = {
  pilotage_tariffs: { label: "Pilotage Fees", feeFields: ["base_fee", "per_1000_grt"] },
  external_pilotage_tariffs: { label: "External Pilotage", feeFields: ["grt_up_to_1000", "per_additional_1000_grt"] },
  berthing_tariffs: { label: "Berthing Fees", feeFields: ["intl_foreign_flag", "intl_turkish_flag", "cabotage_turkish"] },
  agency_fees: { label: "Agency Fees", feeFields: ["fee"] },
  marpol_tariffs: { label: "MARPOL Waste Fees", feeFields: ["fixed_fee", "weekday_ek1_rate", "weekday_ek4_rate", "weekday_ek5_rate"] },
  port_authority_fees: { label: "Port Authority Fees", feeFields: ["amount"] },
  lcb_tariffs: { label: "LCB Tariffs", feeFields: ["amount"] },
  tonnage_tariffs: { label: "Tonnage Tariffs", feeFields: ["ithalat", "ihracat"] },
  other_services: { label: "Other Services", feeFields: ["fee"] },
  cargo_handling_tariffs: { label: "Loading / Discharging", feeFields: ["rate"] },
  light_dues: { label: "Light Dues", feeFields: ["rate_up_to_800", "rate_above_800"] },
  chamber_of_shipping_fees: { label: "Chamber of Shipping Fee", feeFields: ["fee"] },
  chamber_freight_share: { label: "Chamber of Shipping Share on Freight", feeFields: ["fee"] },
  harbour_master_dues: { label: "Harbour Master Dues", feeFields: ["fee"] },
  sanitary_dues: { label: "Sanitary Dues", feeFields: ["nrt_rate"] },
  vts_fees: { label: "VTS Fee", feeFields: ["fee"] },
  supervision_fees: { label: "Supervision Fee", feeFields: ["rate"] },
  misc_expenses: { label: "Miscellaneous Expenses", feeFields: ["fee_usd"] },
};

const checkAdmin = async (req: any, res: any): Promise<boolean> => {
  const userId = req.user?.claims?.sub || req.user?.id;
  const userRow = await storage.getUser(userId);
  if ((userRow as any)?.userRole !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }
  return true;
};


router.get("/tariffs/summary", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });

    const counts: Record<string, number> = {};
    let totalRecords = 0;
    let latestUpdate: Date | null = null;
    let outdatedCount = 0;
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    for (const tbl of Object.keys(ALLOWED_TARIFF_TABLES)) {
      const result = await pool.query(`SELECT count(*)::int as cnt, max(updated_at) as latest FROM ${tbl}`);
      const row = result.rows[0];
      counts[tbl] = row.cnt || 0;
      totalRecords += row.cnt || 0;
      if (row.latest && (!latestUpdate || new Date(row.latest) > latestUpdate)) {
        latestUpdate = new Date(row.latest);
      }
      const oldResult = await pool.query(`SELECT count(*)::int as cnt FROM ${tbl} WHERE updated_at < $1`, [oneYearAgo]);
      outdatedCount += oldResult.rows[0].cnt || 0;
    }

    const portCount = await pool.query(`SELECT count(distinct port_id)::int as cnt FROM pilotage_tariffs WHERE port_id IS NOT NULL`);
    res.json({
      portCount: portCount.rows[0].cnt || 0,
      totalRecords,
      lastUpdated: latestUpdate,
      outdatedCount,
      tableCounts: counts,
    });
  } catch (err) {
    console.error("Tariff summary error:", err);
    res.status(500).json({ message: "Failed to fetch tariff summary" });
  }
});


router.get("/tariffs/:table", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    const params: any[] = [];
    const conditions: string[] = [];
    if (req.query.portId === "global") {
      conditions.push("port_id IS NULL");
    } else if (req.query.portId && req.query.portId !== "all") {
      params.push(parseInt(req.query.portId as string));
      conditions.push(`(port_id = $${params.length} OR port_id IS NULL)`);
    }
    if (req.query.currency && req.query.currency !== "all") {
      params.push(req.query.currency as string);
      conditions.push(`currency = $${params.length}`);
    }
    if (req.query.year && req.query.year !== "all") {
      params.push(parseInt(req.query.year as string));
      conditions.push(`valid_year = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM ${tbl} ${where} ORDER BY id LIMIT 500`, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Tariff list error:", err);
    res.status(500).json({ message: "Failed to fetch tariffs" });
  }
});


router.post("/tariffs/:table", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    const body = { ...req.body };
    delete body.id;
    body.updated_at = new Date().toISOString();

    const SAFE_COL = /^[a-z_][a-z0-9_]*$/i;
    const keys = Object.keys(body).filter(k => body[k] !== undefined && SAFE_COL.test(k));
    const cols = keys.map(k => `"${k}"`).join(", ");
    const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map(k => (body[k] === "" ? null : body[k]));

    const result = await pool.query(`INSERT INTO ${tbl} (${cols}) VALUES (${vals}) RETURNING *`, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Tariff create error:", err);
    res.status(500).json({ message: "Failed to create tariff" });
  }
});


router.patch("/tariffs/:table/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    const body = { ...req.body };
    delete body.id;
    body.updated_at = new Date().toISOString();

    const SAFE_COL = /^[a-z_][a-z0-9_]*$/i;
    const keys = Object.keys(body).filter(k => body[k] !== undefined && SAFE_COL.test(k));
    const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const values: any[] = keys.map(k => (body[k] === "" ? null : body[k]));
    values.push(parseInt(req.params.id));

    const result = await pool.query(`UPDATE ${tbl} SET ${sets} WHERE id = $${values.length} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Tariff update error:", err);
    res.status(500).json({ message: "Failed to update tariff" });
  }
});


router.delete("/tariffs/:table/clear", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });
    const portId = req.query.portId as string | undefined;
    if (!portId || portId === "null" || portId === "global") {
      await pool.query(`DELETE FROM ${tbl} WHERE port_id IS NULL`);
    } else {
      await pool.query(`DELETE FROM ${tbl} WHERE port_id = $1`, [parseInt(portId)]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Tariff clear error:", err);
    res.status(500).json({ message: "Failed to clear tariff records" });
  }
});


router.delete("/tariffs/:table/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    await pool.query(`DELETE FROM ${tbl} WHERE id = $1`, [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error("Tariff delete error:", err);
    res.status(500).json({ message: "Failed to delete tariff" });
  }
});


router.post("/tariffs/:table/bulk-increase", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    const { ids, percent } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || typeof percent !== "number") {
      return res.status(400).json({ message: "ids[] and percent required" });
    }
    const safeIds = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (safeIds.length === 0) return res.status(400).json({ message: "No valid ids provided" });
    const feeFields = ALLOWED_TARIFF_TABLES[tbl].feeFields;
    const multiplier = 1 + percent / 100;
    const sets = feeFields.map(f => `"${f}" = ROUND(COALESCE("${f}", 0) * ${multiplier}, 2)`).join(", ");
    await pool.query(`UPDATE ${tbl} SET ${sets}, updated_at = NOW() WHERE id = ANY($1::int[])`, [safeIds]);
    res.json({ success: true, affected: safeIds.length });
  } catch (err) {
    console.error("Bulk increase error:", err);
    res.status(500).json({ message: "Failed to apply bulk increase" });
  }
});


router.post("/tariffs/:table/bulk-copy-year", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    const { ids, targetYear } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || typeof targetYear !== "number") {
      return res.status(400).json({ message: "ids[] and targetYear required" });
    }
    const safeTargetYear = Math.trunc(targetYear);
    if (isNaN(safeTargetYear) || safeTargetYear < 2000 || safeTargetYear > 2100) {
      return res.status(400).json({ message: "Invalid targetYear — must be between 2000 and 2100" });
    }
    const safeIds = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (safeIds.length === 0) return res.status(400).json({ message: "No valid ids provided" });

    const colResult = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name NOT IN ('id','updated_at') ORDER BY ordinal_position`,
      [tbl]
    );
    const cols = colResult.rows.map((r: any) => r.column_name);
    const colStr = cols.map((c: string) => c === "valid_year" ? `${safeTargetYear}` : `"${c}"`).join(", ");
    await pool.query(`INSERT INTO ${tbl} (${cols.map((c: string) => `"${c}"`).join(", ")}) SELECT ${colStr} FROM ${tbl} WHERE id = ANY($1::int[])`, [safeIds]);
    res.json({ success: true, copied: safeIds.length });
  } catch (err) {
    console.error("Bulk copy year error:", err);
    res.status(500).json({ message: "Failed to copy tariffs to year" });
  }
});


router.get("/tariff-custom-sections", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    const result = await pool.query("SELECT * FROM custom_tariff_sections ORDER BY sort_order, id");
    res.json(result.rows);
  } catch (err) {
    console.error("Custom sections list error:", err);
    res.status(500).json({ message: "Failed to fetch custom sections" });
  }
});


router.post("/tariff-custom-sections", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    const { label, default_currency } = req.body;
    if (!label?.trim()) return res.status(400).json({ message: "Label is required" });
    const result = await pool.query(
      "INSERT INTO custom_tariff_sections (label, default_currency) VALUES ($1, $2) RETURNING *",
      [label.trim(), default_currency || "USD"]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Custom section create error:", err);
    res.status(500).json({ message: "Failed to create custom section" });
  }
});


router.delete("/tariff-custom-sections/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    await pool.query("DELETE FROM custom_tariff_sections WHERE id = $1", [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error("Custom section delete error:", err);
    res.status(500).json({ message: "Failed to delete custom section" });
  }
});


router.get("/tariff-custom-sections/:id/entries", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    const sectionId = parseInt(req.params.id);
    const params: any[] = [sectionId];
    let portCondition = "";
    if (req.query.portId === "global") {
      portCondition = "AND port_id IS NULL";
    } else if (req.query.portId && req.query.portId !== "all") {
      params.push(parseInt(req.query.portId as string));
      portCondition = `AND port_id = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT * FROM custom_tariff_entries WHERE section_id = $1 ${portCondition} ORDER BY id`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Custom entries list error:", err);
    res.status(500).json({ message: "Failed to fetch entries" });
  }
});


router.post("/tariff-custom-sections/:id/entries", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    const sectionId = parseInt(req.params.id);
    const body = { ...req.body };
    delete body.id;
    body.section_id = sectionId;
    body.updated_at = new Date().toISOString();
    const keys = Object.keys(body).filter(k => body[k] !== undefined);
    const cols = keys.map(k => `"${k}"`).join(", ");
    const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map(k => (body[k] === "" ? null : body[k]));
    const result = await pool.query(
      `INSERT INTO custom_tariff_entries (${cols}) VALUES (${vals}) RETURNING *`,
      values
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Custom entry create error:", err);
    res.status(500).json({ message: "Failed to create entry" });
  }
});


router.patch("/tariff-custom-sections/:id/entries/:entryId", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    const entryId = parseInt(req.params.entryId);
    const body = { ...req.body };
    delete body.id;
    delete body.section_id;
    body.updated_at = new Date().toISOString();
    const keys = Object.keys(body).filter(k => body[k] !== undefined);
    const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const values = [...keys.map(k => (body[k] === "" ? null : body[k])), entryId];
    const result = await pool.query(
      `UPDATE custom_tariff_entries SET ${sets} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Custom entry update error:", err);
    res.status(500).json({ message: "Failed to update entry" });
  }
});


router.delete("/tariff-custom-sections/:id/entries/:entryId", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    const entryId = parseInt(req.params.entryId);
    await pool.query("DELETE FROM custom_tariff_entries WHERE id = $1", [entryId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Custom entry delete error:", err);
    res.status(500).json({ message: "Failed to delete entry" });
  }
});


router.get("/audit-logs", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { userId, action, entityType, from, to, limit: lim, offset: off } = req.query;
    let query = `
      SELECT al.*, u.email, u.first_name, u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (userId) { params.push(userId); query += ` AND al.user_id = $${params.length}`; }
    if (action) { params.push(action); query += ` AND al.action = $${params.length}`; }
    if (entityType) { params.push(entityType); query += ` AND al.entity_type = $${params.length}`; }
    if (from) { params.push(from); query += ` AND al.created_at >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND al.created_at <= $${params.length}`; }
    query += ` ORDER BY al.created_at DESC`;
    const limitVal = Math.min(parseInt(lim as string) || 100, 500);
    const offsetVal = parseInt(off as string) || 0;
    params.push(limitVal); query += ` LIMIT $${params.length}`;
    params.push(offsetVal); query += ` OFFSET $${params.length}`;
    const result = await pool.query(query, params);

    // Count query
    let countQ = `SELECT COUNT(*) FROM audit_logs al WHERE 1=1`;
    const countParams: any[] = [];
    if (userId) { countParams.push(userId); countQ += ` AND al.user_id = $${countParams.length}`; }
    if (action) { countParams.push(action); countQ += ` AND al.action = $${countParams.length}`; }
    if (entityType) { countParams.push(entityType); countQ += ` AND al.entity_type = $${countParams.length}`; }
    if (from) { countParams.push(from); countQ += ` AND al.created_at >= $${countParams.length}`; }
    if (to) { countParams.push(to); countQ += ` AND al.created_at <= $${countParams.length}`; }
    const countResult = await pool.query(countQ, countParams);

    res.json({ logs: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});


export default router;
