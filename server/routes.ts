import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { registerProformaApprovalRoutes } from "./proforma-approval";
import { requireRole } from "./middleware/role-guard";
import { attachOrgContext } from "./middleware/org-context";
import { apiLimiter, authLimiter } from "./routes/shared";

// Prefix-specific modules (paths stripped inside router)
import vesselRoutes from "./routes/vessel.routes";
import proformaRoutes from "./routes/proforma.routes";
import companyRoutes from "./routes/company.routes";
import adminRoutes from "./routes/admin.routes";
import forumRoutes from "./routes/forum.routes";
import tenderRoutes from "./routes/tender.routes";
import voyageRoutes from "./routes/voyage.routes";
import serviceRequestRoutes from "./routes/service-request.routes";
import nominationRoutes from "./routes/nomination.routes";
import marketRoutes from "./routes/market.routes";
import sofRoutes from "./routes/sof.routes";
import actionRoutes from "./routes/actions.routes";
import fdaRoutes from "./routes/fda.routes";
import fdaMappingRoutes from "./routes/fda-mapping.routes";
import daComparisonRoutes from "./routes/da-comparison.routes";
import aiRoutes from "./routes/ai.routes";
import norRoutes from "./routes/nor.routes";
import vesselScheduleRoutes from "./routes/vessel-schedule.routes";
import vesselLookupRoutes from "./routes/vessel-lookup.routes";
import { orgRouter, inviteRouter } from "./routes/organization.routes";
import { voyageInviteRouter } from "./routes/voyage-invite.routes";
import demoRouter from "./routes/demo.routes";

