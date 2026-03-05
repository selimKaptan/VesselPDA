# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry, ultimately becoming the leading digital hub for maritime professionals.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack, featuring a maritime-themed UI/UX with a deep blue color palette.

**Technical Implementations:**
- **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI.
- **Backend**: Express.js with PostgreSQL and Drizzle ORM.
- **Authentication**: Custom email/password authentication with email verification and session management.
- **Core Features**: User & Role Management (5-role system), Vessel & Port Management, Proforma Generation (formula-based, PDF export, live exchange rates), Company Profiles & Directory (Trust & Verification), Subscription System (3-tier), Vessel Tracking (Mapbox GL JS with live AIS), Port Call Tender System, Voyage Management, Service Request System, Forum/Discussion Board, Document Management, Mutual Assessment, Direct Messaging, Notification System, Internationalization (TR/EN), Dark Mode, Navigation System (Icon Rail + Expandable Panel), Admin User Management, Audit Log System, Vessel Certificate Management, Port Call Appointment Management, Fixture & Recap System (Laytime & Demurrage Calculator), Cargo & Position Board, Market Data, AI Assistant, Vessel Crew Management, Tariff Management System, DB-Connected Quick Estimate, Organization & Team Management, Server-Side Cache Layer (4-tier in-memory), File System Storage (uploads to disk), Statement of Facts (SOF) Module (CRUD, PDF export), Final Disbursement Account (FDA) Module (CRUD, PDF export, variance calculation), DA Comparison Report Module (variance analysis, PDF export), Vessel Schedule Calendar (Month, Timeline, List views), Voyage Invitation System (participant management, role-based permissions), Onboarding Wizard (5-step for new users), Mobile Responsiveness (full support, bottom nav bar), Demo Account System (server-side seeding on registration via /register?demo=true), Q88 Vessel Questionnaire Module (10-tab form, auto-fill from vessel data, PDF export, email sharing, public access, vessel list badges), Glassmorphism Design System (all floating UI components), PDF Export System (Proforma/SOF/FDA — shared header/footer with company logo embed + company info + bank details; `server/proforma-pdf.ts` exports `addPdfHeader`/`addPdfFooter` for reuse), Company Profile Bank Details (6 fields: bankName, bankAccountName, bankIban, bankSwift, bankCurrency, bankBranchName stored in DB; PATCH /api/company-profile/bank-details endpoint; "Load from Company Profile" button in proforma-new; server auto-fills bank on POST /api/proformas).
- **Demo System**: Users access demo via `/register?demo=true`. Registration with `isDemo: true` in body triggers server-side seeding (5 vessels, 5 proformas, 5 voyages, 3 SOFs, 2 FDAs, 5 invoices, 3 fixtures, 4 cargo positions, 2 NORs, checklists, notifications). Users are immediately logged in (no email verification) and redirected to dashboard. `users` table has `demo_seeded` and `is_demo_account` boolean columns. Seed logic in `server/demo-seed.ts`, route in `server/routes/demo.routes.ts`.
- **Security**: Helmet Content-Security-Policy headers configured.
- **Schema Integrity**: `shared/schema.ts` fully aligned with production DB — 24 tables corrected from `generatedAlwaysAsIdentity()` to `serial()` to match actual DB sequences; `organization_members.role_id` orphan column registered in schema (no FK reference); 18 production tariff tables added to schema (`pilotage_tariffs`, `external_pilotage_tariffs`, `agency_fees`, `marpol_tariffs`, `lcb_tariffs`, `tonnage_tariffs`, `cargo_handling_tariffs`, `berthing_tariffs`, `supervision_fees`, `custom_tariff_sections`, `custom_tariff_entries`, `misc_expenses`, `chamber_freight_share`, `harbour_master_dues`, `sanitary_dues`, `vts_fees`, `port_authority_fees`, `other_services`); `port_authority_fees` production columns fully matched (added `fee_name`, `fee_no`, `min`, `max`, `size_min`, `size_max`, `unit`, `multiplier_rule`); `drizzle.config.ts` has `tablesFilter` listing all 80 managed tables. Deployment schema drift issue fully resolved.

## External Dependencies
- **PostgreSQL**: Primary database.
- **bcryptjs**: For password hashing.
- **AISStream.io**: For live AIS vessel tracking data.
- **RapidAPI (Zyla Labs Vessel Information API)**: For detailed vessel information.
- **Turkish Central Bank (TCMB)**: For live exchange rates.
- **Resend**: Transactional email service.
- **jsPDF + html2canvas**: For client-side PDF generation.
- **Mapbox GL JS**: For interactive maps.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: CSS framework.
- **Shadcn UI**: UI component library.
- **Recharts**: Charting library.
- **Anthropic AI**: For the AI Assistant (Claude-Haiku).
- **Yahoo Finance API**: For market data indices (BDI, BCTI, BDTI).