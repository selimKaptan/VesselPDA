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
    - **Organization & Team System**: Multi-tenant infrastructure supporting organizations, members, roles, and invitations.
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