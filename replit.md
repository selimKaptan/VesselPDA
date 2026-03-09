# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry, ultimately becoming the leading digital hub for maritime professionals.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack, featuring a maritime-themed UI/UX with a deep blue color palette and a Glassmorphism Design System.

**Technical Implementations:**
-   **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI for a responsive interface.
-   **Backend**: Express.js with PostgreSQL and Drizzle ORM.
-   **Authentication**: Custom email/password authentication with verification and session management.
-   **User & Role Management**: A six-role system (Shipowner, Agent, Broker, Provider, Master, Admin) with granular permissions.
-   **Core Maritime Operations**: Tools for managing vessel data, port information, port calls, voyages, and proforma disbursement accounts (with PDF export and live exchange rates).
-   **Financial Management**: Modules for Final Disbursement Accounts (FDA) with variance calculation, invoice management, DA Advance/Fund Request, Laytime Calculator, Port Expense Ledger, Invoice Partial Payment Tracking, and FDA→Port Expense Reconciliation. Agent Commission Module and Voyage Financial Report PDF export are included.
-   **Company & Service Management**: Verified company profiles and a comprehensive directory of maritime service providers.
-   **Subscription System**: A 3-tier subscription model with feature gating.
-   **Vessel Tracking**: Live AIS vessel tracking and Noon Reports for performance. Mapbox dark map with vessel markers. CSP updated to allow Mapbox API domains (api.mapbox.com, events.mapbox.com). **Datalastic Integration**: Full Datalastic maritime API service layer (`server/datalastic.ts`) with vessel finder (IMO/MMSI search — name search not supported by API), live position, historical track, port call history, and PSC inspections. Uses `https://api.datalastic.com/api/v0` with `Authorization: Bearer` header. Vessel-track page has Datalastic geçmiş rota toggle (violet 🛰 button in history panel). Defect tracker PSC tab has Datalastic import modal. Vessels page Add Vessel dialog has Datalastic finder search (IMO/MMSI) with auto-fill. `/api/vessels/lookup?imo=` uses Datalastic first, falls back to VESSEL_API_KEY (Zyla Labs) if network fails. **Datalastic helper functions**: `isDatalasticConfigured()` returns true when API key set; `getVesselPosition({imo?, mmsi?})` wraps `findVessel()` for single-vessel lookup; `getVesselBulk(imoList)` for bulk (may not be available on all plans); `getVesselsInPort({portUnlocode, lat, lon, radius})` for port traffic. Fleet endpoint uses individual `getVesselPosition()` calls per vessel (5 concurrent, gracefully falls back to mock if Datalastic returns 404). Search endpoint uses Datalastic fallback for IMO/MMSI when AIS returns no results. **Extended Datalastic endpoints** (`server/routes/datalastic.routes.ts`, mounted at root as `app.use(datalasticRoutes)`): `GET /api/datalastic/vessel-info/:imo`, `/vessel-pro/:id`, `/vessel-find`, `/vessel-engine/:imo`, `/vessel-ownership/:imo`, `/inspections/:imo`, `/classification/:imo`, `/drydock/:imo`, `/casualties/:imo`, `/demolitions/:imo`, `/port-find`, `/company`, `/route`. Admin: `GET /api/admin/datalastic-usage` returns in-memory `monthlyUsage` counter. All routes use `cached()` with appropriate tiers (short/long/daily). **Datalastic new functions in datalastic.ts**: `getVesselPositionPro`, `getVesselInfo`, `findVessels`, `getVesselHistory`, `getVesselsInRadius`, `findPorts`, `getVesselOwnership`, `getVesselInspections`, `getDryDockDates`, `getClassificationData`, `getVesselEngine`, `getMaritimeCompany`, `getShipCasualties`, `getRoute`, `getShipDemolitions`, `getDatalasticUsage()` (returns `{monthlyUsage, limit:20000, remaining}`). New API endpoints: `/api/vessels/finder`, `/api/vessels/live-position`, `/api/vessels/port-call-history`, `/api/vessels/:id/datalastic-inspections`, `/api/vessels/:id/datalastic-track`, `/api/vessel-track/datalastic-search`, `/api/vessel-track/datalastic-track`, `/api/vessel-track/position/:imo` (single vessel live position), `/api/vessel-track/port-traffic/:unlocode` (vessels near a port). `/api/vessel-track/fleet` now tries Datalastic bulk lookup for IMO-equipped vessels before falling back to mock data. **Mapbox Runtime Token**: passage-planning, port-info, vessels pages still use Mapbox; they fetch the token at runtime from `/api/config/mapbox` via `client/src/lib/mapbox-init.ts`. **Vessel Track Map**: `vessel-track.tsx` was migrated from Mapbox GL JS to **Leaflet + CartoDB dark tiles** (free, no API key). Uses `L.map()`, `L.tileLayer()` (CartoDB dark + OpenSeaMap), `L.divIcon` SVG ship markers, `L.polyline` for history track, `L.circleMarker` for history points. Status endpoint now returns `mode: "live"` when Datalastic API key is configured (not just AIS stream). **Vessel Track IMO Search**: Typing a 7-9 digit number (IMO/MMSI) in the map search bar falls back to Datalastic search if AIS returns no results — results appear with a satellite icon and "Datalastic Sonuçları" header. **DatalasticPanel in vessels.tsx**: On-demand fetch sections for Motor Bilgileri (engine), Klas Bilgileri (classification), PSC Denetimleri (inspections), Sahiplik Geçmişi (ownership), Havuz Geçmişi (drydock), Kaza Geçmişi (casualties) — each with a violet "Datalastic'ten Getir" trigger button, only active when vessel has IMO number.
-   **Communication & Collaboration**: Forum, direct messaging, and notification system.
-   **Document Management**: Capabilities for managing maritime documents, including a specialized Vessel Vault for statutory certificates with expiry tracking, multi-file upload, and renewal workflows.
-   **Assessment & Reporting**: Mutual assessment features, Statement of Facts (SOF) module, and DA comparison reports.
-   **AI Integration**: AI Smart Drop module for document analysis and event detection with human-in-the-loop verification.
-   **Specialized Modules**: Q88 Vessel Questionnaire, Berthing Fees, VTS Fees, and Harbour Master Dues calculation systems. Cargo Operations (loading/discharging tracking with status, B/L, hatch tracking), Crew Management enhancements (including hotel reservations), Planned Maintenance System (PMS), Bunker Management, Charter Party & TC Hire Management, Port Call Management with Checklist (14 arrival + 13 departure default items, custom items, progress tracking), Husbandry Services, Environmental Compliance (CII/EU ETS/IMO DCS), Insurance Management, Drydock Management, Defect & PSC Tracking, Spare Parts Inventory, Passage Planning (with Mapbox map: split layout, numbered waypoint markers, route lines, fitBounds zoom).
-   **Agent Reports Module**: Dedicated `/agent-reports` listing page showing all voyages with direct links to per-voyage Agent Report pages. Added to Operations nav. DB: uses existing voyages table.
-   **Port Call Hub (Sprint 12)**: Port Calls redesigned as the central operations hub. Each port call has a dedicated detail page (`/port-calls/:id`) with 6 tabs: Genel Bakış (overview + status timeline), NOR (embedded Notice of Readiness management with tender/accept/sign actions), SOF (embedded Statement of Facts with event timeline), Masraflar (port expenses tracked per port call), Kargo Ops (cargo operations per port call), Katılımcılar (invite seller/receiver/broker/surveyor). NOR and SOF removed from main nav — fully embedded inside Port Calls. New DB table: `port_call_participants`. Schema additions: `portCallId` added to `notice_of_readiness`, `statement_of_facts`, `port_expenses`. New API: `GET/POST/PATCH/DELETE /api/port-call-participants`. NOR/SOF/expenses/cargo-ops APIs now support `?portCallId=X` filter.
-   **Port Call Checklist**: Per-port-call arrival/departure checklists auto-initialized with Turkish maritime items. DB table: `port_call_checklists`. Accessible via "Checklist" button on each Port Call card.
-   **Broker Tools**: Voyage Estimation / Freight P&L Calculator, Order Book, Broker Commission Ledger, and Broker Contact Book (CRM).
-   **Scheduling & Planning**: Vessel schedule calendar and a voyage invitation system.
-   **Internationalization & Accessibility**: Support for multiple languages (TR/EN) and dark mode.
-   **Navigation System**: Icon rail with an expandable panel.
-   **Admin Tools**: User management, audit log system with export, and IP address filtering.
-   **Dashboards**: Role-specific dashboards enriched with operational data, KPIs, trends, and drill-down capabilities. Enhanced Broker and Agent Operations Dashboards.
-   **Global Search**: Comprehensive search functionality.
-   **Security**: Helmet Content-Security-Policy headers configured.
-   **Demo System**: Server-side seeding for pre-populated demo accounts.
-   **Mobile Responsiveness**: Optimized UI for various modules.
-   **Data Operations**: CSV Export functionality across multiple modules and CSV Import for Port Expenses. Bulk operations for invoices and voyages.
-   **Workflow Enhancements**: Proforma Revision History UI, Service Offer → Invoice Auto-creation, Voyage Completion Workflow with checklist, Unified Action Center, FDA Mapping Templates, and Automated Email Notifications.
-   **Onboarding**: Getting Started checklist widget and feature discovery tooltips.
-   **Shipowner Portal**: Simplified, read-only role-based views.
-   **PWA Support**: Installable app experience with manifest.json and service worker.
-   **Provider Workflow**: Provider Invoice Review Workflow.
-   **Multi-Currency**: Support for multiple currencies with live exchange rates and Port LOCODE Autocomplete.
-   **Crew Change Document Generator**: Automated generation of 6 official Turkish maritime port documents — Gümrük Personel Değişikliği, Polis Yurttan Çıkış, Polis Yurda Giriş, Vize Talep Formu, Acente Personeli Giriş İzni, Ekim Tur Giriş İzni. Available in two places: (1) Husbandry module (`/husbandry`) for husbandry-linked crew changes; (2) **Voyage Detail page** (`/voyages/:id`) Crew Logistics Board — "Belge Oluştur" button generates documents directly from ON-SIGNERS / OFF-SIGNERS. Configurable at `/crew-doc-settings`. DB tables: `crew_doc_config`. Extended `crew_changes` and `voyage_crew_logistics` with DOB (`dob`), birthplace (`birth_place`), seaman book (`seaman_book_no`) fields.

