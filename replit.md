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
- **Core Features**:
    - **User & Role Management**: A 5-role system (`shipowner`, `agent`, `broker`, `provider`, `admin`) with distinct dashboards and role-based navigation.
    - **Vessel & Port Management**: CRUD operations for vessels and management of Turkish port data.
    - **Proforma Generation**: Formula-based calculation engine for instant disbursement accounts, including PDF export and quick estimates based on live exchange rates.
    - **Company Profiles & Directory**: Customizable profiles for maritime companies and a searchable directory with a Trust & Verification System.
    - **Subscription System**: A 3-tier model (Free, Standard, Unlimited) with usage tracking.
    - **Vessel Tracking**: Interactive Mapbox GL JS map with live AIS data for Turkish waters, including AIS position history.
    - **Port Call Tender System**: Facilitates tender creation, bid submission, and voyage initiation.
    - **Voyage Management**: Comprehensive system for managing voyages, checklists, and service requests.
    - **Service Request System**: Enables posting and fulfilling service requests.
    - **Forum/Discussion Board**: A platform for collaborative communication.
    - **Document Management**: Voyage-based file upload system.
    - **Mutual Assessment**: Rating system for shipowners/agents.
    - **Direct Messaging**: Private messaging system with real-time updates.
    - **Notification System**: Real-time in-app notifications.
    - **Internationalization**: TR/EN language toggle (defaulting to English).
    - **Dark Mode**: Full dark/light mode toggle.
    - **Navigation System**: Top-bar layout with role-based module tabs and a left-side panel for sub-pages.
    - **Admin User Management**: Comprehensive admin panel for user CRUD, KPIs, content management, announcements, financial overview, reports, system settings, and audit logs.
    - **Audit Log System**: Records user actions and system events for accountability.
    - **Vessel Certificate Management**: Tracking and status visualization for vessel certificates.
    - **Port Call Appointment Management**: Panel for managing port call appointments.
    - **Fixture & Recap System**: System for charter negotiation and fixture tracking, with an integrated Laytime & Demurrage Calculator.
    - **Cargo & Position Board**: Platform for "cargo looking" or "vessel looking" ads.
    - **Market Data**: Displays Baltic Dry/Tanker Indices and port-specific bunker prices.
    - **AI Assistant**: Floating chat panel powered by Claude-Haiku for context-aware assistance.
    - **Vessel Crew Management**: CRUD for crew members with document upload and expiry warnings.
    - **Tariff Management System**: Admin page for managing Turkish port tariffs across various categories with inline editing, bulk updates, CSV export/import, and official vessel categories. Includes global tariffs and specific calculations for supervision fees and miscellaneous expenses.
    - **DB-Connected Quick Estimate**: Instant proforma calculations linked to database tariff tables, supporting IMO search and dangerous goods surcharges.
    - **Server-Side Cache Layer**: 4-tier in-memory cache (`server/cache.ts` via `node-cache`): short=1m, medium=5m, long=1h, daily=24h. Applied to ports list, forum categories, document templates, bunker prices, directory featured, public stats, admin stats, tariffs summary, and exchange rates. Cache invalidation is wired to all mutation handlers. Admin panel exposes `GET /api/admin/cache-stats` and `POST /api/admin/cache-clear` with a live stats card under System Settings.
    - **File System Storage**: New uploads are saved to `uploads/{category}/` on disk (bids, documents, certificates, crew, proformas, logos) instead of base64 in the DB. Old base64 records in DB remain untouched (backward compatible). Static files served via `/uploads/*`.
    - **Statement of Facts (SOF) Module**: Full CRUD for SOF documents linked to voyages/vessels/ports. Auto-generates 13 standard port call events on creation, supports custom events with date/time, remarks, and deductible-from-laytime flagging. Finalize locks the SOF read-only. PDF export via PDFKit. Tables: `statement_of_facts`, `sof_line_items`.
    - **Final Disbursement Account (FDA) Module**: CRUD for FDA records comparing proforma estimated costs against actual port costs. Supports creating from a PDA/Proforma (auto-imports line items) or blank. Inline editing of actual amounts with auto-calculated variance (color-coded red/green). Approve workflow locks FDA read-only. PDF export via PDFKit. "Create FDA" button on proforma detail page. Tables: `fda_accounts`. Routes: `/fda`, `/fda/:id`.
- **Security**: Helmet Content-Security-Policy headers are configured.

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