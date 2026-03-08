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
-   **Vessel Tracking**: Live AIS vessel tracking and Noon Reports for performance.
-   **Communication & Collaboration**: Forum, direct messaging, and notification system.
-   **Document Management**: Capabilities for managing maritime documents, including a specialized Vessel Vault for statutory certificates with expiry tracking, multi-file upload, and renewal workflows.
-   **Assessment & Reporting**: Mutual assessment features, Statement of Facts (SOF) module, and DA comparison reports.
-   **AI Integration**: AI Smart Drop module for document analysis and event detection with human-in-the-loop verification.
-   **Specialized Modules**: Q88 Vessel Questionnaire, Berthing Fees, VTS Fees, and Harbour Master Dues calculation systems. Cargo Operations (loading/discharging tracking with status, B/L, hatch tracking), Crew Management enhancements (including hotel reservations), Planned Maintenance System (PMS), Bunker Management, Charter Party & TC Hire Management, Port Call Management with Checklist (14 arrival + 13 departure default items, custom items, progress tracking), Husbandry Services, Environmental Compliance (CII/EU ETS/IMO DCS), Insurance Management, Drydock Management, Defect & PSC Tracking, Spare Parts Inventory, Passage Planning.
-   **Agent Reports Module**: Dedicated `/agent-reports` listing page showing all voyages with direct links to per-voyage Agent Report pages. Added to Operations nav. DB: uses existing voyages table.
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
-   **Crew Change Document Generator**: Automated generation of 6 official Turkish maritime port documents from crew change data in Husbandry module — Gümrük Personel Değişikliği, Polis Yurttan Çıkış, Polis Yurda Giriş, Vize Talep Formu, Acente Personeli Giriş İzni, Ekim Tur Giriş İzni. Configurable at `/crew-doc-settings`. DB tables: `crew_doc_config`. Extended `crew_changes` with DOB, birthplace, seaman book fields.

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