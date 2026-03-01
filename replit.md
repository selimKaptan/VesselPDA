# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry. Key capabilities include proforma generation, a robust maritime company directory, and customizable company profiles for various stakeholders. The business vision is to become the leading digital hub for maritime professionals, significantly reducing administrative overhead and increasing operational efficiency across the global shipping sector.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

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
    - **Admin User Management**: Tools for managing user plans, suspension, and verification requests.
    - **Vessel Certificate Management**: Tracking and status visualization for vessel certificates.
    - **Port Call Appointment Management**: Panel for managing and tracking port call appointments.
    - **Fixture & Recap System**: System for charter negotiation and fixture tracking.
    - **Cargo & Position Board**: Platform for posting and viewing "cargo looking" or "vessel looking" ads, integrated with market data tickers.
    - **Market Data**: Displays Baltic Dry/Tanker Indices (from Yahoo Finance API) and port-specific bunker prices.
    - **AI Assistant**: Floating chat panel powered by Claude-Haiku, providing context-aware assistance based on user's vessels, voyages, and proformas.
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