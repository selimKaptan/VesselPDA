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
- Port & tariff data management (5 Turkish ports seeded)
- Proforma generator with automated tariff calculations
- Professional proforma invoice viewing and printing

## Project Structure
- `shared/schema.ts` - All Drizzle models (vessels, ports, tariffCategories, tariffRates, proformas)
- `shared/models/auth.ts` - Auth models (users, sessions)
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database storage layer
- `server/seed.ts` - Seed data for ports and tariffs
- `server/replit_integrations/auth/` - Replit Auth integration
- `client/src/pages/` - Landing, Dashboard, Vessels, Ports, Proformas, ProformaNew, ProformaView
- `client/src/components/app-sidebar.tsx` - Navigation sidebar

## Database
- PostgreSQL with Drizzle ORM
- Tables: users, sessions, vessels, ports, tariff_categories, tariff_rates, proformas
- Seeded with 5 Turkish ports (Tekirdag, Istanbul, Izmir, Mersin, Aliaga) and their tariff data

## Recent Changes
- 2026-02-24: Initial MVP build with full proforma generation system
