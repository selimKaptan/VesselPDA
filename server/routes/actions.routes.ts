import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { sql, and, eq, lt, isNull } from "drizzle-orm";
import { storage } from "../storage";
import { 
  invoices, 
  vessels, 
  vesselCertificates, 
  daAdvances, 
  voyages, 
  proformas, 
  serviceRequests,
  portExpenses,
  fdaAccounts,
  ports
} from "@shared/schema";

const router = Router();

router.get("/pending", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.userRole === "admin";
    const role = (user as any)?.activeRole || user?.userRole;
    
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Filter helpers
    const userFilter = isAdmin ? sql`true` : eq(invoices.createdByUserId, userId);
    
    // 1. Overdue Invoices (Critical)
    const overdueInvoices = await db.select()
      .from(invoices)
      .where(and(
        userFilter,
        eq(invoices.status, "pending"),
        lt(invoices.dueDate, now)
      ));

    // 2. Expiring Certificates (Critical/Warning)
    // We need to join with vessels to get vesselName
    const expiringCertificates = await db.select({
      id: vesselCertificates.id,
      vesselId: vesselCertificates.vesselId,
      vesselName: vessels.name,
      certType: vesselCertificates.certType,
      expiresAt: vesselCertificates.expiresAt,
    })
    .from(vesselCertificates)
    .innerJoin(vessels, eq(vessels.id, vesselCertificates.vesselId))
    .where(and(
      isAdmin ? sql`true` : eq(vesselCertificates.userId, userId),
      lt(vesselCertificates.expiresAt, thirtyDaysFromNow)
    ));

    // 3. Pending DA Advances (Warning)
    const pendingDaAdvances = await db.select()
      .from(daAdvances)
      .where(and(
        isAdmin ? sql`true` : eq(daAdvances.userId, userId),
        eq(daAdvances.status, "requested")
      ));

    // 4. Voyages Needing FDA (Warning)
    // Voyages that are completed but don't have an FDA account yet
    const voyagesNeedingFda = await db.select({
      id: voyages.id,
      vesselName: voyages.vesselName,
      portName: ports.name,
      eta: voyages.eta
    })
    .from(voyages)
    .leftJoin(fdaAccounts, eq(fdaAccounts.voyageId, voyages.id))
    .leftJoin(ports, eq(ports.id, voyages.portId))
    .where(and(
      isAdmin ? sql`true` : eq(voyages.userId, userId),
      eq(voyages.status, "completed"),
      isNull(fdaAccounts.id)
    ));

    // 5. Pending Proforma Approvals (Info/Warning for Shipowner)
    const pendingProformaApprovals = (role === 'shipowner' || isAdmin) ? await db.select()
      .from(proformas)
      .where(and(
        isAdmin ? sql`true` : eq(proformas.userId, userId),
        eq(proformas.status, "sent")
      )) : [];

    // 6. Open Service Requests (Info)
    const openServiceRequests = await db.select({
      id: serviceRequests.id,
      serviceType: serviceRequests.serviceType,
      vesselName: serviceRequests.vesselName,
      offersCount: sql`(SELECT count(*) FROM service_offers WHERE service_request_id = ${serviceRequests.id})`
    })
    .from(serviceRequests)
    .where(and(
      isAdmin ? sql`true` : eq(serviceRequests.requesterId, userId),
      eq(serviceRequests.status, "open")
    ));

    // 7. Unlinked Port Expenses (Warning)
    const unlinkedPortExpensesRaw = await db.select({
      voyageId: portExpenses.voyageId,
      count: sql`count(*)`,
      total: sql`sum(amount_usd)`
    })
    .from(portExpenses)
    .where(and(
      isAdmin ? sql`true` : eq(portExpenses.userId, userId),
      isNull(portExpenses.fdaId)
    ))
    .groupBy(portExpenses.voyageId);

    const counts = {
      critical: overdueInvoices.length + expiringCertificates.filter(c => c.expiresAt && new Date(c.expiresAt) < now).length,
      warning: pendingDaAdvances.length + voyagesNeedingFda.length + unlinkedPortExpensesRaw.length,
      info: pendingProformaApprovals.length + openServiceRequests.length,
      total: 0
    };
    counts.total = counts.critical + counts.warning + counts.info;

    res.json({
      overdueInvoices,
      expiringCertificates: expiringCertificates.map(c => ({
        ...c,
        daysLeft: c.expiresAt ? Math.ceil((new Date(c.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
      })),
      pendingDaAdvances,
      voyagesNeedingFda,
      pendingProformaApprovals,
      openServiceRequests,
      unlinkedPortExpenses: unlinkedPortExpensesRaw,
      counts
    });
  } catch (err: any) {
    console.error("[actions] Error:", err?.message);
    res.status(500).json({ message: "Failed to load pending actions" });
  }
});

export default router;
