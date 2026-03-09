# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry, ultimately becoming the leading digital hub for maritime professionals.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack, featuring a maritime-themed UI/UX with a deep blue color palette and a Glassmorphism Design System.

**Technical Implementations:**
-   **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI.
-   **Backend**: Express.js with PostgreSQL and Drizzle ORM.
-   **Authentication**: Custom email/password authentication with verification and session management.
-   **User & Role Management**: A six-role system (Shipowner, Agent, Broker, Provider, Master, Admin) with granular permissions.
-   **Core Maritime Operations**: Management of vessel data, port information, port calls, voyages, and proforma disbursement accounts (with PDF export and live exchange rates).
-   **Financial Management**: Modules for Final Disbursement Accounts (FDA) with variance calculation, invoice management, DA Advance/Fund Request, Laytime Calculator, Port Expense Ledger, Invoice Partial Payment Tracking, FDA→Port Expense Reconciliation, Agent Commission, and Voyage Financial Report PDF export.
-   **Company & Service Management**: Verified company profiles and a comprehensive directory of maritime service providers.
-   **Subscription System**: A 3-tier subscription model with feature gating.
-   **Vessel Tracking**: Live AIS vessel tracking, Noon Reports, and Datalastic integration for detailed vessel information, live position, historical tracks, port call history, and PSC inspections. The vessel track map uses Leaflet with CartoDB dark tiles.
-   **Communication & Collaboration**: Forum, direct messaging, and notification system.
-   **Document Management**: Maritime document management, including Vessel Vault for statutory certificates with expiry tracking and renewal workflows.
-   **Assessment & Reporting**: Mutual assessment features, Statement of Facts (SOF) module, and DA comparison reports.
-   **AI Integration**: AI Smart Drop module for document analysis and event detection with human-in-the-loop verification.
-   **Specialized Modules**: Q88 Vessel Questionnaire, Berthing Fees, VTS Fees, Harbour Master Dues calculation, Cargo Operations, Crew Management, Planned Maintenance System (PMS), Bunker Management, Charter Party & TC Hire Management, Port Call Management with Checklist, Husbandry Services, Environmental Compliance (CII/EU ETS/IMO DCS), Insurance Management, Drydock Management, Defect & PSC Tracking, Spare Parts Inventory, Passage Planning.
-   **Agent Reports Module**: Dedicated listing page for all voyages with links to per-voyage Agent Report pages.
-   **Port Call Hub**: Redesigned as the central operations hub with dedicated detail pages including sections for General Overview, NOR, SOF, Expenses, Cargo Operations, and Participants. Includes a Port Call Checklist.
-   **Broker Tools**: Voyage Estimation / Freight P&L Calculator, Order Book, Broker Commission Ledger, and Broker Contact Book (CRM).
-   **Scheduling & Planning**: Vessel schedule calendar and a voyage invitation system.
-   **Internationalization & Accessibility**: Support for multiple languages (TR/EN) and dark mode.
-   **Navigation System**: Icon rail with an expandable panel.
-   **Admin Tools**: User management, audit log system with export, and IP address filtering.
-   **Dashboards**: Role-specific dashboards with operational data, KPIs, trends, and drill-down capabilities.
-   **Global Search**: Comprehensive search functionality.
-   **Security**: Helmet Content-Security-Policy headers configured.
-   **Demo System**: Server-side seeding for pre-populated demo accounts.
-   **Mobile Responsiveness**: Optimized UI for various modules.
-   **Data Operations**: CSV Export functionality and CSV Import for Port Expenses, bulk operations.
-   **Workflow Enhancements**: Proforma Revision History UI, Service Offer → Invoice Auto-creation, Voyage Completion Workflow, Unified Action Center, FDA Mapping Templates, and Automated Email Notifications.
-   **Onboarding**: Getting Started checklist widget and feature discovery tooltips.
-   **Shipowner Portal**: Simplified, read-only role-based views.
-   **PWA Support**: Installable app experience.
-   **Provider Workflow**: Provider Invoice Review Workflow.
-   **Multi-Currency**: Support for multiple currencies with live exchange rates and Port LOCODE Autocomplete.
-   **Crew Change Document Generator**: Automated generation of 6 official Turkish maritime port documents, accessible from the Husbandry module and Voyage Detail page.

**Backend Architecture Improvements:**
-   **Validation Middleware**: Zod request body validation.
-   **Modular Storage & Schema**: Domain-specific modules for storage and schema definitions.
-   **Multi-tenant Data Access**: Organization-based data access control.
-   **Event Bus**: System for emitting and listening to events.
-   **Soft Delete**: Records are soft-deleted and purged by a weekly cron job.
-   **File Storage**: Files are stored on disk.
-   **Cache Layer**: Tiered caching mechanism (short/medium/long/daily).
-   **API Versioning**: All new routes under `/api/v1/`.

## External Dependencies
-   **PostgreSQL**: Primary relational database.
-   **bcryptjs**: Secure password hashing.
-   **AISStream.io**: Live AIS vessel tracking data.
-   **RapidAPI (Zyla Labs Vessel Information API)**: Detailed vessel information.
-   **Datalastic**: Comprehensive maritime API for vessel information, tracking, and inspections.
-   **Turkish Central Bank (TCMB)**: Live exchange rates.
-   **Resend**: Transactional email service.
-   **jsPDF + html2canvas**: Client-side PDF generation.
-   **Mapbox GL JS**: Interactive maps (for specific features like passage planning).
-   **Anthropic AI**: AI Assistant (Claude-Haiku) for document analysis.
-   **Yahoo Finance API**: Market data indices (BDI, BCTI, BDTI).
-   **Leaflet + CartoDB**: Open-source mapping for vessel track map.