// Root-mounted modules (full /api/... paths preserved inside router)
import authRoutes from "./routes/auth.routes";
import portRoutes from "./routes/port.routes";
import paymentRoutes from "./routes/payment.routes";
import directoryRoutes from "./routes/directory.routes";
import trackingRoutes from "./routes/tracking.routes";
import notificationRoutes from "./routes/notification.routes";
import messageRoutes from "./routes/message.routes";
import commercialRoutes from "./routes/commercial.routes";
import miscRoutes from "./routes/misc.routes";
import searchRoutes from "./routes/search.routes";
import q88Routes from "./routes/q88.routes";
import laytimeRoutes from "./routes/laytime.routes";
import daAdvanceRoutes from "./routes/da-advance.routes";
import analyticsRoutes from "./routes/analytics.routes";
import portExpenseRoutes from "./routes/port-expense.routes";
import voyageReportRoutes from "./routes/voyage-report.routes";
import commissionRoutes from "./routes/commission.routes";
import voyageNotesRoutes from "./routes/voyage-notes.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import pmsRoutes from "./routes/pms.routes";
import bunkerRoutes from "./routes/bunker.routes";
import noonReportRoutes from "./routes/noon-report.routes";
import charterPartyRoutes from "./routes/charter-party.routes";
import crewRoutes from "./routes/crew.routes";
import crewParseRoutes from "./routes/crew-parse.routes";
import portCallRoutes from "./routes/port-call.routes";
import husbandryRoutes from "./routes/husbandry.routes";
import agentReportRoutes from "./routes/agent-report.routes";
import environmentalRoutes from "./routes/environmental.routes";
import insuranceRoutes from "./routes/insurance.routes";
import drydockRoutes from "./routes/drydock.routes";
import defectRoutes from "./routes/defect.routes";
import sparePartsRoutes from "./routes/spare-parts.routes";
import voyageEstimationRoutes from "./routes/voyage-estimation.routes";
import passagePlanRoutes from "./routes/passage-plan.routes";
import crewDocConfigRoutes from "./routes/crew-doc-config.routes";
import orderBookRoutes from "./routes/order-book.routes";
import brokerCommissionRoutes from "./routes/broker-commission.routes";
import brokerContactsRoutes from "./routes/broker-contacts.routes";
import cargoOpsRoutes from "./routes/cargo-operations.routes";
import cargoParseRoutes from "./routes/cargo-parse.routes";
import portCallChecklistRoutes from "./routes/port-call-checklist.routes";
import portCallParticipantsRoutes from "./routes/port-call-participants.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import configRoutes from "./routes/config.routes";
import datalasticRoutes from "./routes/datalastic.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

  // Rate limiters (apply to all /api/* regardless of version)
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/", apiLimiter);
  app.use("/api/", attachOrgContext);

  registerAuthRoutes(app);
  registerProformaApprovalRoutes(app);
  // Serve uploaded files
  const express = (await import("express")).default;
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // ─── Root-mounted routes (full /api/... paths inside; no version prefix) ─────
  // These handle their own paths first, before the backward-compat redirect.
  app.use(authRoutes);        // /api/demo/login, /api/files/upload, /api/user/role
  app.use(portRoutes);        // /api/ports, /api/port-info, /api/exchange-rates, /api/service-ports
  app.use(paymentRoutes);     // /api/payment/*, /api/subscription/*
  app.use(directoryRoutes);   // /api/directory, /api/trust-score, /api/reviews, etc.
  app.use(trackingRoutes);    // /api/vessel-track/*, /api/vessel-positions/*
  app.use(datalasticRoutes);  // /api/datalastic/*, /api/admin/datalastic-usage
  app.use(notificationRoutes); // /api/notifications/*, /api/feedback
  app.use(messageRoutes);     // /api/messages/*, /api/conversations/*
  app.use(commercialRoutes);  // /api/fixtures, /api/laytime, /api/cargo-positions
  app.use(miscRoutes);        // /api/invoices, /api/document-templates, /api/port-alerts, /api/certificates
  app.use(searchRoutes);      // /api/search
  app.use("/api", q88Routes); // /api/vessels/:id/q88, /api/q88/public/:id
  app.use("/api/config", configRoutes); // /api/config/mapbox
  app.use(commissionRoutes);
  app.use(voyageNotesRoutes);
  app.use(fdaMappingRoutes);
  app.use(demoRouter);

  // ─── Backward-compatibility redirect: /api/X → /api/v1/X ────────────────────
  // Runs after root-mounted routes (those have already responded or passed).
  // Only rewrites paths NOT already starting with /v1 or /health.
  app.use("/api", (req: any, res: any, next: any) => {
    if (req.path.startsWith("/v1")) return next();
    if (req.path === "/health") return next();
    req.url = `/v1${req.url}`;
    next();
  });

  // ─── Role guards for versioned routes ────────────────────────────────────────
  app.use("/api/v1/admin", isAuthenticated, requireRole("admin"));
  app.use("/api/v1/fixtures", isAuthenticated, requireRole("shipowner", "broker", "admin"));
  app.use("/api/v1/service-offers", isAuthenticated, requireRole("provider", "admin"));

  // ─── Prefix-mounted routes at /api/v1/ ───────────────────────────────────────
  app.use("/api/v1/vessels", vesselRoutes);
  app.use("/api/v1/proformas", proformaRoutes);
  app.use("/api/v1/company-profile", companyRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/forum", forumRoutes);
  app.use("/api/v1/tenders", tenderRoutes);
  app.use("/api/v1/voyages", voyageRoutes);
  app.use("/api/v1/voyage-reports", voyageReportRoutes);
  app.use("/api/v1/service-requests", serviceRequestRoutes);
  app.use("/api/v1/nominations", nominationRoutes);
  app.use("/api/v1/market", marketRoutes);
  app.use("/api/v1/sof", sofRoutes);
  app.use("/api/v1/actions", actionRoutes);
  app.use("/api/v1/fda", fdaRoutes);
  app.use("/api/v1/da-comparison", daComparisonRoutes);
  app.use("/api/v1/nor", norRoutes);
  app.use("/api/v1/ai", aiRoutes);
  app.use("/api/v1/vessel-schedule", vesselScheduleRoutes);
  app.use("/api/v1/port-expenses", portExpenseRoutes);
  app.use("/api/v1/organizations", orgRouter);
  app.use("/api/v1/invites", inviteRouter);
  app.use("/api/v1", voyageInviteRouter);

  app.use("/api/v1/laytime-sheets", laytimeRoutes);
  app.use("/api/v1/da-advances", daAdvanceRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/maintenance", maintenanceRoutes);
  app.use("/api/v1/pms", pmsRoutes);
  app.use("/api/v1/bunker", bunkerRoutes);
  app.use("/api/v1/noon-reports", noonReportRoutes);
  app.use("/api/v1/charter-parties", charterPartyRoutes);
  app.use("/api/v1/crew", crewRoutes);
  app.use("/api/v1/crew", crewParseRoutes);
  app.use("/api/v1/port-calls", portCallRoutes);
  app.use("/api/v1/husbandry", husbandryRoutes);
  app.use("/api/v1/agent-report", agentReportRoutes);
  app.use("/api/v1/environmental", environmentalRoutes);
  app.use("/api/v1/insurance", insuranceRoutes);
  app.use("/api/v1/drydock", drydockRoutes);
  app.use("/api/v1", defectRoutes);
  app.use("/api/v1/spare-parts", sparePartsRoutes);

  // ─── Sprint 9: Broker Modules ─────────────────────────────────────────────
  app.use("/api/v1/voyage-estimations", isAuthenticated, voyageEstimationRoutes);
  app.use("/api/v1/passage-plans", isAuthenticated, passagePlanRoutes);
  app.use("/api/v1/crew-doc-config", isAuthenticated, crewDocConfigRoutes);
  app.use("/api/v1/order-book", isAuthenticated, orderBookRoutes);
  app.use("/api/v1/broker-commissions", isAuthenticated, brokerCommissionRoutes);
  app.use("/api/v1/broker-contacts", isAuthenticated, brokerContactsRoutes);

  // ─── Sprint 11: Agent Modules ─────────────────────────────────────────────
  app.use("/api/v1/cargo-operations", isAuthenticated, cargoOpsRoutes);
  app.use("/api/v1/cargo", cargoParseRoutes);
  app.use("/api/v1/port-call-checklists", isAuthenticated, portCallChecklistRoutes);
  app.use("/api/v1/port-call-participants", isAuthenticated, portCallParticipantsRoutes);
  app.use("/api/v1/dashboard", isAuthenticated, dashboardRoutes);
  app.use("/api/v1/vessel-lookup", isAuthenticated, vesselLookupRoutes);

  return httpServer;
}
