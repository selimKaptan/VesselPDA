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
- **Financial Management**: Modules for Final Disbursement Accounts (FDA) with variance calculation, invoice management (including PDF export, voyage enrichment, and integration with FDAs), DA Advance/Fund Request system, Laytime Calculator with persistence, and Port Expense Ledger.
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
- **Analytics & Reporting**: Dashboard with KPIs, trends, and drill-down capabilities for voyages, invoices, and vessel activity.
- **Global Search**: Comprehensive search functionality including invoices and FDA accounts.
- **Security**: Helmet Content-Security-Policy headers configured.
- **Demo System**: Server-side seeding for pre-populated demo accounts.
- **Mobile Responsiveness**: Optimized UI for various modules on mobile devices.

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