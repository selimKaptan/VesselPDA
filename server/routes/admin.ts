import { geocodeStats } from "../geocode-ports";
import { loadSanctionsList } from "../sanctions";
import { config } from "../config";
import { parsePaginationParams, paginateArray, buildPaginationMeta } from "../utils/pagination";
import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { authStorage } from "../replit_integrations/auth/storage";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";
import { cache } from "../cache";
import { handleAiChat } from "../anthropic";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

router.get("/admin/users", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { page, limit } = parsePaginationParams(req.query);
    const search = (req.query.search as string || "").toLowerCase();
    let allUsers = await storage.getAllUsers();
    if (search) {
      allUsers = allUsers.filter((u: any) =>
        u.email?.toLowerCase().includes(search) ||
        u.firstName?.toLowerCase().includes(search) ||
        u.lastName?.toLowerCase().includes(search) ||
        u.userRole?.toLowerCase().includes(search)
      );
    }
    res.json(paginateArray(allUsers, page, limit));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.patch("/admin/users/:id/plan", isAuthenticated, async (req: any, res) => {
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

router.patch("/admin/users/:id/suspend", isAuthenticated, async (req: any, res) => {
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

router.patch("/admin/users/:id/verify-email", isAuthenticated, async (req: any, res) => {
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

router.get("/admin/company-profiles", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const profiles = await storage.getAllCompanyProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch company profiles" });
  }
});

router.get("/admin/companies/pending", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const profiles = await storage.getPendingCompanyProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending company profiles" });
  }
});

router.post("/admin/companies/:id/approve", isAuthenticated, async (req: any, res) => {
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

router.delete("/admin/companies/:id/reject", isAuthenticated, async (req: any, res) => {
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

router.get("/admin/stats", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const allUsers = await storage.getAllUsers();
    const allVessels = await storage.getAllVessels();
    const allProformas = await storage.getAllProformas();
    const allProfiles = await storage.getAllCompanyProfiles();
    const allTenders = await storage.getPortTenders({});
    const allBids: any[] = [];
    for (const tender of allTenders) {
      const bids = await storage.getTenderBids(tender.id);
      allBids.push(...bids);
    }

    // Tenders by port (top 10)
    const portTenderCount: Record<string, number> = {};
    for (const t of allTenders) {
      const pn = (t as any).portName || `Port #${t.portId}`;
      portTenderCount[pn] = (portTenderCount[pn] || 0) + 1;
    }
    const tendersByPort = Object.entries(portTenderCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([port, count]) => ({ port, count }));

    // Bid conversion
    const selectedBids = allBids.filter(b => b.status === "selected").length;
    const bidConversionRate = allBids.length > 0 ? Math.round((selectedBids / allBids.length) * 100) : 0;

    // Monthly proformas (last 6 months)
    const now = new Date();
    const monthlyProformas = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const count = allProformas.filter(p => {
        const pd = new Date((p as any).createdAt || 0);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      }).length;
      return { month: label, count };
    });

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > oneWeekAgo).length;
    const openTendersCount = allTenders.filter(t => t.status === "open").length;

    res.json({
      totalUsers: allUsers.length,
      weeklyUsers,
      totalVessels: allVessels.length,
      totalProformas: allProformas.length,
      totalCompanyProfiles: allProfiles.length,
      totalTenders: allTenders.length,
      openTendersCount,
      totalBids: allBids.length,
      bidConversionRate,
      tendersByPort,
      monthlyProformas,
      usersByRole: {
        shipowner: allUsers.filter(u => u.userRole === "shipowner").length,
        agent: allUsers.filter(u => u.userRole === "agent").length,
        provider: allUsers.filter(u => u.userRole === "provider").length,
        admin: allUsers.filter(u => u.userRole === "admin").length,
      },
      usersByPlan: {
        free: allUsers.filter(u => u.subscriptionPlan === "free").length,
        standard: allUsers.filter(u => u.subscriptionPlan === "standard").length,
        unlimited: allUsers.filter(u => u.subscriptionPlan === "unlimited").length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admin stats" });
  }
});

// ─── ENHANCED ADMIN STATS (active voyages, pending approvals, today's txns) ───
router.get("/admin/stats/enhanced", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const allUsers = await storage.getAllUsers();
    const pendingProfiles = await storage.getPendingCompanyProfiles();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Active voyages (in_progress or scheduled)
    const voyagesRows = await db.execute(drizzleSql`SELECT id, status FROM voyages`);
    const voyages: any[] = (voyagesRows as any).rows ?? (voyagesRows as any);
    const activeVoyages = voyages.filter((v: any) => v.status === "in_progress" || v.status === "scheduled").length;

    // Today's transactions (proformas + voyages + service requests created today)
    const proformaRows = await db.execute(drizzleSql`SELECT id FROM proformas WHERE created_at >= ${today.toISOString()}`);
    const todayProformas = ((proformaRows as any).rows ?? (proformaRows as any)).length;
    const voyageTodayRows = await db.execute(drizzleSql`SELECT id FROM voyages WHERE created_at >= ${today.toISOString()}`);
    const todayVoyages = ((voyageTodayRows as any).rows ?? (voyageTodayRows as any)).length;
    const srRows = await db.execute(drizzleSql`SELECT id FROM service_requests WHERE created_at >= ${today.toISOString()}`);
    const todaySR = ((srRows as any).rows ?? (srRows as any)).length;
    const todayTransactions = todayProformas + todayVoyages + todaySR;

    // Pending verifications
    const pendingVerifRows = await db.execute(drizzleSql`SELECT id FROM company_profiles WHERE verification_status = 'pending'`);
    const pendingVerifications = ((pendingVerifRows as any).rows ?? (pendingVerifRows as any)).length;

    // System health
    const dbOk = true;
    const aisOk = !!config.AIS_STREAM_API_KEY;
    const teOk = !!config.TRADING_ECONOMICS_API_KEY;
    const resendOk = !!config.RESEND_API_KEY;

    res.json({
      totalUsers: allUsers.length,
      usersByRole: {
        shipowner: allUsers.filter((u: any) => u.userRole === "shipowner").length,
        agent: allUsers.filter((u: any) => u.userRole === "agent").length,
        provider: allUsers.filter((u: any) => u.userRole === "provider").length,
        broker: allUsers.filter((u: any) => u.userRole === "broker").length,
        admin: allUsers.filter((u: any) => u.userRole === "admin").length,
      },
      usersByPlan: {
        free: allUsers.filter((u: any) => u.subscriptionPlan === "free").length,
        standard: allUsers.filter((u: any) => u.subscriptionPlan === "standard").length,
        unlimited: allUsers.filter((u: any) => u.subscriptionPlan === "unlimited").length,
      },
      activeVoyages,
      todayTransactions,
      pendingApprovals: pendingProfiles.length,
      pendingVerifications,
      totalVoyages: voyages.length,
      systemHealth: { dbOk, aisOk, teOk, resendOk },
    });
  } catch (error) {
    console.error("[admin/stats/enhanced]", error);
    res.status(500).json({ message: "Failed to fetch enhanced stats" });
  }
});

// ─── ADMIN ACTIVITY FEED ───────────────────────────────────────────────────
router.get("/admin/activity", isAuthenticated, async (req: any, res) => {
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
      activities.push({ type: "proforma", icon: "FileText", label: `Proforma oluşturuldu: ${p.reference_number || "#" + p.id}`, user: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email, createdAt: p.created_at });
    }

    // Recent voyages
    const vRows = await db.execute(drizzleSql`
      SELECT v.id, v.status, v.created_at, u.first_name, u.last_name, u.email
      FROM voyages v LEFT JOIN users u ON v.user_id = u.id
      ORDER BY v.created_at DESC LIMIT 8
    `);
    const vList: any[] = (vRows as any).rows ?? (vRows as any);
    for (const v of vList) {
      activities.push({ type: "voyage", icon: "Ship", label: `Sefer oluşturuldu (#${v.id})`, user: `${v.first_name || ""} ${v.last_name || ""}`.trim() || v.email, createdAt: v.created_at });
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
      activities.push({ type: "user_register", icon: "UserPlus", label: `Yeni kayıt: ${u.user_role}`, user: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email, createdAt: u.created_at });
    }

    // Sort by date desc and take top 20
    activities.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(activities.slice(0, 20));
  } catch (error) {
    console.error("[admin/activity]", error);
    res.status(500).json({ message: "Failed to fetch activity" });
  }
});

// ─── ADMIN REPORTS ─────────────────────────────────────────────────────────
router.get("/admin/reports/user-growth", isAuthenticated, async (req: any, res) => {
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

router.get("/admin/reports/active-users", isAuthenticated, async (req: any, res) => {
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

// ─── ADMIN USER CRUD ───────────────────────────────────────────────────────
router.delete("/admin/users/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const adminId = req.user?.claims?.sub || req.user?.id;
    if (req.params.id === adminId) return res.status(400).json({ message: "Kendi hesabınızı silemezsiniz" });
    await db.execute(drizzleSql`DELETE FROM users WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[admin/delete-user]", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

router.post("/admin/users", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { email, password, firstName, lastName, userRole, subscriptionPlan } = req.body;
    if (!email || !password || !firstName || !lastName || !userRole) {
      return res.status(400).json({ message: "Tüm alanlar zorunludur" });
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
    if (error?.code === "23505") return res.status(400).json({ message: "Bu e-posta zaten kayıtlı" });
    res.status(500).json({ message: "Kullanıcı oluşturulamadı" });
  }
});

router.patch("/admin/users/:id/role", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { userRole } = req.body;
    const validRoles = ["ship_agent", "shipowner", "ship_broker", "ship_provider", "admin"];
    if (!validRoles.includes(userRole)) return res.status(400).json({ message: "Geçersiz rol" });
    const adminId = req.user?.claims?.sub || req.user?.id;
    await db.execute(drizzleSql`UPDATE users SET user_role = ${userRole}, active_role = ${userRole} WHERE id = ${req.params.id}`);
    logAction(adminId, "update", "user", req.params.id, { action: "role_change", newRole: userRole }, "");
    const allUsers = await storage.getAllUsers();
    const updated = allUsers.find((u: any) => u.id === req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update role" });
  }
});

router.get("/admin/users/:id/activity", isAuthenticated, async (req: any, res) => {
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

// ─── ADMIN ANNOUNCE ────────────────────────────────────────────────────────
router.post("/admin/announce", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { title, message, targetRole } = req.body;
    if (!title || !message) return res.status(400).json({ message: "Başlık ve mesaj zorunludur" });

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
    res.status(500).json({ message: "Duyuru gönderilemedi" });
  }
});

// ─── ADMIN CONTENT MANAGEMENT ─────────────────────────────────────────────
router.get("/admin/voyages", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const rows = await db.execute(drizzleSql`
      SELECT v.id, v.status, v.created_at, v.eta, v.etd,
        u.first_name, u.last_name, u.email, u.user_role,
        ves.name as vessel_name, ves.imo_number,
        p.name as port_name
      FROM voyages v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN vessels ves ON v.vessel_id = ves.id
      LEFT JOIN ports p ON v.port_id = p.id
      ORDER BY v.created_at DESC
      LIMIT 100
    `);
    const list: any[] = (rows as any).rows ?? (rows as any);
    res.json(list);
  } catch (error) {
    console.error("[admin/voyages]", error);
    res.status(500).json({ message: "Failed to fetch voyages" });
  }
});

router.get("/admin/service-requests-list", isAuthenticated, async (req: any, res) => {
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

router.get("/admin/geocode-status", isAuthenticated, async (req: any, res) => {
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

router.post("/admin/cleanup-ports", isAuthenticated, async (req: any, res) => {
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

    const r1 = await db.execute(drizzleSql.raw(`DELETE FROM tariff_rates WHERE category_id IN (SELECT tc.id FROM tariff_categories tc WHERE tc.port_id IN (${allBadIds}))`));
    const r2 = await db.execute(drizzleSql.raw(`DELETE FROM tariff_categories WHERE port_id IN (${allBadIds})`));
    const r3 = await db.execute(drizzleSql.raw(`DELETE FROM ports WHERE id IN (${badPortIds})`));
    const r4 = await db.execute(drizzleSql.raw(`DELETE FROM ports WHERE id IN (${dupPortIds})`));

    const countResult = await db.execute(drizzleSql.raw(`SELECT COUNT(*) AS remaining FROM ports WHERE country = 'Turkey'`));
    const remaining = (countResult.rows[0] as any)?.remaining ?? "?";

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

router.get("/admin/feedback", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const items = await storage.getAllFeedbacks();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

router.post("/admin/bunker-prices", isAuthenticated, async (req: any, res) => {
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

router.patch("/admin/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
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

router.delete("/admin/bunker-prices/:id", isAuthenticated, async (req: any, res) => {
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
router.get("/admin/port-alerts", isAuthenticated, async (req: any, res) => {
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

router.post("/port-alerts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const { portId, portName, alertType, severity, title, message, isActive, startsAt, endsAt } = req.body;
    if (!portName || !title || !message) return res.status(400).json({ message: "portName, title, message required" });

    const alert = await storage.createPortAlert({
      portId: portId ? parseInt(portId) : null,
      portName,
      alertType: alertType || "other",
      severity: severity || "info",
      title,
      message,
      isActive: isActive !== false,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      createdByUserId: userId,
    });
    res.status(201).json(alert);
  } catch {
    res.status(500).json({ message: "Failed to create port alert" });
  }
});

router.patch("/port-alerts/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.updatePortAlert(id, req.body);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to update port alert" });
  }
});

router.delete("/port-alerts/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    if (user?.userRole !== "admin") return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.deletePortAlert(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete port alert" });
  }
});

router.post("/ai/chat", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array required" });
    }
    const validMessages = messages.filter(
      (m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );
    if (validMessages.length === 0) {
      return res.status(400).json({ message: "No valid messages" });
    }
    const result = await handleAiChat(userId, validMessages);
    res.json(result);
  } catch (err: any) {
    console.error("AI chat error:", err);
    res.status(500).json({ message: "AI servisine bağlanılamadı" });
  }
});
// ─── TARIFF MANAGEMENT (Admin only) ────────────────────────────────────────

const ALLOWED_TARIFF_TABLES: Record<string, { label: string; feeFields: string[] }> = {
  pilotage_tariffs: { label: "Kılavuzluk Ücretleri", feeFields: ["base_fee", "per_1000_grt"] },
  external_pilotage_tariffs: { label: "Liman Dışı Kılavuzluk", feeFields: ["grt_up_to_1000", "per_additional_1000_grt"] },
  berthing_tariffs: { label: "Barınma Ücretleri", feeFields: ["intl_foreign_flag", "intl_turkish_flag", "cabotage_turkish"] },
  agency_fees: { label: "Acentelik Ücretleri", feeFields: ["fee"] },
  marpol_tariffs: { label: "MARPOL Atık Ücretleri", feeFields: ["fixed_fee", "weekday_ek1_rate", "weekday_ek4_rate", "weekday_ek5_rate"] },
  port_authority_fees: { label: "Liman Resmi Ücretleri", feeFields: ["amount"] },
  lcb_tariffs: { label: "LCB Tarifeleri", feeFields: ["amount"] },
  tonnage_tariffs: { label: "Tonaj Tarifeleri", feeFields: ["ithalat", "ihracat"] },
  other_services: { label: "Diğer Hizmetler", feeFields: ["fee"] },
  cargo_handling_tariffs: { label: "Yükleme/Boşaltma", feeFields: ["rate"] },
  light_dues: { label: "Light Dues", feeFields: ["rate_up_to_800", "rate_above_800"] },
  chamber_of_shipping_fees: { label: "Chamber of Shipping Fee", feeFields: ["fee"] },
  chamber_freight_share: { label: "Chamber of Shipping Share on Freight", feeFields: ["fee"] },
  harbour_master_dues: { label: "Harbour Master Dues", feeFields: ["fee"] },
  sanitary_dues: { label: "Sanitary Dues", feeFields: ["nrt_rate"] },
  vts_fees: { label: "VTS Fee", feeFields: ["fee"] },
  supervision_fees: { label: "Supervision Fee", feeFields: ["rate"] },
  misc_expenses: { label: "Miscellaneous Expenses", feeFields: ["fee_usd"] },
};

router.get("/admin/tariffs/summary", isAuthenticated, async (req: any, res) => {
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

router.get("/admin/tariffs/:table", isAuthenticated, async (req: any, res) => {
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

router.post("/admin/tariffs/:table", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    const body = { ...req.body };
    delete body.id;
    body.updated_at = new Date().toISOString();

    const keys = Object.keys(body).filter(k => body[k] !== undefined);
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

router.patch("/admin/tariffs/:table/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const userRow = await storage.getUser(userId);
    if ((userRow as any)?.userRole !== "admin") return res.status(403).json({ message: "Forbidden" });
    const tbl = req.params.table;
    if (!ALLOWED_TARIFF_TABLES[tbl]) return res.status(400).json({ message: "Invalid table" });

    const body = { ...req.body };
    delete body.id;
    body.updated_at = new Date().toISOString();

    const keys = Object.keys(body).filter(k => body[k] !== undefined);
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

router.delete("/admin/tariffs/:table/clear", isAuthenticated, async (req: any, res) => {
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

router.delete("/admin/tariffs/:table/:id", isAuthenticated, async (req: any, res) => {
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

router.post("/admin/tariffs/:table/bulk-increase", isAuthenticated, async (req: any, res) => {
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
    const feeFields = ALLOWED_TARIFF_TABLES[tbl].feeFields;
    const multiplier = 1 + percent / 100;
    const sets = feeFields.map(f => `"${f}" = ROUND(COALESCE("${f}", 0) * ${multiplier}, 2)`).join(", ");
    const idList = ids.map(Number).join(",");
    await pool.query(`UPDATE ${tbl} SET ${sets}, updated_at = NOW() WHERE id IN (${idList})`);
    res.json({ success: true, affected: ids.length });
  } catch (err) {
    console.error("Bulk increase error:", err);
    res.status(500).json({ message: "Failed to apply bulk increase" });
  }
});

router.post("/admin/tariffs/:table/bulk-copy-year", isAuthenticated, async (req: any, res) => {
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

    const colResult = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name NOT IN ('id','updated_at') ORDER BY ordinal_position`,
      [tbl]
    );
    const cols = colResult.rows.map((r: any) => r.column_name);
    const colStr = cols.map((c: string) => c === "valid_year" ? `${parseInt(String(targetYear))}` : `"${c}"`).join(", ");
    const idList = ids.map(Number).join(",");
    await pool.query(`INSERT INTO ${tbl} (${cols.map((c: string) => `"${c}"`).join(", ")}) SELECT ${colStr} FROM ${tbl} WHERE id IN (${idList})`);
    res.json({ success: true, copied: ids.length });
  } catch (err) {
    console.error("Bulk copy year error:", err);
    res.status(500).json({ message: "Failed to copy tariffs to year" });
  }
});

// ── Custom Tariff Sections ──────────────────────────────────────────────────
const checkAdmin = async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  const userRow = await storage.getUser(userId);
  if ((userRow as any)?.userRole !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }
  return true;
};

router.get("/admin/tariff-custom-sections", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    const result = await pool.query("SELECT * FROM custom_tariff_sections ORDER BY sort_order, id");
    res.json(result.rows);
  } catch (err) {
    console.error("Custom sections list error:", err);
    res.status(500).json({ message: "Failed to fetch custom sections" });
  }
});

