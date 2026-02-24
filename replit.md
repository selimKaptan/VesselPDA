# MaritimePDA - Maritime Hub Platform

## Overview
A professional web-based maritime platform for ship agents to create instant proforma disbursement accounts AND connect shipowners with maritime service providers. The platform features proforma generation, a maritime company directory, and company profiles for agents and providers.

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
- `shared/schema.ts` - All Drizzle models (vessels, ports, tariffCategories, tariffRates, proformas)
- `shared/models/auth.ts` - Auth models (users, sessions, companyProfiles) with subscription + role fields
- `server/routes.ts` - API endpoints including company profiles, directory, user role management, admin endpoints
- `client/src/pages/admin.tsx` - Admin panel with users/vessels/proformas/profiles tabs
- `server/proforma-calculator.ts` - Formula-based calculation engine matching Excel reference (22 line items)
- `server/storage.ts` - Database storage layer with company profile CRUD methods
- `server/seed.ts` - Seed data for ports and tariffs
- `server/replit_integrations/auth/` - Replit Auth integration
- `client/src/pages/` - Landing, Dashboard, Vessels, Ports, Proformas, ProformaNew, ProformaView, Pricing, Directory, CompanyProfile
- `client/src/components/app-sidebar.tsx` - Role-aware navigation sidebar

## Database
- PostgreSQL with Drizzle ORM
- Tables: users, sessions, vessels, ports, tariff_categories, tariff_rates, proformas, company_profiles
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

## Recent Changes
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
