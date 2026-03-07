import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";

const router = Router();

router.get("/overview", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.userRole === "admin";
    const role = (user as any)?.activeRole || user?.userRole;

    const periodMonths = parseInt(req.query.period as string) || 6;
    const from = req.query.from as string;
    const to = req.query.to as string;

    let sinceStr: string;
    let toStr: string = new Date().toISOString();
    let since: Date = new Date();

    if (from && to) {
      since = new Date(from);
      sinceStr = since.toISOString();
      toStr = new Date(to).toISOString();
    } else {
      since.setMonth(since.getMonth() - periodMonths);
      sinceStr = since.toISOString();
    }

    const userFilter = isAdmin ? sql`1=1` : sql`user_id = ${userId}`;
    const agentFilter = isAdmin
      ? sql`1=1`
      : sql`(user_id = ${userId} OR agent_user_id = ${userId})`;

    const dateFilter = sql`created_at >= ${sinceStr}::timestamptz AND created_at <= ${toStr}::timestamptz`;
    const voyageDateFilter = sql`v.created_at >= ${sinceStr}::timestamptz AND v.created_at <= ${toStr}::timestamptz`;

    // For Trend Arrows, we need previous period data
    let prevSinceStr: string;
    let prevToStr: string = sinceStr;

    if (from && to) {
      const duration = new Date(to).getTime() - new Date(from).getTime();
      prevSinceStr = new Date(since.getTime() - duration).toISOString();
    } else {
      const prevSince = new Date(since);
      prevSince.setMonth(prevSince.getMonth() - periodMonths);
      prevSinceStr = prevSince.toISOString();
    }

    const prevDateFilter = sql`created_at >= ${prevSinceStr}::timestamptz AND created_at <= ${prevToStr}::timestamptz`;

    const [kpiRows, prevKpiRows] = await Promise.all([
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM voyages WHERE ${agentFilter} AND ${dateFilter})::int AS total_voyages,
          (SELECT COALESCE(SUM(total_usd),0) FROM proformas WHERE ${userFilter} AND ${dateFilter})::real AS total_pda_usd,
          (SELECT COALESCE(AVG(ABS(total_actual_usd - total_estimated_usd) / NULLIF(total_estimated_usd,0) * 100), 0) FROM fda_accounts WHERE ${userFilter} AND status = 'approved' AND ${dateFilter})::real AS avg_fda_variance,
          (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE ${userFilter} AND status = 'paid' AND ${dateFilter})::real AS invoices_paid,
          (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE ${userFilter} AND status != 'paid' AND ${dateFilter})::real AS invoices_pending
      `),
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM voyages WHERE ${agentFilter} AND ${prevDateFilter})::int AS total_voyages,
          (SELECT COALESCE(SUM(total_usd),0) FROM proformas WHERE ${userFilter} AND ${prevDateFilter})::real AS total_pda_usd,
          (SELECT COALESCE(AVG(ABS(total_actual_usd - total_estimated_usd) / NULLIF(total_estimated_usd,0) * 100), 0) FROM fda_accounts WHERE ${userFilter} AND status = 'approved' AND ${prevDateFilter})::real AS avg_fda_variance,
          (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE ${userFilter} AND status = 'paid' AND ${prevDateFilter})::real AS invoices_paid,
          (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE ${userFilter} AND status != 'paid' AND ${prevDateFilter})::real AS invoices_pending
      `)
    ]);

    const kpiData = (kpiRows as any).rows?.[0] ?? (kpiRows as any)[0] ?? {};
    const prevKpiData = (prevKpiRows as any).rows?.[0] ?? (prevKpiRows as any)[0] ?? {};

    const monthlyVoyages = await db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
             DATE_TRUNC('month', created_at) AS month_date,
             COUNT(*)::int AS count
      FROM voyages
      WHERE ${agentFilter} AND ${dateFilter}
      GROUP BY month_date, month
      ORDER BY month_date ASC
    `);

    const monthlyInvoices = await db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
             DATE_TRUNC('month', created_at) AS month_date,
             COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0)::real AS paid,
             COALESCE(SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END), 0)::real AS pending
      FROM invoices
      WHERE ${userFilter} AND ${dateFilter}
      GROUP BY month_date, month
      ORDER BY month_date ASC
    `);

    const agentFilterV = isAdmin
      ? sql`1=1`
      : sql`(v.user_id = ${userId} OR v.agent_user_id = ${userId})`;

    const topPorts = await db.execute(sql`
      SELECT p.name AS port_name, COUNT(*)::int AS count
      FROM voyages v
      JOIN ports p ON p.id = v.port_id
      WHERE ${agentFilterV} AND ${voyageDateFilter}
      GROUP BY p.name
      ORDER BY count DESC
      LIMIT 8
    `);

    const invoiceStatus = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::real AS total
      FROM invoices
      WHERE ${userFilter} AND ${dateFilter}
      GROUP BY status
    `);

    const voyageStatus = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count
      FROM voyages
      WHERE ${agentFilter} AND ${dateFilter}
      GROUP BY status
    `);

    const vesselActivity = (role === "shipowner" || isAdmin) ? await db.execute(sql`
      SELECT vessel_name, COUNT(*)::int AS voyage_count
      FROM voyages
      WHERE ${agentFilter} AND vessel_name IS NOT NULL AND ${dateFilter}
      GROUP BY vessel_name
      ORDER BY voyage_count DESC
      LIMIT 8
    `) : null;

    const toRows = (r: any) => r.rows ?? r;

    res.json({
      kpis: {
        totalVoyages: parseInt(kpiData.total_voyages) || 0,
        totalPdaValueUsd: parseFloat(kpiData.total_pda_usd) || 0,
        avgFdaVariancePct: parseFloat(kpiData.avg_fda_variance) || 0,
        totalInvoicesPaid: parseFloat(kpiData.invoices_paid) || 0,
        totalInvoicesPending: parseFloat(kpiData.invoices_pending) || 0,
      },
      previousKpis: {
        totalVoyages: parseInt(prevKpiData.total_voyages) || 0,
        totalPdaValueUsd: parseFloat(prevKpiData.total_pda_usd) || 0,
        avgFdaVariancePct: parseFloat(prevKpiData.avg_fda_variance) || 0,
        totalInvoicesPaid: parseFloat(prevKpiData.invoices_paid) || 0,
        totalInvoicesPending: parseFloat(prevKpiData.invoices_pending) || 0,
      },
      monthlyVoyages: toRows(monthlyVoyages).map((r: any) => ({ month: r.month, count: r.count })),
      monthlyInvoiceRevenue: toRows(monthlyInvoices).map((r: any) => ({ month: r.month, paid: r.paid, pending: r.pending })),
      topPorts: toRows(topPorts).map((r: any) => ({ portName: r.port_name, count: r.count })),
      invoiceStatusBreakdown: toRows(invoiceStatus).map((r: any) => ({ status: r.status, count: r.count, total: r.total })),
      voyageStatusBreakdown: toRows(voyageStatus).map((r: any) => ({ status: r.status, count: r.count })),
      vesselActivity: vesselActivity ? toRows(vesselActivity).map((r: any) => ({ vesselName: r.vessel_name, voyageCount: r.voyage_count })) : [],
    });
  } catch (err: any) {
    console.error("[analytics] Error:", err?.message);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});

