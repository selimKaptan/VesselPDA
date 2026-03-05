import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: [
    "sessions", "users", "company_profiles", "company_members", "company_invitations",
    "agent_reviews", "audit_logs", "bunker_prices", "cargo_positions",
    "chamber_of_shipping_fees", "conversations", "direct_nominations",
    "document_templates", "endorsements", "exchange_rates", "fda_accounts",
    "feedbacks", "fixtures", "fleets", "fleet_vessels", "forum_categories",
    "forum_dislikes", "forum_likes", "forum_replies", "forum_topics",
    "invoices", "laytime_calculations", "light_dues", "messages",
    "notice_of_readiness", "notifications", "organization_invites",
    "organization_members", "organizations", "port_alerts",
    "port_call_appointments", "ports", "port_tenders", "proforma_approval_logs",
    "proformas", "sanctions_checks", "service_offers", "service_requests",
    "sof_line_items", "statement_of_facts", "tariff_categories", "tariff_rates",
    "tender_bids", "vessel_certificates", "vessel_crew", "vessel_positions",
    "vessel_q88", "vessels", "vessel_watchlist", "voyage_activities",
    "voyage_chat_messages", "voyage_checklists", "voyage_collaborators",
    "voyage_documents", "voyage_reviews", "voyages",
    "pilotage_tariffs", "external_pilotage_tariffs", "agency_fees",
    "marpol_tariffs", "lcb_tariffs", "tonnage_tariffs", "cargo_handling_tariffs",
    "berthing_tariffs", "supervision_fees", "custom_tariff_sections",
    "custom_tariff_entries", "misc_expenses", "chamber_freight_share",
    "harbour_master_dues", "sanitary_dues", "vts_fees",
    "port_authority_fees", "other_services",
    "ai_analysis_history",
    "voyage_cargo_logs",
  ],
});
