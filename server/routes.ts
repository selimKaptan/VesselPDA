import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { startAISStream } from "./ais-stream";
import { registerProformaApprovalRoutes } from "./proforma-approval";
import { requireRole } from "./middleware/role-guard";
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
import bunkerRoutes from "./routes/bunker.routes";
import noonReportRoutes from "./routes/noon-report.routes";
import charterPartyRoutes from "./routes/charter-party.routes";
import crewRoutes from "./routes/crew.routes";
import portCallRoutes from "./routes/port-call.routes";
import husbandryRoutes from "./routes/husbandry.routes";
import agentReportRoutes from "./routes/agent-report.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/", apiLimiter);

  registerAuthRoutes(app);
  registerProformaApprovalRoutes(app);
  startAISStream();

  // Role guards
  app.use("/api/admin", isAuthenticated, requireRole("admin"));
  app.use("/api/fixtures", isAuthenticated, requireRole("shipowner", "broker", "admin"));
  app.use("/api/service-offers", isAuthenticated, requireRole("provider", "admin"));

  // Serve uploaded files
  const express = (await import("express")).default;
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // ─── Root-mounted (full /api/... paths inside) ────────────────────────────
  app.use(authRoutes);        // /api/demo/login, /api/files/upload, /api/user/role
  app.use(portRoutes);        // /api/ports, /api/port-info, /api/exchange-rates, /api/service-ports
  app.use(paymentRoutes);     // /api/payment/*, /api/subscription/*
  app.use(directoryRoutes);   // /api/directory, /api/trust-score, /api/reviews, etc.
  app.use(trackingRoutes);    // /api/vessel-track/*, /api/vessel-positions/*
  app.use(notificationRoutes); // /api/notifications/*, /api/feedback
  app.use(messageRoutes);     // /api/messages/*, /api/conversations/*
  app.use(commercialRoutes);  // /api/fixtures, /api/laytime, /api/cargo-positions
  app.use(miscRoutes);        // /api/invoices, /api/document-templates, /api/port-alerts, /api/certificates
  app.use(searchRoutes);      // /api/search
  app.use("/api", q88Routes); // /api/vessels/:id/q88, /api/q88/public/:id

  // ─── Prefix-mounted (paths stripped inside router) ────────────────────────
  app.use("/api/vessels", vesselRoutes);
  app.use("/api/proformas", proformaRoutes);
  app.use("/api/company-profile", companyRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/forum", forumRoutes);
  app.use("/api/tenders", tenderRoutes);
  app.use("/api/voyages", voyageRoutes);
  app.use(commissionRoutes);
  app.use(voyageNotesRoutes);
  app.use("/api/voyage-reports", voyageReportRoutes);
  app.use("/api/service-requests", serviceRequestRoutes);
  app.use("/api/nominations", nominationRoutes);
  app.use("/api/market", marketRoutes);
  app.use("/api/sof", sofRoutes);
  app.use("/api/actions", actionRoutes);
  app.use("/api/fda", fdaRoutes);
  app.use(fdaMappingRoutes);
  app.use("/api/da-comparison", daComparisonRoutes);
  app.use("/api/nor", norRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/vessel-schedule", vesselScheduleRoutes);
  app.use("/api/port-expenses", portExpenseRoutes);
  app.use("/api/organizations", orgRouter);
  app.use("/api/invites", inviteRouter);
  app.use("/api", voyageInviteRouter);
  app.use(demoRouter);

  app.use("/api/laytime-sheets", laytimeRoutes);
  app.use("/api/da-advances", daAdvanceRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/maintenance", maintenanceRoutes);
  app.use("/api/bunker", bunkerRoutes);
  app.use("/api/noon-reports", noonReportRoutes);
  app.use("/api/charter-parties", charterPartyRoutes);
  app.use("/api/crew", crewRoutes);
  app.use("/api/port-calls", portCallRoutes);
  app.use("/api/husbandry", husbandryRoutes);
  app.use("/api/agent-report", agentReportRoutes);

  return httpServer;
}
