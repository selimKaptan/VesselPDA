# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry. Key capabilities include proforma generation, a robust maritime company directory, and customizable company profiles for various stakeholders. The business vision is to become the leading digital hub for maritime professionals, significantly reducing administrative overhead and increasing operational efficiency across the global shipping sector.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack:
- **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI, ensuring a responsive and intuitive user experience. The UI/UX is maritime-themed, predominantly using a deep blue color palette (primary: #003D7A, secondary: #0077BE, accent: #00A8E1) with design tokens for a professional aesthetic, including maritime-gold accents and stronger shadows.
- **Backend**: Express.js with PostgreSQL as the database, managed via Drizzle ORM.
- **Authentication**: Custom email/password authentication with email verification flow (Replit OAuth removed). Users register with email + password, receive verification email via Resend, then log in. Session-based auth using connect-pg-simple (PostgreSQL session store). Includes forgot-password / reset-password flows. Password hashing with bcryptjs. Existing users auto-marked as email-verified on startup.
- **Core Features**:
    - **User Management**: Role-based authentication (Admin, Shipowner/Broker, Ship Agent, Service Provider) with distinct dashboards and navigation.
    - **Vessel Management**: CRUD operations for vessels, including a fleet dashboard and personal watchlists.
    - **Port & Tariff Data**: Management of 804 Turkish ports, including LOCODE lookup and detailed port information via external APIs.
    - **Proforma Generation**: An advanced, formula-based calculation engine (22 line items) for automated tariff calculations, matching Excel references. Supports PDF export and manual calculation.
    - **Company Profiles**: Detailed profiles for agents and providers, including contact information, served ports, service types, and optional featured listings. Includes agent performance metrics such as win rate and average rating.
    - **Maritime Directory**: A searchable and filterable directory of maritime companies.
    - **Subscription System**: A 3-tier subscription model (Free, Standard, Unlimited) with usage tracking for proformas and vessels.
    - **Vessel Tracking**: Interactive Leaflet map with live AIS data (via AISStream.io) for vessel positions in Turkish waters, custom SVG ship markers, and role-based fleet views.
    - **Port Call Tender System**: Enables shipowners to create tenders, routes them to relevant agents, allows agents to submit bids, and facilitates bid selection and nomination with email notifications.
    - **Forum/Discussion Board**: A comprehensive discussion platform with categories, topics, replies, search, and filtering, accessible to all users for collaborative communication. Supports anonymous posting.
    - **Internationalization**: TR/EN language toggle with content translation.
- **Design Choices**: Global design tokens, professional UI redesign across all pages, including revamped landing page, dashboards, and forms.
- **Data Storage**: Logo images are stored as base64 data URIs in the database to ensure persistence.
- **API Integration**: Integration with various external services for enhanced functionality (e.g., AIS data, vessel information, exchange rates).

## External Dependencies
- **PostgreSQL**: Primary database for all application data, managed with Drizzle ORM.
- **bcryptjs**: Password hashing library for secure credential storage.
- **AISStream.io**: WebSocket-based API for live AIS vessel tracking data.
- **RapidAPI (Zyla Labs Vessel Information API)**: For vessel IMO lookup and retrieving detailed vessel information (name, type, flag, tonnage, dimensions).
- **Turkish Central Bank (TCMB)**: Public XML feed for fetching live USD/TRY and EUR/TRY exchange rates.
- **Resend**: Transactional email service for sending various notifications (nominations, contact forms, bid-related alerts).
- **jsPDF + html2canvas**: Client-side libraries for generating multi-page PDF exports of proformas.
- **Leaflet**: JavaScript library for interactive maps, used in the Vessel Track feature.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Shadcn UI**: UI component library.
- **Recharts**: Charting library for admin analytics.