router.post("/admin/tariff-custom-sections", isAuthenticated, async (req: any, res) => {
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

router.delete("/admin/tariff-custom-sections/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!await checkAdmin(req, res)) return;
    await pool.query("DELETE FROM custom_tariff_sections WHERE id = $1", [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error("Custom section delete error:", err);
    res.status(500).json({ message: "Failed to delete custom section" });
  }
});

router.get("/admin/tariff-custom-sections/:id/entries", isAuthenticated, async (req: any, res) => {
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

router.post("/admin/tariff-custom-sections/:id/entries", isAuthenticated, async (req: any, res) => {
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

router.patch("/admin/tariff-custom-sections/:id/entries/:entryId", isAuthenticated, async (req: any, res) => {
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

router.delete("/admin/tariff-custom-sections/:id/entries/:entryId", isAuthenticated, async (req: any, res) => {
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

// ─── AUDIT LOGS (Admin only) ─────────────────────────────────────────────────

router.get("/admin/audit-logs", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { userId, action, entityType, from, to } = req.query;
    const { page, limit } = parsePaginationParams(req.query);

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
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit); query += ` OFFSET $${params.length}`;
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
    const total = parseInt(countResult.rows[0].count);

    res.json({ data: result.rows, pagination: buildPaginationMeta(page, limit, total) });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

router.get("/admin/cache-stats", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    res.json(cache.stats());
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cache stats" });
  }
});

router.post("/admin/cache-clear", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    cache.clear();
    res.json({ success: true, message: "Cache cleared successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear cache" });
  }
});

// ─── USER DETAIL ──────────────────────────────────────────────────────────
router.get("/admin/users/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const allUsers = await storage.getAllUsers();
    const user = allUsers.find((u: any) => u.id === req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { rows: orgRows } = await pool.query(
      `SELECT o.id, o.name, o.type, om.role FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.is_active = true LIMIT 5`, [req.params.id]
    );
    const { rows: proformaRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM proformas WHERE user_id = $1`, [req.params.id]
    );
    const { rows: voyageRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM voyages WHERE user_id = $1`, [req.params.id]
    );
    res.json({
      ...user,
      organizations: orgRows,
      proformaCount: parseInt(proformaRows[0]?.count || "0"),
      voyageCount: parseInt(voyageRows[0]?.count || "0"),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user detail" });
  }
});

// ─── USER BAN ─────────────────────────────────────────────────────────────
router.patch("/admin/users/:id/ban", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { banned, reason } = req.body;
    const adminId = req.user?.claims?.sub || req.user?.id;
    await db.execute(drizzleSql`UPDATE users SET is_suspended = ${!!banned} WHERE id = ${req.params.id}`);
    logAction(adminId, banned ? "ban" : "unban", "user", req.params.id, { reason }, "");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update ban status" });
  }
});

// ─── ORGANIZATION MANAGEMENT ──────────────────────────────────────────────
router.get("/admin/organizations", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const search = (req.query.search as string || "").toLowerCase();
    const { rows } = await pool.query(`
      SELECT o.*, 
        COUNT(DISTINCT om.user_id) AS member_count,
        COUNT(DISTINCT v.id) AS voyage_count,
        u.first_name || ' ' || u.last_name AS owner_name,
        u.email AS owner_email
      FROM organizations o
      LEFT JOIN organization_members om ON om.organization_id = o.id AND om.is_active = true
      LEFT JOIN voyages v ON v.organization_id = o.id
      LEFT JOIN users u ON u.id = o.owner_id
      GROUP BY o.id, u.first_name, u.last_name, u.email
      ORDER BY o.created_at DESC
    `);
    const filtered = search
      ? rows.filter((r: any) => r.name?.toLowerCase().includes(search) || r.owner_email?.toLowerCase().includes(search))
      : rows;
    res.json(filtered);
  } catch (error) {
    console.error("[admin/organizations]", error);
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
});

router.get("/admin/organizations/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { rows: [org] } = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [req.params.id]);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    const { rows: members } = await pool.query(`
      SELECT om.*, u.first_name, u.last_name, u.email, u.user_role
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = $1 AND om.is_active = true
    `, [req.params.id]);
    const { rows: [stats] } = await pool.query(`
      SELECT COUNT(DISTINCT v.id) AS voyage_count, COUNT(DISTINCT p.id) AS proforma_count
      FROM organizations o
      LEFT JOIN voyages v ON v.organization_id = o.id
      LEFT JOIN proformas p ON p.organization_id = o.id
      WHERE o.id = $1
    `, [req.params.id]);
    res.json({ ...org, members, stats });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organization detail" });
  }
});

router.patch("/admin/organizations/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { name, type, website, email, phone } = req.body;
    await pool.query(
      `UPDATE organizations SET name = COALESCE($1, name), type = COALESCE($2, type), website = COALESCE($3, website), email = COALESCE($4, email), phone = COALESCE($5, phone) WHERE id = $6`,
      [name, type, website, email, phone, req.params.id]
    );
    const { rows: [updated] } = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update organization" });
  }
});

router.patch("/admin/organizations/:id/plan", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { plan, maxMembers } = req.body;
    const validPlans = ["free", "standard", "unlimited"];
    if (plan && !validPlans.includes(plan)) return res.status(400).json({ message: "Invalid plan" });
    const adminId = req.user?.claims?.sub || req.user?.id;
    await pool.query(
      `UPDATE organizations SET subscription_plan = COALESCE($1, subscription_plan), max_members = COALESCE($2, max_members) WHERE id = $3`,
      [plan, maxMembers, req.params.id]
    );
    logAction(adminId, "update", "organization", req.params.id, { plan, maxMembers }, "");
    const { rows: [updated] } = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update organization plan" });
  }
});

router.delete("/admin/organizations/:id", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const adminId = req.user?.claims?.sub || req.user?.id;
    await pool.query(`UPDATE users SET active_organization_id = NULL WHERE active_organization_id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [req.params.id]);
    logAction(adminId, "delete", "organization", req.params.id, {}, "");
    res.json({ success: true });
  } catch (error) {
    console.error("[admin/delete-org]", error);
    res.status(500).json({ message: "Failed to delete organization" });
  }
});

// ─── OVERVIEW STATS ───────────────────────────────────────────────────────
router.get("/admin/stats/overview", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const [usersRes, orgsRes, voyagesRes, proformasRes, fixturesRes, tendersRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS weekly_new, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS monthly_new FROM users`),
      pool.query(`SELECT COUNT(*) AS count FROM organizations`),
      pool.query(`SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE status IN ('active','in_progress','planned')) AS active FROM voyages`),
      pool.query(`SELECT COUNT(*) AS count FROM proformas`),
      pool.query(`SELECT COUNT(*) AS count FROM fixtures WHERE status NOT IN ('cancelled','completed')`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) AS count FROM port_tenders WHERE status = 'open'`),
    ]);

    const roleRes = await pool.query(`
      SELECT user_role, COUNT(*) AS count FROM users GROUP BY user_role ORDER BY count DESC
    `);

    const growthRes = await pool.query(`
      SELECT DATE_TRUNC('day', created_at)::date AS date, COUNT(*) AS count
      FROM users WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `);

    res.json({
      totalUsers: parseInt(usersRes.rows[0]?.count || "0"),
      weeklyNewUsers: parseInt(usersRes.rows[0]?.weekly_new || "0"),
      monthlyNewUsers: parseInt(usersRes.rows[0]?.monthly_new || "0"),
      totalOrgs: parseInt(orgsRes.rows[0]?.count || "0"),
      totalVoyages: parseInt(voyagesRes.rows[0]?.count || "0"),
      activeVoyages: parseInt(voyagesRes.rows[0]?.active || "0"),
      totalProformas: parseInt(proformasRes.rows[0]?.count || "0"),
      activeFixtures: parseInt(fixturesRes.rows[0]?.count || "0"),
      openTenders: parseInt(tendersRes.rows[0]?.count || "0"),
      roleDistribution: roleRes.rows.map((r: any) => ({ role: r.user_role, count: parseInt(r.count) })),
      userGrowth: growthRes.rows.map((r: any) => ({ date: r.date, count: parseInt(r.count) })),
    });
  } catch (error) {
    console.error("[admin/stats/overview]", error);
    res.status(500).json({ message: "Failed to fetch overview stats" });
  }
});