router.get("/vessel-comparison", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.userRole === "admin";

    const from = req.query.from as string;
    const to = req.query.to as string;
    let dateFilter = sql`1=1`;
    if (from && to) {
      dateFilter = sql`v.created_at >= ${new Date(from).toISOString()}::timestamptz AND v.created_at <= ${new Date(to).toISOString()}::timestamptz`;
    }

    const agentFilterV = isAdmin
      ? sql`1=1`
      : sql`(v.user_id = ${userId} OR v.agent_user_id = ${userId})`;

    const vesselStats = await db.execute(sql`
      SELECT 
        v.vessel_name,
        COUNT(*)::int AS voyage_count,
        COALESCE(SUM(fda.total_actual_usd), 0)::real AS total_fda,
        COALESCE(SUM(p.total_usd), 0)::real AS total_pda,
        (COALESCE(SUM(fda.total_actual_usd), 0) - COALESCE(SUM(p.total_usd), 0))::real AS net_balance
      FROM voyages v
      LEFT JOIN fda_accounts fda ON fda.voyage_id = v.id AND fda.status = 'approved'
      LEFT JOIN proformas p ON p.voyage_id = v.id
      WHERE ${agentFilterV} AND v.vessel_name IS NOT NULL AND ${dateFilter}
      GROUP BY v.vessel_name
      ORDER BY voyage_count DESC
    `);

    res.json((vesselStats.rows || vesselStats).map((r: any) => ({
      vesselName: r.vessel_name,
      voyageCount: r.voyage_count,
      totalFDA: r.total_fda,
      totalPDA: r.total_pda,
      netBalance: r.net_balance
    })));
  } catch (err: any) {
    console.error("[vessel-comparison] Error:", err?.message);
    res.status(500).json({ message: "Failed to load vessel comparison" });
  }
});

router.get("/port-comparison", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.userRole === "admin";

    const from = req.query.from as string;
    const to = req.query.to as string;
    let dateFilter = sql`1=1`;
    if (from && to) {
      dateFilter = sql`v.created_at >= ${new Date(from).toISOString()}::timestamptz AND v.created_at <= ${new Date(to).toISOString()}::timestamptz`;
    }

    const agentFilterV = isAdmin
      ? sql`1=1`
      : sql`(v.user_id = ${userId} OR v.agent_user_id = ${userId})`;

    const portStats = await db.execute(sql`
      SELECT 
        p.name AS port_name,
        COUNT(*)::int AS voyage_count,
        COALESCE(AVG(fda.total_actual_usd), 0)::real AS avg_expenses,
        COALESCE(AVG(EXTRACT(EPOCH FROM (v.completed_at - v.created_at)) / 86400), 0)::real AS avg_turnaround_days
      FROM voyages v
      JOIN ports p ON p.id = v.port_id
      LEFT JOIN fda_accounts fda ON fda.voyage_id = v.id AND fda.status = 'approved'
      WHERE ${agentFilterV} AND ${dateFilter}
      GROUP BY p.name
      ORDER BY voyage_count DESC
      LIMIT 10
    `);

    res.json((portStats.rows || portStats).map((r: any) => ({
      portName: r.port_name,
      voyageCount: r.voyage_count,
      avgExpenses: r.avg_expenses,
      avgTurnaroundDays: r.avg_turnaround_days
    })));
  } catch (err: any) {
    console.error("[port-comparison] Error:", err?.message);
    res.status(500).json({ message: "Failed to load port comparison" });
  }
});

export default router;
