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
    const since = new Date();
    since.setMonth(since.getMonth() - periodMonths);
    const sinceStr = since.toISOString();

    const userFilter = isAdmin ? sql`1=1` : sql`user_id = ${userId}`;
    const agentFilter = isAdmin
      ? sql`1=1`
      : sql`(user_id = ${userId} OR agent_user_id = ${userId})`;

    const [kpiRows] = await Promise.all([
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM voyages WHERE ${agentFilter} AND created_at >= ${sinceStr}::timestamptz)::int AS total_voyages,
          (SELECT COALESCE(SUM(total_usd),0) FROM proformas WHERE ${userFilter} AND created_at >= ${sinceStr}::timestamptz)::real AS total_pda_usd,
          (SELECT COALESCE(AVG(ABS(total_actual_usd - total_estimated_usd) / NULLIF(total_estimated_usd,0) * 100), 0) FROM fda_accounts WHERE ${userFilter} AND status = 'approved' AND created_at >= ${sinceStr}::timestamptz)::real AS avg_fda_variance,
          (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE ${userFilter} AND status = 'paid' AND created_at >= ${sinceStr}::timestamptz)::real AS invoices_paid,
          (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE ${userFilter} AND status != 'paid' AND created_at >= ${sinceStr}::timestamptz)::real AS invoices_pending
      `)
    ]);

    const kpiData = (kpiRows as any).rows?.[0] ?? (kpiRows as any)[0] ?? {};

    const monthlyVoyages = await db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
             DATE_TRUNC('month', created_at) AS month_date,
             COUNT(*)::int AS count
      FROM voyages
      WHERE ${agentFilter} AND created_at >= ${sinceStr}::timestamptz
      GROUP BY month_date, month
      ORDER BY month_date ASC
    `);

    const monthlyInvoices = await db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
             DATE_TRUNC('month', created_at) AS month_date,
             COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0)::real AS paid,
             COALESCE(SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END), 0)::real AS pending
      FROM invoices
      WHERE ${userFilter} AND created_at >= ${sinceStr}::timestamptz
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
      WHERE ${agentFilterV} AND v.created_at >= ${sinceStr}::timestamptz
      GROUP BY p.name
      ORDER BY count DESC
      LIMIT 8
    `);

    const invoiceStatus = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::real AS total
      FROM invoices
      WHERE ${userFilter} AND created_at >= ${sinceStr}::timestamptz
      GROUP BY status
    `);

    const voyageStatus = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count
      FROM voyages
      WHERE ${agentFilter} AND created_at >= ${sinceStr}::timestamptz
      GROUP BY status
    `);

    const vesselActivity = (role === "shipowner" || isAdmin) ? await db.execute(sql`
      SELECT vessel_name, COUNT(*)::int AS voyage_count
      FROM voyages
      WHERE ${agentFilter} AND vessel_name IS NOT NULL AND created_at >= ${sinceStr}::timestamptz
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

export default router;
