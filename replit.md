# VesselPDA - Maritime Platform

## Overview
A professional web-based maritime platform (VesselPDA) for ship agents to create instant proforma disbursement accounts AND connect shipowners with maritime service providers. The platform features proforma generation, a maritime company directory, and company profiles for agents and providers.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Authentication**: Replit Auth (OpenID Connect)
- **Design**: Maritime-themed with deep blue color palette (#003D7A primary, #0077BE secondary, #00A8E1 accent)

## Key Features
- User authentication via Replit Auth with role system (shipowner, agent, provider)
- Vessel management (CRUD) with fleet dashboard
- Port & tariff data management (804 Turkish ports loaded)
- Proforma generator with automated tariff calculations (22 line items)
- Professional proforma invoice viewing and printing
- Company profiles for agents and providers (company info, contact, served ports, service types)
- Maritime directory with search, type filters, and port filters
- Featured/promoted company listings in directory
- 3-tier subscription system (Free/Standard/Unlimited) with usage tracking
- Role-aware dashboard and navigation

## User Roles
- **Admin**: Full system access - sees ALL vessels, proformas, users, company profiles. No proforma limits. Has dedicated Admin Panel (/admin)
- **Shipowner/Broker**: Uses proforma generator, browses directory
- **Ship Agent**: Creates company profile + uses proforma generator
- **Service Provider**: Creates company profile only (no proforma access)

## Project Structure
- `shared/schema.ts` - All Drizzle models (vessels, ports, tariffCategories, tariffRates, proformas, forumCategories, forumTopics, forumReplies)
- `shared/models/auth.ts` - Auth models (users, sessions, companyProfiles) with subscription + role fields
- `server/routes.ts` - API endpoints including company profiles, directory, user role management, admin endpoints, forum CRUD
- `client/src/pages/admin.tsx` - Admin panel with users/vessels/proformas/profiles tabs
- `server/proforma-calculator.ts` - Formula-based calculation engine matching Excel reference (22 line items)
- `server/storage.ts` - Database storage layer with company profile and forum CRUD methods
- `server/seed.ts` - Seed data for ports, tariffs, and forum categories
- `server/replit_integrations/auth/` - Replit Auth integration
- `client/src/pages/` - Landing, Dashboard, Vessels, Ports, Proformas, ProformaNew, ProformaView, Pricing, Directory, CompanyProfile, Forum, ForumTopic
- `client/src/components/app-sidebar.tsx` - Role-aware navigation sidebar

## Database
- PostgreSQL with Drizzle ORM
- Tables: users, sessions, vessels, ports, tariff_categories, tariff_rates, proformas, company_profiles, forum_categories, forum_topics, forum_replies
- Users table has userRole, activeRole, subscriptionPlan, proformaCount, proformaLimit fields
- Company profiles have companyType, servedPorts (jsonb), serviceTypes (jsonb), isFeatured, featuredUntil
- 804 Turkish ports loaded from Excel data

## API Endpoints
- `PATCH /api/user/role` - Update user role (shipowner/agent/provider)
- `PATCH /api/admin/active-role` - Admin: switch active role view (shipowner/agent/provider)
- `GET /api/company-profile/me` - Get current user's company profile
- `POST /api/company-profile` - Create company profile (agents/providers only)
- `PATCH /api/company-profile/:id` - Update own company profile (sanitized fields)
- `POST /api/company-profile/logo` - Upload company logo (multipart form, max 2MB)
- `DELETE /api/company-profile/logo` - Remove company logo
- `GET /api/activity-feed` - Public live activity feed (recent proformas, vessels, companies, users)
- `GET /api/directory` - Public directory listing with type and port filters
- `GET /api/directory/featured` - Featured companies
- `GET /api/directory/:id` - Single company profile
- `GET /api/forum/categories` - Public list of forum categories
- `GET /api/forum/topics` - Public topic listing (supports categoryId, sort, limit, offset params)
- `GET /api/forum/topics/:id` - Public single topic with replies and participants
- `POST /api/forum/topics` - Authenticated: create new discussion topic
- `POST /api/forum/topics/:id/replies` - Authenticated: reply to a topic

## Subscription Plans
- Free: 1 proforma, 1 vessel
- Standard ($29): 10 proformas, unlimited vessels
- Unlimited ($79/mo): unlimited proformas, unlimited vessels

## Calculation Engine
- `server/proforma-calculator.ts` - Formula-based engine matching user's Excel reference (PROFORMA_HAYRATI_S.H)
- 22 line items: Pilotage, Tugboats, Wharfage, Mooring, Garbage, Oto Service, Harbour Master, Sanitary, Light Dues, VTS, Customs Overtime, Anchorage, Chamber of Shipping, Chamber Freight Share, Maritime Association, Motorboat, Facilities, Transportation, Fiscal, Communication, Supervision, Agency Fee
- Parameters: dangerous cargo flag, customs type, flag/DTO/lighthouse/VTS/wharfage categories, exchange rates (USD/TRY, EUR/TRY)
- GRT-based scaling for pilotage, tugboats, mooring; NRT-based tiers for sanitary, harbour master, VTS
- Dangerous cargo 30% surcharge on pilotage and tugboats
- Manual calculation via "Calculate Proforma" button (no auto-calculate)

## Forum
- Discussion board with 6 categories: General Discussions, Port Operations, Vessel Intelligence, Regulations & Compliance, Technology & Software, Market & Freight
- All authenticated users can create topics and reply
- Public browsing (no auth required to read)
- Topics have: title, content, category, view count, reply count, participant avatars
- Sorting: Latest (by last activity) or Popular (by views)
- Category filtering and search
- Forum tables: forum_categories, forum_topics, forum_replies
- Categories seeded on startup (6 default categories with color coding)
- Forum accessible from sidebar (authenticated), landing/directory/service-ports nav (public)

## Email
- `server/email.ts` — Resend-based transactional email module (uses Replit Resend connector OAuth, falls back to RESEND_API_KEY)
- `sendNominationEmail()` — sends HTML nomination confirmation to agent + extra recipients
- `sendContactEmail()` — sends contact form submission to info@vesselpda.com, reply-to set to sender
- If credentials unavailable, skips silently (logged to console)
- From address: `noreply@vesselpda.com` (must be a verified Resend domain)

## Recent Changes
- 2026-02-25: Contact page — new /contact page with form (Ad Soyad, E-posta, Konu, Mesaj); sends to info@vesselpda.com via Resend; success confirmation state. "İletişim" link added to landing page nav (desktop + mobile) opens in new tab. POST /api/contact public endpoint. Page accessible to both logged-in and public users.
- 2026-02-25: Nomination dialog overhauled — replaced simple confirm AlertDialog with full Dialog showing: selected agent info (logo, name, email), vessel & cargo details (vessel name, flag, GRT, NRT, cargo type/quantity, previous port), optional "Not/Mesaj" textarea, optional "Ek Email Adresleri" field (comma-separated). Backend accepts note + extraEmails in POST /api/tenders/:id/nominate body. "Bu Acenteyi Değerlendir" button now only shows when effectiveRole === "shipowner" (admin in agent view no longer sees it).
- 2026-02-25: Agent Review System — shipowners/brokers can rate agents (1-5 stars) and leave comments on agent company profiles. Reviews show on /directory/:id (new DirectoryProfilePage). Review form visible to shipowners on agent profiles. After nomination, tender detail shows "Bu Acenteyi Değerlendir" button linking to agent's profile. New DB table: agent_reviews. New page: /directory/:id. New API: GET/POST /api/reviews/:companyProfileId. Directory "View Agent" button now navigates to profile page.


- 2026-02-25: Port Call Tender System — shipowners/brokers create port call tenders (24h/48h expiry), system routes to agents serving that port, agents submit PDF proforma bids, shipowner selects winning bid, nomination dialog sends nomination confirmation. Archive for both sides. Sidebar badge shows pending count. New DB tables: port_tenders, tender_bids. New pages: /tenders, /tenders/:id.
- 2026-02-25: Professional UI redesign — global design tokens (maritime-gold, stronger shadows, dark navy sidebar), landing page complete overhaul (hero floating cards, stats bar, features with gradient icons, gold Standard badge, dark CTA banner, professional footer), dashboard (StatCard component with left accent border + colored progress bar), sidebar (dark background, active left border, plan badge color coding), forum (category gradient icons + left border on topic rows), directory (featured banner strip + improved company cards)
- 2026-02-24: Anonymous forum topics — users can post topics with "Anonim olarak paylaş" checkbox; author name/avatar hidden and shown as "Anonim" in topic list and detail page; replies always named; userId still stored for ownership/deletion
- 2026-02-24: Rebranded from MaritimePDA to VesselPDA — all text references, logo images (using attached brand logo), page titles, sidebar, footer updated across all pages
- 2026-02-24: Added forum/discussion board with categories, topics, replies, search, and filtering
- 2026-02-24: Live activity feed on landing page - animated 3D ticker showing real-time platform events (proformas, vessels, companies, users)
- 2026-02-24: Admin role switching - admin can switch between agent/shipowner/provider views via sidebar dropdown, keeps admin privileges
- 2026-02-24: Logo upload now stores images as base64 data URIs in database (persists across deployments, no filesystem dependency)
- 2026-02-24: Added admin role for selim17 - full system access, Admin Panel (/admin) with tabs for users/vessels/proformas/profiles
- 2026-02-24: Added Service Ports page showing ports with registered agents/providers, expandable port cards, search/filter
- 2026-02-24: Role selection is now permanent - users pick role once at first login, cannot change afterward
- 2026-02-24: Added company profiles and maritime directory with search/filter
- 2026-02-24: Added user role system (shipowner, agent, provider) with role-aware UI
- 2026-02-24: Redesigned dashboard with role-based content and featured companies section
- 2026-02-24: Updated sidebar with role-aware navigation groups
- 2026-02-24: Built formula-based calculation engine with 22 line items matching Excel reference
- 2026-02-24: Added comprehensive tariff parameter controls (dangerous cargo, customs, flag categories, exchange rates)
- 2026-02-24: Added 3-tier pricing system with usage limits and in-app pricing page
- 2026-02-24: Loaded 804 Turkish ports from Excel data
- 2026-02-24: Initial MVP build with full proforma generation system
