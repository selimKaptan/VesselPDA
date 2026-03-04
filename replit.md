# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry. Key capabilities include proforma generation, a robust maritime company directory, and customizable company profiles for various stakeholders. The business vision is to become the leading digital hub for maritime professionals, significantly reducing administrative overhead and increasing operational efficiency across the global shipping sector.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack, featuring a maritime-themed UI/UX with a deep blue color palette and English as the sole UI language.

**Technical Implementations:**
- **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI.
- **Backend**: Express.js with PostgreSQL (Drizzle ORM for general data, raw SQL for specific modules like audit logs, tariff management, and organization data).
- **Authentication**: Custom email/password authentication with session-based management and `bcryptjs`.
- **Core Features**:
    - **User & Role Management**: Role-based access (Admin, Shipowner/Broker, Ship Agent, Service Provider).
    - **Vessel & Port Management**: CRUD for vessels and Turkish port data, including LOCODE lookup.
    - **Proforma Generation**: Formula-based calculation engine, PDF export, quick estimates, IMO lookup, hazardous cargo calculations.
    - **Company Profiles & Directory**: Customizable profiles, searchable directory, and a Trust & Verification System.
    - **Subscription System**: 3-tier model with usage tracking.
    - **Vessel Tracking**: Interactive Mapbox GL JS map with live AIS data for Turkish waters.
    - **Port Call Tender System**: Tender creation, bid submission, nomination, and automated voyage creation.
    - **Multi-Port Voyage Management**: Manages port calls with a chronological status lifecycle (planned, approaching, at_anchor, berthed, operations, completed, skipped).
    - **Statement of Facts (SOF)**: Chronological port event logging per port call with default templates, duration calculations, and PDF export.
    - **Voyage Expense Tracking**: Per-voyage cost tracking with budget vs actual comparison, category-based expenses, and USD conversion.
    - **Voyage Management**: Comprehensive system with checklists, service requests, and status lifecycle.
    - **Service Request System**: For posting and fulfilling service requests.
    - **Forum/Discussion Board**: Collaborative communication.
    - **Document Management**: Voyage-based file upload system.
    - **Mutual Assessment**: User rating system.
    - **Direct Messaging & Notification System**: Real-time communication and in-app notifications.
    - **Internationalization**: TR/EN language toggle.
    - **Admin Panel**: Comprehensive user management, KPI dashboard, content management, and audit logging.
    - **Audit Log System**: Asynchronous, non-blocking logging for critical actions.
    - **Vessel Certificate Management**: Tracking and status visualization.
    - **Port Call Appointment Management**: Management panel for appointments.
    - **Fixture & Recap System**: Charter negotiation and tracking, including a Laytime & Demurrage Calculator.
    - **Cargo & Position Board**: Platform for maritime advertisements.
    - **Market Data**: Displays Baltic Dry/Tanker Indices and port-specific bunker prices.
    - **AI Assistant**: Floating chat panel for context-aware assistance.
    - **Vessel Crew Management**: CRUD for crew members with document uploads.
    - **Tariff Management System**: Admin page for managing Turkish port tariffs and rules.
    - **Organization Dashboard**: Admin panel for organization admins with member management, role-based permissions, and activity logs.
    - **Team Chat**: Real-time messaging for organization members using Socket.io.
    - **Organization & Team System**: Multi-tenant infrastructure with robust role-based access control and activity logging.
    - **Maritime Document Workflow System**: Structured document creation from templates with status workflow, auto-fill, and PDF export.
    - **Automated Reminder System**: Cron-based and manual reminders for various maritime events and deadlines.
    - **Email Inbox System**: Inbound email capture, AI classification, and workflow automation. DB tables: `inbound_emails` (user_id, from_email, to_email, subject, body_text, body_html, is_processed, processed_action, attachments JSONB, ai_classification, ai_extracted_data JSONB, ai_suggestion, linked_voyage_id), `email_forwarding_rules` (user_id, forwarding_email UNIQUE, rule_type, linked_voyage_id, is_active). Forwarding address format: `{org-slug}-{random5}@inbound.vesselpda.app`. AI classification (Anthropic Claude Haiku): nomination/sof_update/da_proforma/fixture_recap/crew_change/bunker_inquiry/port_clearance/general + extracts vessel, port, ETA, cargo data. API: `POST /api/email/inbound` (webhook), `POST /api/email/inbound/manual` (testing), `GET /api/email/inbox`, `GET /api/email/inbox/count`, CRUD `/api/email/forwarding-rules`, process/dismiss/link-voyage endpoints, `GET /api/voyages/:id/emails`, push subscription infrastructure. Frontend: `/email-inbox` two-panel page, Settings "Email Inbox & Forwarding" card, Voyage detail "Email" tab, Sidebar "Email Inbox" item with unread badge. Migration: `server/migrate-email-inbound.ts`.
    - **Compliance Management**: ISM Code, ISPS Code, MLC 2006, MARPOL, SOLAS compliance tracking. DB tables: `compliance_checklists` (vessel_id, org_id, user_id, standard_code, standard_name, total_items, completed_items, compliance_percentage, status, last/next_audit_date, auditor_name), `compliance_items` (checklist_id, section_number, section_title, requirement, is_compliant, evidence, finding_type, corrective_action, corrective_action_due_date, corrective_action_status), `compliance_audits` (checklist_id, audit_type, auditor_name, audit_date, findings JSONB, overall_result, next_audit_date). Template data: ISM 40 items (13 sections), ISPS 13 items, MLC 18 items. Migration: `server/migrate-compliance.ts`. API: GET/POST `/api/compliance/checklists`, GET/PATCH `/api/compliance/checklists/:id`, PATCH `/api/compliance/items/:itemId`, POST/GET `/api/compliance/checklists/:id/audits`, GET `/api/compliance/dashboard`, `/api/compliance/vessels/:vesselId/status`, `/api/compliance/expiring`. Frontend: `/compliance` page (overview cards, upcoming audits, checklist grid), `/compliance/:checklistId` (section accordion, item checkboxes, evidence+finding+CA editing, audit recording). Sidebar: Operations → "Compliance" (ShieldCheck). Dashboard: compliance widget banner when findings or upcoming audits exist. Reminder engine: compliance_audit (30d) and corrective_action (14d) auto-checks.
    - **Port Cost Benchmarking**: Anonymized historical proforma data comparison for port costs, including statistical aggregates and visual representations.
- **Security**: Helmet Content-Security-Policy headers.

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