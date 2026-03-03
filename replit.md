# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry. Key capabilities include proforma generation, a robust maritime company directory, and customizable company profiles for various stakeholders. The business vision is to become the leading digital hub for maritime professionals, significantly reducing administrative overhead and increasing operational efficiency across the global shipping sector.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## UI Language Policy
English is the primary and only UI language. All user-facing text must be in English, including:
- Button labels, form labels, placeholders, table headers
- Toast notifications (titles and descriptions)
- Error messages, empty states, dialog text
- Status badge labels, tab names, section headers
- PageMeta title and description attributes
Turkish text is only acceptable in: (a) code comments, (b) proper names of Turkish institutions/locations (e.g. İstanbul, İzmir port names), (c) data stored by users themselves. The i18n toggle exists but defaults to English.

## System Architecture
The platform is built with a modern web stack. The UI/UX is maritime-themed, predominantly using a deep blue color palette with design tokens for a professional aesthetic.

**Technical Implementations:**
- **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI.
- **Backend**: Express.js with PostgreSQL as the database, managed via Drizzle ORM.
- **Authentication**: Custom email/password authentication with email verification, session-based authentication using `connect-pg-simple`, and password hashing with `bcryptjs`.
- **Core Features**:
    - **User & Role Management**: Role-based access (Admin, Shipowner/Broker, Ship Agent, Service Provider) with distinct dashboards.
    - **Vessel & Port Management**: CRUD operations for vessels and management of Turkish port data, including LOCODE lookup.
    - **Proforma Generation**: Formula-based calculation engine for instant disbursement account generation, supporting PDF export and quick estimates based on live exchange rates.
    - **Company Profiles & Directory**: Detailed, customizable profiles for maritime companies and a searchable directory. Includes a Trust & Verification System with company verification status, sanction list checks, and endorsements.
    - **Subscription System**: 3-tier model (Free, Standard, Unlimited) with usage tracking.
    - **Vessel Tracking**: Interactive Mapbox GL JS map with live AIS data for vessel positions in Turkish waters.
    - **Port Call Tender System**: Facilitates tender creation by shipowners, bid submission by agents, and nomination with automated voyage creation and conversation initiation.
    - **Voyage Management**: Comprehensive system for managing voyages, including checklists, linked service requests, and status lifecycle.
    - **Service Request System**: Enables posting and fulfilling service requests (e.g., fuel, repair) with offer management.
    - **Forum/Discussion Board**: A platform for collaborative communication with categories, topics, and replies.
    - **Document Management**: Voyage-based file upload system for various documents.
    - **Mutual Assessment**: Rating system for shipowners/agents after completed voyages.
    - **Direct Messaging**: Private messaging system between users with real-time updates and notifications.
    - **Notification System**: Real-time in-app notifications for various events.
    - **Internationalization**: TR/EN language toggle.
    - **Dark Mode**: Full dark/light mode toggle.
    - **Mobile Navigation**: Sheet-based hamburger menu for small screens.
    - **Admin User Management**: Comprehensive admin panel with 15 tabs: user CRUD (create/suspend/delete/role-change/email-verify), KPI dashboard (8 cards + activity feed), content management (voyages + service requests overview), announcements (bulk notifications by role), financial overview (plan distribution), reports (user growth chart + active users table), system settings (API status), plus bunker prices and port alerts management.
    - **Vessel Certificate Management**: Tracking and status visualization for vessel certificates.
    - **Port Call Appointment Management**: Panel for managing and tracking port call appointments.
    - **Fixture & Recap System**: System for charter negotiation and fixture tracking.
    - **Cargo & Position Board**: Platform for posting and viewing "cargo looking" or "vessel looking" ads, integrated with market data tickers.
    - **Market Data**: Displays Baltic Dry/Tanker Indices (from Yahoo Finance API) and port-specific bunker prices.
    - **AI Assistant**: Floating chat panel powered by Claude-Haiku, providing context-aware assistance based on user's vessels, voyages, and proformas.
    - **Vessel Crew Management**: Mürettebat (crew) tab in vessel detail sheet — CRUD for crew members displayed in a compact table (10 columns: #, Name, Rank, Nationality, Contract End, Passport Exp, Passport Doc, Seaman's Book Exp, Seaman's Book Doc, Actions). Colour-coded expiry warnings (red=expired, amber=expiring within 30 days). PDF document upload/preview/download per crew member for Passport and Seaman's Book — stored as base64 in `vessel_crew` table (`passport_file_base64`, `passport_file_name`, `seamans_book_file_base64`, `seamans_book_file_name` columns).
    - **Tariff Management System**: Admin page (`/tariff-management`) for managing Turkish port tariffs with a port-centric UI. Shows İstanbul/İzmir/Tekirdağ as tabs plus dynamic port adding (512 Turkish ports); 13 tariff categories as collapsible sections per port: Pilotage, Berthing, Agency Fees, MARPOL, LCB, Other Services, Light Dues, Chamber of Shipping Fee, Chamber of Shipping (Freight Share), Harbour Master Dues, Sanitary Dues, Supervision Fee, **Miscellaneous Expenses** (new). DB tables: `light_dues`, `chamber_of_shipping_fees`, `chamber_freight_share`, `harbour_master_dues`, `sanitary_dues`, `vts_fees`, `supervision_fees`, `misc_expenses` (all raw SQL, NOT in Drizzle schema). Features: inline row editing, add/delete per category, per-category bulk % increase, CSV export/import. Human-readable Turkish labels for service_type/vessel_category values. **4 Official Vessel Categories** for pilotage: "Kabotaj Hattında Çalışan Gemiler", "Konteyner Gemileri", "Diğer Yük Gemileri", "Yolcu Feribotu / Ro-Ro / Car Carrier" — enforced via dropdown selects in both add form and inline editing. **Global Tariffs Tab ("Tüm Limanlar")**: Tariffs saved with `port_id = NULL` apply to all ports automatically. Proforma lookup first checks port-specific, then falls back to global. Accessible from admin panel and sidebar. **Supervision Fee**: 38 official 2026 rows seeded across 8 cargo categories (A–H) plus 3 Genel Kural rows (min 300 EUR, max 10,000 EUR, Turkish flag 50% discount); columns: category, cargo_type, quantity_range, rate, unit (EUR/MT / EUR/Adet / EUR/Metre). **Miscellaneous Expenses** (`misc_expenses` table): 5 configurable fixed expenses (motorboat $500, facilities $550, transportation $500, fiscal $250, communication $250) stored globally (port_id=NULL). Lookup: `lookupMiscExpenses()` returns map; wired into both `/api/proformas/calculate` and `/api/proformas/quick-estimate`. Fallback = hardcoded values if DB empty. **Kabotaj agency fee discount**: 50% reduction applied in `calcAgencyFee()` when `flagCategory === "cabotage"`.
    - **DB-Connected Quick Estimate**: Anlık proforma hesaplaması artık DB tarife tablolarına bağlı. İstanbul (port_id=2): kılavuzluk (uluslararasi/kabotaj service_type) + acentelik; İzmir (port_id=3): barınma + MARPOL + LCB. Üç gemi kategorisi tam destekleniyor: Yabancı Bayrak (foreign_intl) → pilotage uluslararasi, Türk Uluslararası (turkish_intl) → pilotage uluslararasi, Kabotaj Türk Bayrak (turkish_cabotage) → pilotage kabotaj. Sefer Tipi seçici (Uluslararası/Kabotaj) sadece Türk bayraklı gemilerde görünür — yabancı bayrak otomatik uluslararası. Tarife kaynağı badge: yeşil = "Gerçek 2026 Tarifeleri" (DB'den), sarı = "Tahmini" (fallback). `server/tariff-lookup.ts` 8 lookup fonksiyonu. DB'ye uluslararası kılavuzluk tarifleri (uluslararasi + romorkör_uluslararasi service_type) eklendi. **IMO Arama**: Combobox'a 5-8 haneli sayı girilince 600ms debounce sonra `/api/vessels/lookup?imo=` API'si sorgulanır; sonuç "Globe" ikonuyla listelenir; seçilince `quickVesselId="external"` + `quickExternalVessel` state'i set edilir; backend `/api/proformas/quick-estimate` `externalGrt/externalNrt/externalFlag/externalVesselName` parametrelerini kabul eder. **Tehlikeli Yük**: Pilotage/Tugboat/Mooring'e %30 zamlanır; Supervision'a uygulanmaz; UI badge "%30" olarak güncellendi. **DB Supervision Fee** (`lookupSupervisionFee()`): `supervision_fees` tablosundaki gerçek 2026 tarifelerinden kademeli hesaplama: `getSupervisionCargoKeyword()` ile cargo string → DB keyword eşleştirmesi (LPG/LNG, Ham Petrol, Kimyevi, Dolu konteyner, Otomobil, Demir-celik, Tahil ve Tohumlar, Kati Esya); `parseQuantityRange()` ile "0 - 10.000 ton" → {min,max}; Genel Kural'dan min 300 EUR, max 10,000 EUR; Türk uluslararası bayrak %50 indirim; Kabotaj = $0. Her iki endpoint (calculate + quick-estimate) için `CalculationInput.dbSupervisionFee` üzerinden aktarılıyor; hardcoded fallback hâlâ mevcut.
- **Security**: Helmet Content-Security-Policy headers configured for various external services.

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