## External Dependencies
-   **PostgreSQL**: Primary relational database.
-   **bcryptjs**: Secure password hashing.
-   **AISStream.io**: Live AIS vessel tracking data.
-   **RapidAPI (Zyla Labs Vessel Information API)**: Detailed vessel information.
-   **Turkish Central Bank (TCMB)**: Live exchange rates.
-   **Resend**: Transactional email service.
-   **jsPDF + html2canvas**: Client-side PDF generation.
-   **Mapbox GL JS**: Interactive maps.
-   **Anthropic AI**: AI Assistant (Claude-Haiku) for document analysis.
-   **Yahoo Finance API**: Market data indices (BDI, BCTI, BDTI).

## Backend Architecture Improvements (F1–F10)
-   **F1 – Validation Middleware**: `server/middleware/validate.ts` with `validate(schema, source)` applied to invoice POST route.
-   **F5 – Event Bus**: `server/events/event-bus.ts` + `listeners/notification.listener.ts` + `listeners/audit.listener.ts`. Nomination, tender, and proforma routes emit typed events.
-   **F6 – Soft Delete**: `deleted_at TIMESTAMP` added to vessels, proformas, voyages, fixtures, invoices. All delete methods update `deletedAt` instead of hard-deleting. List queries filter `IS NULL`. Restore endpoints added: `POST /api/v1/vessels/:id/restore`, `/api/v1/proformas/:id/restore`, `/api/v1/voyages/:id/restore`, `/api/v1/fixtures/:id/restore`, `/api/invoices/:id/restore`. Weekly purge cron (`0 3 * * 1`) hard-deletes records older than 30 days.
-   **F7 – File Storage**: Base64 fallbacks removed; files stored on disk only (`server/file-storage.ts`). `saveBase64ToFile()` available for migration.
-   **F8 – Cache Layer**: `server/cache.ts` tiered cache (short/medium/long/daily). `getPorts()` → daily, `getBunkerPrices()` → long (invalidated on upsert), `getForumCategories()` → long, `getPublicCompanyProfiles()` → long.
-   **F9 – API Versioning**: All prefix-mounted routes at `/api/v1/*`; backward-compat middleware rewrites `/api/X` → `/api/v1/X`.
-   **F10 – Cleanup**: Removed `server/ensure-bunker-tables.ts` and `shared/models/chat.ts` (unused duplicates).