// ─── SYSTEM ACTIONS ───────────────────────────────────────────────────────
router.post("/admin/exchange-rates/refresh", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { getOrFetchRates } = await import("../exchange-rates");
    await getOrFetchRates(true);
    res.json({ success: true, message: "Exchange rates refreshed" });
  } catch (error) {
    console.error("[admin/exchange-rates/refresh]", error);
    res.status(500).json({ message: "Failed to refresh exchange rates" });
  }
});

router.post("/admin/benchmarks/recalculate", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { calculateBenchmarks } = await import("../benchmark-calculator");
    await calculateBenchmarks();
    res.json({ success: true, message: "Benchmarks recalculated" });
  } catch (error) {
    console.error("[admin/benchmarks/recalculate]", error);
    res.status(500).json({ message: "Failed to recalculate benchmarks" });
  }
});

// ─── DEMO SESSIONS ────────────────────────────────────────────────────────
router.get("/admin/demo-sessions", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { listDemoSessions } = await import("../demo-session");
    res.json(listDemoSessions());
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch demo sessions" });
  }
});

router.delete("/admin/demo-sessions/cleanup", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const { cleanExpiredDemoSessions } = await import("../demo-session");
    const cleaned = cleanExpiredDemoSessions();
    res.json({ success: true, cleaned });
  } catch (error) {
    res.status(500).json({ message: "Failed to cleanup demo sessions" });
  }
});

export default router;
