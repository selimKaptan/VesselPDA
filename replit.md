# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry. Key capabilities include proforma generation, a robust maritime company directory, and customizable company profiles for various stakeholders. The business vision is to become the leading digital hub for maritime professionals, significantly reducing administrative overhead and increasing operational efficiency across the global shipping sector.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack. The UI/UX is maritime-themed, predominantly using a deep blue color palette with design tokens for a professional aesthetic. English is the primary and only UI language.

**Technical Implementations:**
- **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI.
- **Backend**: Express.js with PostgreSQL (managed via Drizzle ORM) for most data, and raw SQL for specific modules like audit logs, tariff management, and organization data.
- **Storage Layer**: Modularized database operations using a `DatabaseStorage` class.
- **Authentication**: Custom email/password authentication with verification, session-based authentication, and `bcryptjs` for password hashing.
- **Core Features**:
    - **User & Role Management**: Role-based access (Admin, Shipowner/Broker, Ship Agent, Service Provider) with distinct dashboards.
    - **Vessel & Port Management**: CRUD for vessels and Turkish port data, including LOCODE lookup.
    - **Proforma Generation**: Formula-based calculation engine, PDF export, quick estimates based on live exchange rates and DB-connected tariffs. Includes IMO lookup and hazardous cargo calculations.
    - **Company Profiles & Directory**: Customizable profiles, searchable directory, and a Trust & Verification System (sanction checks, endorsements).
    - **Subscription System**: 3-tier model with usage tracking.
    - **Vessel Tracking**: Interactive Mapbox GL JS map with live AIS data for Turkish waters, including AIS Position History.
    - **Port Call Tender System**: Facilitates tender creation, bid submission, nomination, and automated voyage creation.
    - **Multi-Port Voyage Management**: Port calls (`voyage_port_calls` table) with chronological route — status lifecycle (planned→approaching→at_anchor→berthed→operations→completed→skipped), per-port cargo/berth/agent info, route summary auto-updates `voyages.load_port`. API: GET/POST/PATCH/DELETE `/api/voyages/:id/port-calls`, status endpoint `/api/voyages/:id/port-calls/:pcId/status`. UI: "Route" tab in voyage-detail with step indicators, status dropdowns, add/edit/delete dialogs.
    - **SOF (Statement of Facts)**: Chronological port event log per port call. DB tables: `sof_events` (id, port_call_id, voyage_id, event_code, event_name, event_time, remarks, is_official, recorded_by_user_id, organization_id), `sof_templates` (id, name, port_call_type, events JSONB, is_default). 3 default templates auto-seeded: Standard Loading SOF (14 events), Standard Discharge SOF (14 events), Bunkering SOF (9 events). 25 standard event codes across arrival/operations/departure/interruption groups. Interruption events (rain=blue, breakdown=yellow, others=orange) visually distinguished. Duration calculations: NOR→Berth, Berth→Start ops, Operations time, Total port time. PDF export via jsPDF. Component: `client/src/components/sof-editor.tsx`. Integration: expandable SOF panel under each port call card in voyage-detail Route tab. API: GET/POST/DELETE `/api/voyages/:voyageId/port-calls/:portCallId/sof`, PATCH `/api/sof-events/:id`, GET/POST `/api/sof-templates`, POST `.../sof/from-template`. Migration: `server/migrate-sof.ts`.
    - **Voyage Expense Tracking**: Per-voyage cost tracking with budget vs actual comparison. DB tables: `voyage_expenses` (id, voyage_id, port_call_id, user_id, organization_id, category, description, budget_amount, actual_amount, currency, exchange_rate, amount_usd, vendor, invoice_number, invoice_date, receipt_file_url, payment_status, paid_at, notes), `voyage_budgets` (id, voyage_id, category, budget_amount, currency, notes, UNIQUE(voyage_id, category)). 12 categories: port_charges, agency_fee, pilotage, tugboat, mooring, bunker, provisions, crew, repairs, insurance, communication, misc. Summary API with category-level budget vs actual variance. Exchange-rate aware USD conversion. Port-call grouping for multi-port voyages. Bar chart (recharts) for visual comparison. Accordion category table. Budget editor dialog. Add/edit/delete expense dialog with payment status tracking. Component: `client/src/components/voyage-expenses-tab.tsx`. "Expenses" tab in voyage-detail. API: GET/POST/PATCH/DELETE `/api/voyages/:id/expenses`, GET `/api/voyages/:id/expenses/summary`, GET/POST `/api/voyages/:id/budgets`. Migration: `server/migrate-voyage-expenses.ts`.
    - **Voyage Management**: Comprehensive system with checklists, linked service requests, and status lifecycle.
    - **Service Request System**: For posting and fulfilling service requests with offer management.
    - **Forum/Discussion Board**: Collaborative communication platform.
    - **Document Management**: Voyage-based file upload system.
    - **Mutual Assessment**: Rating system for users after voyages.
    - **Direct Messaging & Notification System**: Real-time private messaging and in-app notifications.
    - **Internationalization**: Full TR/EN language toggle with English fallback.
    - **UI/UX**: Dark mode, mobile navigation (sheet-based hamburger menu).
    - **Admin Panel**: Comprehensive user management, KPI dashboard, content management, announcements, financial overview, reports, system settings, bunker prices, port alerts, and a detailed Audit Log.
    - **Audit Log System**: Asynchronous, non-blocking logging for critical user actions.
    - **Vessel Certificate Management**: Tracking and status visualization.
    - **Port Call Appointment Management**: Management panel for appointments.
    - **Fixture & Recap System**: Charter negotiation and tracking, including an integrated Laytime & Demurrage Calculator.
    - **Cargo & Position Board**: Platform for "cargo looking" or "vessel looking" ads.
    - **Market Data**: Displays Baltic Dry/Tanker Indices and port-specific bunker prices.
    - **AI Assistant**: Floating chat panel providing context-aware assistance.
    - **Vessel Crew Management**: CRUD for crew members with document uploads and expiry warnings.
    - **Tariff Management System**: Admin page for managing Turkish port tariffs across various categories and ports, including global tariffs and specific rules for supervision fees, agency fees, and miscellaneous expenses.
    - **Organization Dashboard**: Comprehensive admin panel at `/organization-dashboard` for org admins. 5 tabs: Overview (stat cards: members/vessels/voyages/proformas/invoices + 30-day area chart + recent activity), Members (table, invite by email, edit role/department, remove), Roles (CRUD with 13-module × 6-action permissions matrix), Activity (paginated filterable log with CSV export), Settings (org details editing + danger zone delete). Sidebar shows "Company Panel" link for all org members. New endpoints: `GET /:id/dashboard-stats`, `GET /:id/activity-chart`, `GET/:id/roles`, `POST/:id/roles`, `PATCH/:id/roles/:roleId`, `DELETE/:id/roles/:roleId`. Default roles (Admin/Member/Viewer) auto-created on org creation.
    - **Team Chat**: Real-time messaging for organization members. DB tables: `team_channels` (id, org_id, name, description, channel_type public/private, created_by_user_id), `team_channel_members` (channel_id + user_id PK for private channels), `team_messages` (id, channel_id, sender_id, content, message_type, file_url, is_edited, reply_to_id). Socket.io events: `join_channel`, `leave_channel`, `team_message`, `team_typing`, `team_typing_stop`, `join_org`, `channel_created`. Endpoints at `/api/organizations/:orgId/channels` (CRUD), `/api/organizations/:orgId/channels/:channelId/messages` (paginated, GET/POST), `/api/team-messages/:id` (PATCH/DELETE). Auto-creates "General" channel on org creation. Frontend: `/team-chat` page with left channel panel (public/private groups) + right message stream. Features: reply-to-message, message edit/delete, typing indicator, new channel dialog. Route registered in App.tsx; Sidebar "Team Chat" item under Communication group.
    - **Organization & Team System**: Multi-tenant organization infrastructure. DB tables: `organizations`, `organization_members` (with optional `role_id` FK to custom roles), `organization_invites`, `organization_roles` (JSONB permissions per module), `organization_activity_feed` (action log). `users.active_organization_id`. 13-module permission grid (vessels, voyages, proformas, invoices, tenders, documents, messages, fixtures, crew, certificates, reports, settings, members). Auto-creates 3 default roles on org creation (Admin/isOwnerRole, Member/isDefault, Viewer). All 14 main tables have nullable `organization_id` FK (vessels, proformas, voyages, portTenders, tenderBids, serviceRequests, invoices, fixtures, cargoPositions, conversations, directNominations, vesselCertificates, vesselCrew, fleets). Storage methods are org-context aware: `getVesselsByUser`, `getProformasByUser`, `getVoyagesByUser`, `getFixtures`, `getInvoicesByUser` all accept optional `organizationId`. Routes: `server/routes/organizations.ts` at `/api/organizations` — CRUD, member management, role CRUD (/:id/roles), invites, switch, activity feed (/:id/activity). Middleware: `server/middleware/org-context.ts` (`attachOrgContext`) sets `req.organizationId`; `server/middleware/permissions.ts` (`checkPermission(module, action)`) validates JSONB role permissions. Activity: `server/utils/orgActivity.ts` (`logOrgActivity()` non-blocking). All schema changes via raw SQL (NOT db:push) to avoid tariff table rename conflicts.
    - **Maritime Document Workflow System**: Structured maritime document creation from templates with status workflow. DB tables: `maritime_doc_templates` (id, name, code UNIQUE, category, description, fields JSONB, is_built_in), `maritime_documents` (id, template_id, voyage_id, port_call_id, user_id, organization_id, document_number, data JSONB, status, reviewed_by_user_id, signed_by_user_id, signed_at, signature_text, version, parent_id). 7 built-in templates: Bill of Lading (BL), Cargo Manifest, Mate's Receipt, Crew List (with table field type), Customs Declaration, Port Clearance, Damage Report. Status workflow: draft → pending_review → approved → signed (+ void). Field types: text, number, date, select, textarea, table (editable grid). Auto-fill from voyage data (vesselName, loadPort, dischargePort, imoNumber). PDF export via jsPDF with A4 format, company header, field rendering, signature block. Version history via parent_id FK chain. API: GET/POST `/api/maritime-doc-templates`, POST/GET `/api/voyages/:id/maritime-docs`, GET/PATCH `/api/maritime-docs/:id`, PATCH `/api/maritime-docs/:id/status`, POST `/api/maritime-docs/:id/sign`, POST `/api/maritime-docs/:id/new-version`, GET `/api/maritime-docs/:id/versions`. Component: `client/src/components/maritime-doc-editor.tsx`. Page: `/maritime-docs/:id` (`maritime-doc-view.tsx`). Voyage detail "Documents" tab extended with "Standard Maritime Documents" section (template cards + created docs list). Migration: `server/migrate-maritime-docs.ts`.
- **Security**: Helmet Content-Security-Policy headers configured.

## External Dependencies
- **PostgreSQL**: Primary database.
- **bcryptjs**: Password hashing.
- **AISStream.io**: Live AIS vessel tracking data.
- **RapidAPI (Zyla Labs Vessel Information API)**: Detailed vessel information.
- **Turkish Central Bank (TCMB)**: Live exchange rates.
- **Resend**: Transactional email service.
- **jsPDF + html2canvas**: Client-side PDF generation.
- **Mapbox GL JS**: Interactive maps.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: CSS framework.
- **Shadcn UI**: UI component library.
- **Recharts**: Charting library.
- **Anthropic AI**: AI Assistant (Claude-Haiku).
- **Yahoo Finance API**: Market data indices (BDI, BCTI, BDTI).