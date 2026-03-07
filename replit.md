# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry, ultimately becoming the leading digital hub for maritime professionals.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack, featuring a maritime-themed UI/UX with a deep blue color palette and a Glassmorphism Design System for floating UI components.

**Technical Implementations:**
- **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI for a responsive and intuitive user interface.
- **Backend**: Express.js with PostgreSQL and Drizzle ORM for data persistence and API logic.
- **Authentication**: Custom email/password authentication with verification and session management.
- **User & Role Management**: A six-role system (Shipowner, Agent, Broker, Provider, Master, Admin) with granular permissions.
- **Core Maritime Operations**: Tools for managing vessel data, port information, port calls, voyages, and proforma disbursement accounts (with PDF export and live exchange rates).
- **Financial Management**: Modules for Final Disbursement Accounts (FDA) with variance calculation, invoice management (including PDF export, voyage enrichment, and integration with FDAs), DA Advance/Fund Request system, Laytime Calculator with persistence, Port Expense Ledger, Invoice Partial Payment Tracking (with progress bars and payment history), and FDA→Port Expense Reconciliation.
- **Company & Service Management**: Verified company profiles and a comprehensive directory of maritime service providers.
- **Subscription System**: A 3-tier subscription model.
- **Vessel Tracking**: Live AIS vessel tracking.
- **Communication & Collaboration**: Forum, direct messaging, and notification system.
- **Document Management**: Capabilities for managing maritime documents including a specialized Vessel Vault for statutory certificates with expiry tracking.
- **Assessment & Reporting**: Mutual assessment features, Statement of Facts (SOF) module, and DA comparison reports.
- **AI Integration**: AI Smart Drop module for document analysis and event detection (Claude-Haiku) with human-in-the-loop verification.
- **Specialized Modules**: Q88 Vessel Questionnaire, Berthing Fees, VTS Fees, and Harbour Master Dues calculation systems. Cargo Operations tab for voyage detail, Crew Management enhancements (including hotel reservations via drag & drop and logistics persistence).
- **Scheduling & Planning**: Vessel schedule calendar and a voyage invitation system.
- **Internationalization & Accessibility**: Support for multiple languages (TR/EN) and dark mode.
- **Navigation System**: Icon rail with an expandable panel and comprehensive information architecture.
- **Admin Tools**: User management and audit log system.
- **Dashboards**: Role-specific dashboards enriched with operational data, including alerts for pending actions.
- **Analytics & Reporting**: Dashboard with KPIs, trends, and drill-down capabilities for voyages, invoices, and vessel activity. Custom date range picker, vessel profitability comparison chart, port performance comparison chart, KPI trend arrows (period-over-period).
- **Global Search**: Comprehensive search functionality including invoices and FDA accounts.
- **Security**: Helmet Content-Security-Policy headers configured.
- **Demo System**: Server-side seeding for pre-populated demo accounts.
- **Mobile Responsiveness**: Optimized UI for various modules on mobile devices. voyage-detail.tsx fully responsive (scrollable tab bar, responsive grids, overflow-x-auto tables, flexible widths).
- **CSV Export**: Export buttons on Invoices, Voyages, Port Expenses, DA Advances, Analytics, and Vessel Certificates pages.
- **CSV Import**: Port Expense bulk import via CSV file upload with column validation and voyage association.
- **Bulk Operations**: Multi-select invoices and voyages with floating bulk action bar (bulk mark paid, send reminder, bulk close, export).
- **Proforma Revision History UI**: Visual timeline of approval/revision actions on proforma detail view, revision count badges on list.
- **Service Offer → Invoice Auto-creation**: When a service offer is selected, invoice auto-created with "Invoice Created" badge and "View Invoice" link.
- **Voyage Completion Workflow**: "Complete Voyage" close-out with checklist dialog (FDA/Invoice/DA Advance checks) and summary modal.
- **Unified Action Center**: `/actions` page aggregating all pending tasks (overdue invoices, expiring certs, pending advances, voyages needing FDA) with sidebar badge and top bar indicator.
- **FDA Mapping Templates**: Save and reuse PDA→Port Expense category mappings via new `fda_mapping_templates` table; manageable in Settings → FDA Templates tab.
- **Voyage Financial Report PDF**: Comprehensive PDF download from voyage detail (PDA/FDA comparison, port expenses, invoice summary, net balance).
- **Agent Commission Module**: Commission calculation per voyage (% or fixed), Settings → Commissions tab, commission status tracking.
- **Onboarding Improvements**: Getting Started checklist widget on dashboards, feature discovery tooltips on key pages.
- **Automated Email Notifications**: Cron-triggered emails for invoice due dates (7d/1d), certificate expiry (30d), DA advance due (14d), payment confirmations. Configurable in Settings → Notifications.
- **Voyage Notes & Tasks**: Notes/comments timeline on voyage detail (Notes & Tasks tab) with note types (comment/observation/alert/milestone), privacy toggle, and author attribution.
- **Shipowner Portal**: Role-based voyage detail simplification (shipowners see only Overview, Financial, Documents, Notes tabs; read-only badge; simplified shipowner dashboard with pending approvals and fleet summary).
- **Document Management Extensions**: Multi-file certificate upload, renewal workflow (schedule + status tracking), renewal status color-coding (blue=scheduled), Export List CSV for all certificates.
- **Planned Maintenance System (PMS)**: Equipment registry per vessel (type, manufacturer, serial, location) + maintenance job orders with interval scheduling, priority levels (critical/urgent/routine), overdue detection (red/orange/green), and completion tracking. Route: `/maintenance`.
- **Bunker Management**: Bunker order lifecycle (ordered→delivered→invoiced→paid) with BDN tracking, ROB (Remaining on Board) daily reporting, fuel consumption trend charts (Recharts), multi-fuel-type support (HFO/MGO/LSFO/VLSFO). Route: `/bunker-management`.
- **Noon Reports & Vessel Performance**: Daily position/speed/RPM/weather/fuel consumption reports, performance KPI cards (avg speed, daily consumption, total NM), trend charts, sea state tracking. Route: `/noon-reports`.
- **Charter Party & TC Hire Management**: TC/VC/BB/CoA charter party contracts, hire payment statements (gross/off-hire deductions/commissions/net), off-hire event log, active CP status tracking. Route: `/charter-parties`.
- **Crew Enhancement (STCW + Payroll)**: Enhanced crew-roster with STCW & professional certificate tracking (expiry alerts), monthly payroll processing (basic/overtime/bonus/deductions/net), expanded contract fields (visa, seaman's book, emergency contact, relief due date). Tabs: Roster, STCW & Certificates, Payroll.
- **Port Call Management**: Dedicated agent module for tracking active port calls (vessel arrivals, berth assignments, operational milestones: NOR/berthing/operations/departure). Status workflow: expected→arrived→in_port→operations→departed. KPI cards, quick status updates, voyage/PDA linking. Route: `/port-calls`.
- **Husbandry Services**: Agent module for managing vessel services: crew changes, medical assistance, spare parts, cash-to-master, provisions, postal, surveys. Crew change details (visa, flight, hotel), cost tracking, vendor management. Route: `/husbandry`.
- **Agent Operations Dashboard**: Enhanced agent-specific dashboard with Active Port Calls widget, Husbandry Pending Services widget, updated Quick Access with Port Calls/Husbandry/Action Center shortcuts.
- **Navigation Fixes (Agent Role)**: Port Expenses, DA Advances now in Finance nav; Analytics in Intelligence nav; Port Calls, Action Center, Husbandry in Port Operations nav — all accessible to agent role.
- **Port Agent's Report PDF**: Comprehensive port agent report generated from voyage data (vessel movement log, financial summary, cargo operations, services arranged). PDF export and print functionality. Accessible from voyage detail. Route: `/agent-report/:voyageId`.
- **Environmental Compliance (CII/EU ETS/IMO DCS)**: Carbon Intensity Indicator tracking with A-E ratings, EU ETS emissions & cost management (40%→70%→100% phase-in), IMO DCS annual fuel reporting. Fleet summary dashboard with Recharts. Route: `/environmental`.
- **Insurance Management (P&I & H&M)**: Insurance policy lifecycle (P&I, H&M, FD&D, War), expiry alerts (30-day warnings), claim/incident tracking with surveyor/correspondent details, fleet-wide premium summary. Route: `/insurance`.
- **Drydock Management**: Drydock project planning (special survey/intermediate/repair/emergency), job specification list with category grouping (Hull/Engine/Safety/Class/Owner), budget vs actual tracking, Recharts cost analysis, CSV spec export. Route: `/drydock`.
- **Defect & PSC Tracking**: Vessel defect log (defect/non-conformity/near-miss), priority color-coding (critical/major/minor/routine), PSC inspection history (Paris MOU/Tokyo MOU/USCG), deficiency rectification tracking. Route: `/defect-tracker`.
- **Spare Parts Inventory**: Parts catalog with stock level indicators (green/yellow/red), low-stock alerts, procurement requisitions workflow (pending→approved→ordered→received), multi-item req line items, monthly spend tracking. Route: `/spare-parts`.
- **Voyage Estimation / Freight P&L Calculator**: Core broker tool for estimating voyage profitability. Accordion input form (Vessel, Cargo & Freight, Ports & Distances, Costs, Commission), live calculation of Gross Freight, Bunker Cost, Net Profit/Loss (color-coded), TCE (Time Charter Equivalent), Breakeven Rate, cost distribution pie chart (Recharts). Saved estimations table with history. Route: `/voyage-estimation`.
- **Order Book (Broker)**: Private cargo enquiry and vessel position management. Three tabs: Cargo Orders (cargo seeking tonnage with laycan countdown), Vessel Positions (openings seeking cargo), Match Board (potential matches by type/DWT/area). Status workflow: open→negotiating→fixed/failed. Fixture linking. Route: `/order-book`.
- **Broker Commission Ledger**: Commission tracking per fixture. Auto-calculation (freight × rate%), overdue payment alerts, status workflow (pending→invoiced→partial→received), monthly revenue bar chart, counterparty distribution pie chart (Recharts), CSV export. Route: `/broker-commissions`.
- **Broker Contact Book (CRM)**: Personal counterparty directory (Shipowners, Charterers, Brokers, Operators, Traders). List and grid view modes, search and type filter, favorites toggle, star ratings (1-5), CSV export. Route: `/contacts`.
- **Enhanced Broker Dashboard**: 8 KPI cards (Active Fixtures, Open Tenders, Open Orders, Pending Commissions, Cargo Positions, Open Vessel Positions, Monthly Commission, Fixed This Week), Active Cargo Orders widget (upcoming laycans with urgency color), Pending Commissions widget (overdue detection), expanded Quick Access (8 shortcuts including Sprint 9 modules).

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **bcryptjs**: Secure password hashing.
- **AISStream.io**: Live AIS vessel tracking data.
- **RapidAPI (Zyla Labs Vessel Information API)**: Detailed vessel information.
- **Turkish Central Bank (TCMB)**: Live exchange rates.
- **Resend**: Transactional email service.
- **jsPDF + html2canvas**: Client-side PDF generation.
- **Mapbox GL JS**: Interactive maps.
- **Anthropic AI**: AI Assistant (Claude-Haiku) for document analysis.
- **Yahoo Finance API**: Market data indices (BDI, BCTI, BDTI).