# MaritimePDA - Professional Proforma Generator

## Overview
A professional web-based maritime proforma generator system for ship agents to automatically create instant proforma invoices for shipowners and brokers. The platform allows users to register, add their vessels, and instantly generate base proforma invoices for any requested port using tariff data.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Authentication**: Replit Auth (OpenID Connect)
- **Design**: Maritime-themed with deep blue color palette (#003D7A primary), Inter/Montserrat fonts

## Key Features
- User authentication via Replit Auth
- Vessel management (CRUD) with fleet dashboard
- Port & tariff data management (804 Turkish ports loaded)
- Proforma generator with automated tariff calculations
- Professional proforma invoice viewing and printing
- 3-tier subscription system (Free/Standard/Unlimited) with usage tracking

## Project Structure
- `shared/schema.ts` - All Drizzle models (vessels, ports, tariffCategories, tariffRates, proformas)
- `shared/models/auth.ts` - Auth models (users, sessions) with subscription fields
- `server/routes.ts` - API endpoints including subscription upgrade
- `server/storage.ts` - Database storage layer with user subscription methods
- `server/seed.ts` - Seed data for ports and tariffs
- `server/replit_integrations/auth/` - Replit Auth integration
- `client/src/pages/` - Landing, Dashboard, Vessels, Ports, Proformas, ProformaNew, ProformaView, Pricing
- `client/src/components/app-sidebar.tsx` - Navigation sidebar

## Database
- PostgreSQL with Drizzle ORM
- Tables: users, sessions, vessels, ports, tariff_categories, tariff_rates, proformas
- Users table has subscriptionPlan, proformaCount, proformaLimit fields
- 804 Turkish ports loaded from Excel data

## Subscription Plans
- Free: 1 proforma, 1 vessel
- Standard ($29): 10 proformas, unlimited vessels
- Unlimited ($79/mo): unlimited proformas, unlimited vessels

## Recent Changes
- 2026-02-24: Added 3-tier pricing system with usage limits and in-app pricing page
- 2026-02-24: Loaded 804 Turkish ports from Excel data
- 2026-02-24: Initial MVP build with full proforma generation system
