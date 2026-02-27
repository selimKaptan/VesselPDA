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
    - **Notification System**: Real-time in-app notifications (bell icon in top-right header). Notifies users of forum replies on their topics, incoming bids on tenders, selected bids, and nominations. Unread count badge, mark-all-read, click-to-navigate. `notifications` table in DB. Auto-polls every 30 seconds.
    - **Internationalization**: TR/EN language toggle with content translation.
    - **Dark Mode**: Full dark/light mode toggle with localStorage persistence (`vpda-theme`). ThemeProvider context in `client/src/components/theme-provider.tsx`. Toggle button (Moon/Sun) in header.
    - **Mobile Navigation**: Sheet-based hamburger drawer for small screens. Opens/closes on nav link click. Visible on `md:hidden` breakpoint.
    - **Admin User Management**: Plan change (free/standard/unlimited) inline dropdown per user, suspend/activate users (sets `isSuspended` flag, blocks login with 403). `users.is_suspended` column in DB.
    - **Proforma List Enhancements**: Status filter, vessel filter, text search. Duplicate/clone proforma action (POST /api/proformas/:id/duplicate).
    - **AIS WebSocket Heartbeat**: 30s ping interval with 10s pong timeout to detect/terminate dead connections (fixes frequent code 1006 disconnects).
    - **Role-Specific Dashboards**: `dashboard.tsx` is a clean router that renders a dedicated component per role — `ShipownerDashboard` (fleet widget, active tenders, recent proformas, subscription card, quick actions), `AgentDashboard` (incoming tenders by port, bid status, performance card with win rate/rating, profile completion checklist), `ProviderDashboard` (profile completion hero with 5-field progress bar, services chips, contact summary, directory visibility, featured upsell), `AdminDashboard` (6-stat grid, recent activity feed, user role breakdown). Admin has a role switcher panel (Admin Overview / Shipowner / Agent / Provider). All components in `client/src/components/dashboards/`.
    - **Directory Ratings**: Agent cards in `/directory` now display avgRating (star icon + score + review count) or "No reviews yet". Backend `/api/directory` enriched with `avgRating` and `reviewCount` per profile.
    - **Star Rating UX**: `StarRating` component in directory-profile has smooth `transition-all` animation, `drop-shadow` on filled stars, and hover preview color (`text-amber-300`) on unfilled stars.
    - **Security (CSP)**: Helmet Content-Security-Policy headers enabled in `server/index.ts` — `connect-src` covers AIS WSS, TCMB, Resend, Zyla; `frame-ancestors: none`; `crossOriginEmbedderPolicy: false` kept for Leaflet.
    - **Proforma View**: Rewritten with dynamic company logo from `/api/company-profile/me`, email-send dialog (Resend), signature/stamp area, disclaimer text, navy blue table header, exchange rate line, mobile `overflow-x-auto` + `break-all` for IBANs.
    - **Email Features**: `sendForumReplyEmail()` and `sendProformaEmail()` in `server/email.ts`. Forum reply route emails topic author on new replies. `POST /api/proformas/:id/send-email` sends HTML proforma email via Resend.
- **Design Choices**: Global design tokens, professional UI redesign across all pages, including revamped landing page, dashboards, and forms.
- **Data Storage**: Logo images are stored as base64 data URIs in the database to ensure persistence.
- **API Integration**: Integration with various external services for enhanced functionality (e.g., AIS data, vessel information, exchange rates).

## External Dependencies
- **PostgreSQL**: Primary database for all application data, managed with Drizzle ORM.
- **bcryptjs**: Password hashing library for secure credential storage.
- **AISStream.io**: WebSocket-based API for live AIS vessel tracking data.
- **RapidAPI (Zyla Labs Vessel Information API)**: For vessel IMO lookup and retrieving detailed vessel information (name, type, flag, tonnage, dimensions).
- **Turkish Central Bank (TCMB)**: Public XML feed for fetching live USD/TRY and EUR/TRY exchange rates.
- **Resend**: Transactional email service for sending various notifications (nominations, contact forms, bid-related alerts, proforma emails, forum reply notifications).
- **jsPDF + html2canvas**: Client-side libraries for generating multi-page PDF exports of proformas.
- **Leaflet**: JavaScript library for interactive maps, used in the Vessel Track feature.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Shadcn UI**: UI component library.
- **Recharts**: Charting library for admin analytics.