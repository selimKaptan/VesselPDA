# VesselPDA — Maritime Platform System Prompt

> **Purpose**: This document is the single source of truth for AI-assisted development on VesselPDA. Place it in the project root as `INSTRUCTIONS.md` so Replit AI automatically references it. Every code generation, bug fix, or feature addition MUST follow this document.

---

## 1. PROJECT IDENTITY

**VesselPDA** is a B2B maritime SaaS platform connecting ship agents, shipowners, brokers, and service providers. It digitises port call operations in Turkey with plans for global expansion.

- **Live URL**: vesselpda.com (deployed on Replit)
- **Repository**: github.com/selimKaptan/VesselPDA
- **Owner**: Selim Kaptan — Barbaros Shipping (İzmir, Turkey)
- **Language**: English UI with Turkish maritime terms where industry-standard

---

## 2. TECH STACK (EXACT — DO NOT CHANGE)

| Layer | Technology | Version/Notes |
|-------|-----------|---------------|
| **Frontend** | React 18 + TypeScript | Single-page app, NOT Next.js |
| **Routing** | Wouter | `<Switch>` / `<Route>` — NOT react-router |
| **State** | TanStack React Query | `queryClient` in `client/src/lib/queryClient.ts` |
| **Styling** | Tailwind CSS + shadcn/ui | Components in `client/src/components/ui/` |
| **Backend** | Express.js + TypeScript | NOT NestJS. Modular routes under `server/routes/` |
| **ORM** | Drizzle ORM | Schema in `shared/schema.ts`, config in `drizzle.config.ts` |
| **Database** | PostgreSQL | Connection via `server/db.ts` (pool + drizzle instance) |
| **Build** | Vite | Config in `vite.config.ts` |
| **Auth** | Custom email/password + sessions | `server/replit_integrations/auth/` — bcrypt + express-session |
| **Validation** | Zod + drizzle-zod | `createInsertSchema()` for each table |
| **Email** | Resend API | `server/email.ts` |
| **AI Chat** | Anthropic Claude API | `server/anthropic.ts` |
| **AIS Data** | AIS Stream WebSocket | `server/ais-stream.ts` + mock fallback |
| **Exchange Rates** | TCMB (Turkish Central Bank) | `server/exchange-rates.ts` |
| **Freight Data** | Trading Economics API + Yahoo Finance fallback | `server/routes/market.routes.ts` |
| **i18n** | Custom implementation | `client/src/lib/i18n.tsx` |
| **Theme** | Dark/light with ThemeProvider | `client/src/components/theme-provider.tsx` |
| **WebSocket** | Socket.io | `server/websocket.ts` — real-time messaging & notifications |
| **Payment** | İyzico (iyzipay) | `server/payment.ts` — sandbox/production |
| **PDF** | PDFKit | `server/proforma-pdf.ts` — PDA & SOF & FDA PDF export |

### CRITICAL RULES
- **NEVER** add Next.js, NestJS, Prisma, react-router, or MongoDB
- **NEVER** replace Wouter with react-router
- **NEVER** replace Drizzle with Prisma or TypeORM
- **ALWAYS** add new routes inside `server/routes/` in the appropriate module file, then mount in `server/routes.ts`
- **ALWAYS** use `pgTable` from `drizzle-orm/pg-core` for new tables
- **ALWAYS** use `createInsertSchema` from `drizzle-zod` for validation
- **ALWAYS** use shadcn/ui components from `@/components/ui/`

---

## 3. PROJECT STRUCTURE

```
├── client/
│   └── src/
│       ├── App.tsx              # Main app with Wouter routing
│       ├── main.tsx             # Entry point
│       ├── components/
│       │   ├── ui/              # shadcn/ui components (DO NOT EDIT)
│       │   ├── dashboards/      # Role-specific dashboards
│       │   ├── layout/          # AppLayout, sidebar
│       │   ├── ai-chat.tsx      # AI assistant widget
│       │   ├── app-sidebar.tsx  # Navigation sidebar
│       │   ├── notification-bell.tsx
│       │   ├── feedback-widget.tsx
│       │   └── port-weather-panel.tsx
│       ├── hooks/
│       │   ├── use-auth.ts      # Authentication hook
│       │   ├── use-toast.ts     # Toast notifications
│       │   └── use-mobile.tsx   # Mobile detection
│       ├── lib/
│       │   ├── queryClient.ts   # TanStack Query setup
│       │   ├── utils.ts         # Utility functions
│       │   ├── i18n.tsx         # Internationalization
│       │   └── auth-utils.ts    # Auth helper functions
│       └── pages/               # 40+ page components
├── server/
│   ├── index.ts                 # Server entry + WebSocket init (httpServer)
│   ├── routes.ts                # Route registry — registerRoutes() mounts all modules
│   ├── routes/                  # MODULAR ROUTE FILES
│   │   ├── shared.ts            # Shared middleware, rate limiters, helpers
│   │   ├── auth.routes.ts       # Login, register, verify, reset, demo
│   │   ├── vessel.routes.ts     # Vessels, certificates, crew
│   │   ├── port.routes.ts       # Ports, port-info, service-ports
│   │   ├── proforma.routes.ts   # Proformas, calculate, PDF export
│   │   ├── tender.routes.ts     # Tenders, bids, nomination
│   │   ├── voyage.routes.ts     # Voyages, checklists, documents, chat, reviews
│   │   ├── message.routes.ts    # Conversations, messages, unread count
│   │   ├── nomination.routes.ts # Direct nominations
│   │   ├── commercial.routes.ts # Fixtures, laytime, cargo positions, invoices
│   │   ├── directory.routes.ts  # Directory, reviews, endorsements
│   │   ├── company.routes.ts    # Company profiles, logo, verification
│   │   ├── forum.routes.ts      # Forum categories, topics, replies, likes
│   │   ├── market.routes.ts     # Freight indices, bunker prices, exchange rates
│   │   ├── tracking.routes.ts   # AIS vessel tracking, watchlist, fleets, sanctions
│   │   ├── sof.routes.ts        # Statement of Facts CRUD + PDF
│   │   ├── fda.routes.ts        # Final Disbursement Account CRUD + PDF
│   │   ├── notification.routes.ts # Notifications, feedback, contact
│   │   ├── service-request.routes.ts # Service requests, offers
│   │   ├── payment.routes.ts    # İyzico checkout, callback, status
│   │   ├── admin.routes.ts      # All admin endpoints
│   │   ├── misc.routes.ts       # Invoices, document templates, port alerts, certificates
│   │   └── ai.routes.ts         # AI chat
│   ├── websocket.ts             # Socket.io server — real-time events
│   ├── payment.ts               # İyzico payment gateway
│   ├── proforma-pdf.ts          # PDA PDF generator (PDFKit)
│   ├── storage.ts               # Database CRUD operations
│   ├── db.ts                    # PostgreSQL connection
│   ├── email.ts                 # Resend email functions
│   ├── anthropic.ts             # AI chat handler
│   ├── ais-stream.ts            # AIS WebSocket + mock fallback + auto-reconnect
│   ├── exchange-rates.ts        # TCMB exchange rates
│   ├── proforma-calculator.ts   # PDA calculation engine
│   ├── tariff-lookup.ts         # Port tariff lookups
│   ├── laytime-calculator.ts    # Laytime/demurrage calculator
│   ├── sanctions.ts             # Sanctions screening
│   ├── audit.ts                 # Audit logging
│   ├── error-handler.ts         # AppError, NotFoundError, ValidationError classes
│   ├── file-storage.ts          # File upload to disk storage (replaces base64)
│   ├── middleware/
│   │   └── role-guard.ts        # RBAC middleware
│   └── seed.ts, seed-tariffs.ts, seed-templates.ts
├── shared/
│   ├── schema.ts               # ALL Drizzle table definitions
│   └── models/
│       ├── auth.ts             # User & company profile tables
│       └── chat.ts             # Chat models
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
├── package.json
└── INSTRUCTIONS.md              # THIS FILE
```

---

## 4. USER ROLES & RBAC

### Role Types
| Role | Description | Key Permissions |
|------|------------|-----------------|
| `admin` | Platform administrator (Selim) | Full CRUD, user management, tariff management, announcements |
| `shipowner` | Vessel owners/operators | Create tenders, manage vessels/voyages, create proformas |
| `agent` | Ship agents | Bid on tenders, manage voyages, company profiles |
| `broker` | Ship brokers | Create fixtures, cargo positions, tenders |
| `provider` | Service providers | Respond to service requests, company profiles |

### Auth Flow
1. User registers with email/password → verification email sent
2. After email verification → role selection page (`/role-selection`)
3. Once `roleConfirmed = true` → access to authenticated routes
4. Admin has `activeRole` field to switch between roles for testing

### Middleware
- `isAuthenticated` — checks session, attaches `req.user`
- `requireRole("agent", "admin")` — role-based access guard
- `isAdmin(req)` — checks if user is admin role
- Admin bootstrap: only `selim@barbarosshipping.com` can self-promote to admin

### Subscription Plans
| Plan | Proforma Limit |
|------|---------------|
| `free` | 1 |
| `standard` | 10 |
| `unlimited` | 999999 |

---

## 5. DATABASE SCHEMA

### Core Tables (in `shared/schema.ts`)

**Users & Auth** (in `shared/models/auth.ts`):
- `users` — id (varchar UUID), email, passwordHash, firstName, lastName, userRole, activeRole, subscriptionPlan, proformaLimit, proformaCount, emailVerified, roleConfirmed, isSuspended
- `companyProfiles` — userId, companyName, companyType, servedPorts (jsonb int[]), serviceTypes (jsonb string[]), isApproved, isActive, isFeatured, verificationStatus, logoUrl, taxNumber, mtoRegistrationNumber

**Maritime Operations**:
- `vessels` — userId, companyProfileId, name, flag, vesselType, grt, nrt, dwt, loa, beam, imoNumber, callSign, fleetStatus
- `ports` — name, country, code (UN/LOCODE), currency, latitude, longitude
- `voyages` — userId, vesselId, portId, agentUserId, tenderId, status (planned/in_progress/completed/cancelled), eta, etd, purposeOfCall
- `voyageChecklists` — voyageId, title, isCompleted, assignedTo (both/agent/owner)
- `voyageDocuments` — voyageId, name, docType, fileBase64, version, signatureText, signedAt, templateId
- `voyageReviews` — voyageId, reviewerUserId, revieweeUserId, rating (1-5), comment
- `voyageChatMessages` — voyageId, senderId, content
- `portCallAppointments` — voyageId, appointmentType, scheduledAt, status, confirmedBy

**Tender System** (Port Call Tender):
- `portTenders` — userId, portId, vesselName, grt, nrt, flag, cargoType, cargoQuantity, previousPort, expiryHours (24/48), status (open/closed/nominated/cancelled), nominatedAgentId
- `tenderBids` — tenderId, agentUserId, agentCompanyId, proformaPdfBase64, totalAmount, currency, status (pending/selected/rejected)

**Proforma/PDA System**:
- `proformas` — userId, vesselId, portId, referenceNumber, lineItems (jsonb), totalUsd, totalEur, exchangeRate, status (draft/sent/approved), bankDetails (jsonb)
- `tariffCategories` — portId, name, calculationType, baseUnit, currency
- `tariffRates` — categoryId, minGrt, maxGrt, rate, perUnit

**Tariff Lookup Tables** (raw SQL, not in schema.ts):
- `pilotage_tariffs`, `external_pilotage_tariffs`, `berthing_tariffs`
- `agency_fees`, `marpol_tariffs`, `port_authority_fees`
- `lcb_tariffs`, `tonnage_tariffs`, `other_services`
- `cargo_handling_tariffs`, `light_dues`
- `chamber_of_shipping_fees`, `chamber_freight_share`
- `harbour_master_dues`, `sanitary_dues`, `vts_fees`
- `supervision_fees`, `misc_expenses`
- `custom_tariff_sections`, `custom_tariff_entries`

**Commercial**:
- `fixtures` — userId, status, vesselName, cargoType, loadingPort, dischargePort, laycanFrom/To, freightRate, charterer, shipowner, brokerCommission, recapText
- `laytime_calculations` — fixtureId, portCallType, allowedLaytimeHours, norStartedAt, timeUsedHours, demurrageAmount, despatchAmount
- `cargoPositions` — userId, positionType (cargo/vessel), title, loadingPort, dischargePort, laycanFrom/To, status
- `invoices` — voyageId, proformaId, title, amount, currency, status (pending/paid/cancelled), invoiceType

**Directory & Reviews**:
- `agentReviews` — companyProfileId, reviewerUserId, tenderId, rating (1-5), vesselName, portName
- `endorsements` — fromUserId, toCompanyProfileId, relationship, message

**Messaging**:
- `conversations` — user1Id, user2Id, voyageId, serviceRequestId, externalEmail, externalEmailForward
- `messages` — conversationId, senderId, content, isRead, messageType (text/file), fileUrl, fileName, mentions
- `directNominations` — nominatorUserId, agentUserId, portId, vesselName, status (pending/accepted/declined)

**Service Marketplace**:
- `serviceRequests` — requesterId, portId, voyageId, vesselName, serviceType, description, quantity, status (open/assigned/completed)
- `serviceOffers` — serviceRequestId, providerUserId, providerCompanyId, price, currency, status (pending/selected/rejected)

**Vessel Management**:
- `vesselCertificates` — vesselId, name, certType, issuedAt, expiresAt, issuingAuthority, status
- `vesselCrew` — vesselId, firstName, lastName, rank, nationality, passportNumber, passportExpiry, seamansBookNumber
- `vesselWatchlist` — userId, mmsi, imo, vesselName

**Fleet Management** (raw SQL):
- `fleets` — userId, name, description, color, isActive
- `fleet_vessels` — fleetId, vesselId

**SOF (Statement of Facts)**:
- `statement_of_facts` — voyageId, vesselId, portId, userId, vesselName, portName, berthName, cargoType, cargoQuantity, operation (loading/discharging/both), masterName, agentName, status (draft/finalized/signed), remarks
- `sof_events` — sofId, eventType, eventName, eventDate, remarks, isDeductible, deductibleHours, sortOrder

**FDA (Final Disbursement Account)**:
- `fda_accounts` — userId, proformaId, voyageId, vesselId, portId, referenceNumber, vesselName, portName, lineItems (jsonb FdaLineItem[]), totalEstimatedUsd, totalActualUsd, totalEstimatedEur, totalActualEur, varianceUsd, variancePercent, exchangeRate, status (draft/pending_approval/approved/sent), bankDetails, approvedBy, approvedAt

**Other**:
- `vessel_positions` — mmsi, latitude, longitude, speed, course, heading, timestamp
- `forumCategories`, `forumTopics`, `forumReplies`, `forumLikes`, `forumDislikes`
- `notifications` — userId, type, title, message, link, isRead
- `feedbacks` — userId, category, message, pageUrl
- `bunkerPrices` — portName, region, ifo380, vlsfo, mgo
- `documentTemplates` — name, category, content (HTML with {{placeholders}}), isBuiltIn
- `portAlerts` — portId, portName, alertType, severity, title, message, isActive
- `audit_logs` — userId, action, entityType, entityId, metadata, ipAddress

---

## 6. API ENDPOINT MAP

All routes are registered via modular files in `server/routes/`. Auth middleware: `isAuthenticated`.

### Public Endpoints (no auth)
```
GET  /api/ports                      — List/search ports
GET  /api/ports/:id                  — Port details
GET  /api/port-info/:locode          — Extended port info (RapidAPI + Nominatim)
GET  /api/exchange-rates             — TCMB USD/EUR/TRY rates
GET  /api/directory                  — Public company directory
GET  /api/directory/featured         — Featured companies
GET  /api/directory/:id              — Company profile detail
GET  /api/reviews/:companyProfileId  — Agent reviews
GET  /api/service-ports              — Ports with service providers
GET  /api/stats                      — Public platform stats
GET  /api/activity-feed              — Recent platform activity
GET  /api/forum/categories           — Forum categories
GET  /api/forum/topics               — Forum topics (with pagination)
GET  /api/forum/topics/:id           — Topic detail + replies
GET  /api/port-alerts                — Active port alerts
POST /api/contact                    — Contact form
POST /api/demo/login                 — Demo account login
```

### Vessel Management
```
GET    /api/vessels                   — User's vessels (admin sees all)
POST   /api/vessels                   — Create vessel
PATCH  /api/vessels/:id               — Update vessel
DELETE /api/vessels/:id               — Delete vessel
GET    /api/vessels/lookup?imo=       — IMO lookup (RapidAPI)
GET    /api/vessels/:vesselId/certificates — Vessel certificates
POST   /api/vessels/:vesselId/certificates
PATCH  /api/vessels/:vesselId/certificates/:id
DELETE /api/vessels/:vesselId/certificates/:id
GET    /api/certificates/expiring?days= — Expiring certificates
GET    /api/vessels/:vesselId/crew    — Crew list
POST   /api/vessels/:vesselId/crew
PATCH  /api/vessels/:vesselId/crew/:id
DELETE /api/vessels/:vesselId/crew/:id
```

### Proforma/PDA
```
GET    /api/proformas                 — User's proformas
GET    /api/proformas/:id             — Proforma detail
POST   /api/proformas                 — Create proforma
DELETE /api/proformas/:id             — Delete proforma
POST   /api/proformas/:id/duplicate   — Duplicate proforma
POST   /api/proformas/:id/send-email  — Send proforma via email
POST   /api/proformas/calculate       — Full tariff calculation
POST   /api/proformas/quick-estimate  — Quick estimate (supports external vessels)
GET    /api/proformas/:id/pdf         — Download proforma PDF
GET    /api/proformas/:id/pdf/preview — Preview proforma PDF (inline)
```

### Tender System
```
GET    /api/tenders                   — Role-based tender list
POST   /api/tenders                   — Create tender (shipowner/broker)
GET    /api/tenders/:id               — Tender detail + bids
DELETE /api/tenders/:id               — Cancel tender
GET    /api/tenders/my-bids           — Agent's bid history
GET    /api/tenders/badge-count       — Unread tender badge
POST   /api/tenders/:id/bids          — Submit bid (agent)
POST   /api/tenders/:id/bids/:bidId/select — Select winning bid
GET    /api/tenders/:id/bids/:bidId/pdf    — Download bid PDF
POST   /api/tenders/:id/nominate      — Confirm nomination → auto-creates voyage + conversation
GET    /api/tenders/:id/voyage        — Get voyage linked to tender
```

### Voyages
```
GET    /api/voyages                   — User's voyages (role-aware)
POST   /api/voyages                   — Create voyage
GET    /api/voyages/:id               — Voyage detail
PATCH  /api/voyages/:id               — Update voyage (ETA change notifies counterparty)
PATCH  /api/voyages/:id/status        — Update status
POST   /api/voyages/:id/checklist     — Add checklist item
PATCH  /api/voyages/:id/checklist/:itemId — Toggle checklist
DELETE /api/voyages/:id/checklist/:itemId
GET    /api/voyages/:id/documents     — Voyage documents
POST   /api/voyages/:id/documents     — Upload document
DELETE /api/voyages/:id/documents/:docId
POST   /api/voyages/:id/documents/from-template — Create from template
POST   /api/voyages/:id/documents/:docId/sign   — Digital signature
POST   /api/voyages/:id/documents/:docId/new-version — Version control
GET    /api/voyages/:id/chat          — Voyage chat messages
POST   /api/voyages/:id/chat          — Send chat message
GET    /api/voyages/:id/reviews       — Voyage reviews
POST   /api/voyages/:id/reviews       — Submit review
GET    /api/voyages/:voyageId/appointments — Port call appointments
POST   /api/voyages/:voyageId/appointments
PATCH  /api/voyages/:voyageId/appointments/:id
DELETE /api/voyages/:voyageId/appointments/:id
```

### Service Requests
```
GET    /api/service-requests          — Role-aware (requester vs provider)
POST   /api/service-requests          — Create request
GET    /api/service-requests/:id      — Detail with offers
POST   /api/service-requests/:id/offers — Submit offer (provider)
POST   /api/service-requests/:id/offers/:offerId/select — Accept offer
PATCH  /api/service-requests/:id/status
```

### Messaging
```
GET    /api/messages                  — Conversations list
POST   /api/messages/start            — Start new conversation
GET    /api/messages/:conversationId  — Conversation with messages
POST   /api/messages/:conversationId/send — Send message (supports files + @mentions)
PATCH  /api/messages/:conversationId/read — Mark read
GET    /api/messages/unread-count
PATCH  /api/conversations/:convId/external-email — Email bridge config
```

### Nominations
```
GET    /api/nominations               — Sent + received nominations
POST   /api/nominations               — Create direct nomination
GET    /api/nominations/:id
PATCH  /api/nominations/:id/respond   — Accept/decline
GET    /api/nominations/pending-count
```

### Commercial
```
GET    /api/fixtures                  — Fixtures list
POST   /api/fixtures                  — Create fixture
GET    /api/fixtures/:id
PATCH  /api/fixtures/:id
DELETE /api/fixtures/:id
GET    /api/fixtures/:id/laytime      — Laytime calculations
POST   /api/fixtures/:id/laytime
PUT    /api/laytime/:id
DELETE /api/laytime/:id
GET    /api/cargo-positions           — All active positions
GET    /api/cargo-positions/mine      — My positions
POST   /api/cargo-positions
PATCH  /api/cargo-positions/:id
DELETE /api/cargo-positions/:id
```

### Vessel Tracking
```
GET  /api/vessel-track/status         — AIS connection status
GET  /api/vessel-track/positions      — All vessel positions
GET  /api/vessel-track/search?q=      — Search vessels
GET  /api/vessel-track/fleet          — User's fleet positions
GET  /api/vessel-track/agency-vessels — Agent's nominated vessels
GET  /api/vessel-track/watchlist      — Watchlist
POST /api/vessel-track/watchlist
DELETE /api/vessel-track/watchlist/:id
GET  /api/vessel-track/history/:mmsi  — Track history (GeoJSON)
GET  /api/vessel-positions/:mmsi      — Position history
GET  /api/vessel-positions/:mmsi/latest
```

### Market Data
```
GET  /api/market/freight-indices      — BDI, BCTI, BDTI (4h cache)
GET  /api/market/bunker-prices        — Bunker fuel prices
```

### SOF (Statement of Facts)
```
GET    /api/sof                       — SOF list (user's or all for admin)
POST   /api/sof                       — Create SOF (13 default events auto-added)
GET    /api/sof/:id                   — SOF detail + events
PATCH  /api/sof/:id                   — Update SOF fields
DELETE /api/sof/:id                   — Delete SOF
POST   /api/sof/:id/finalize          — Finalize SOF (locks to read-only)
POST   /api/sof/:id/events            — Add custom event
PATCH  /api/sof/events/:eventId       — Update event (date, remarks, deductible flag)
DELETE /api/sof/events/:eventId       — Delete event
GET    /api/sof/:id/pdf               — Export SOF as PDF (PDFKit)
```

### FDA (Final Disbursement Account)
```
GET    /api/fda                       — FDA list (user's or all for admin)
POST   /api/fda                       — Create FDA (from proforma or blank)
GET    /api/fda/:id                   — FDA detail with line items
PATCH  /api/fda/:id                   — Update FDA (actual amounts → auto-calculates variance)
DELETE /api/fda/:id                   — Delete FDA
POST   /api/fda/:id/approve           — Approve FDA (locks to read-only)
GET    /api/fda/:id/pdf               — Export FDA as PDF (PDFKit)
```

### Payment
```
POST   /api/payment/checkout          — İyzico checkout form init
POST   /api/payment/callback          — İyzico 3D callback handler
GET    /api/payment/status            — Current subscription plan status
POST   /api/subscription/upgrade      — Upgrade subscription plan
```

### Other
```
GET    /api/agent-stats/:companyProfileId — Agent performance stats
GET    /api/trust-score/:userId       — Trust score calculation
POST   /api/reviews                   — Submit agent review
GET    /api/endorsements/:companyProfileId
POST   /api/endorsements
DELETE /api/endorsements/:id
GET    /api/fleets                    — Fleet management
POST   /api/fleets
PUT    /api/fleets/:id
DELETE /api/fleets/:id
POST   /api/fleets/:id/vessels
DELETE /api/fleets/:id/vessels/:vesselId
GET    /api/sanctions/check?name=     — Sanctions screening
GET    /api/document-templates        — Available templates
GET    /api/invoices                  — User's invoices
POST   /api/invoices
PATCH  /api/invoices/:id/pay
PATCH  /api/invoices/:id/cancel
GET    /api/notifications
POST   /api/notifications/read-all
POST   /api/notifications/:id/read
POST   /api/feedback
POST   /api/ai/chat                   — AI assistant
PATCH  /api/user/role
GET    /api/company-profile/me
POST   /api/company-profile
PATCH  /api/company-profile/:id
POST   /api/company-profile/logo
DELETE /api/company-profile/logo
POST   /api/company-profile/request-verification
POST   /api/files/upload              — Generic file upload
```

### Admin Endpoints (all require admin role)
```
GET    /api/admin/stats               — Platform statistics
GET    /api/admin/stats/enhanced      — Advanced stats
GET    /api/admin/activity            — Activity feed
GET    /api/admin/reports/user-growth — Monthly growth report
GET    /api/admin/reports/active-users — Most active users
GET    /api/admin/users               — All users
POST   /api/admin/users               — Create user
PATCH  /api/admin/users/:id/plan      — Change subscription
PATCH  /api/admin/users/:id/suspend   — Suspend/unsuspend
PATCH  /api/admin/users/:id/verify-email — Manual email verify
PATCH  /api/admin/users/:id/role      — Change user role
DELETE /api/admin/users/:id           — Delete user
GET    /api/admin/users/:id/activity  — User activity log
GET    /api/admin/company-profiles    — All company profiles
GET    /api/admin/companies/pending   — Pending approval
POST   /api/admin/companies/:id/approve
DELETE /api/admin/companies/:id/reject
GET    /api/admin/pending-verifications
POST   /api/admin/verify-company/:profileId
POST   /api/admin/announce            — Send announcement to users
GET    /api/admin/voyages             — All voyages
GET    /api/admin/service-requests-list
GET    /api/admin/feedback            — All feedback
GET    /api/admin/geocode-status      — Port geocoding status
POST   /api/admin/cleanup-ports       — Clean duplicate ports
GET    /api/admin/tariffs/summary     — Tariff database overview
GET    /api/admin/tariffs/:table      — List tariff records
POST   /api/admin/tariffs/:table      — Create tariff
PATCH  /api/admin/tariffs/:table/:id  — Update tariff
DELETE /api/admin/tariffs/:table/:id  — Delete tariff
DELETE /api/admin/tariffs/:table/clear — Clear table for port
POST   /api/admin/tariffs/:table/bulk-increase — % increase
POST   /api/admin/tariffs/:table/bulk-copy-year — Copy to new year
GET    /api/admin/tariff-custom-sections
POST   /api/admin/tariff-custom-sections
DELETE /api/admin/tariff-custom-sections/:id
GET/POST/PATCH/DELETE /api/admin/tariff-custom-sections/:id/entries
GET    /api/admin/port-alerts         — All alerts (incl inactive)
POST   /api/port-alerts               — Create alert
PATCH  /api/port-alerts/:id
DELETE /api/port-alerts/:id
POST   /api/admin/bunker-prices       — Upsert bunker price
PATCH  /api/admin/bunker-prices/:id
DELETE /api/admin/bunker-prices/:id
POST   /api/exchange-rates/refresh    — Force TCMB refresh
GET    /api/admin/audit-logs          — Audit trail
POST   /api/admin/bootstrap           — Admin self-promotion (selim@barbarosshipping.com only)
PATCH  /api/admin/active-role         — Switch admin's active role
GET    /api/sanctions/status          — Sanctions list status
```

---

## 7. FRONTEND ROUTING

Router: **Wouter** (`<Switch>` / `<Route>` from `"wouter"`)

### Public Routes (no auth)
```
/                    → Landing page
/login               → Email/password login
/register            → Registration
/verify-email        → Email verification
/forgot-password     → Password reset request
/reset-password      → Password reset form
/directory           → Public company directory
/directory/:id       → Public company profile
```

### Authenticated Routes
```
/dashboard           → Role-specific dashboard
/vessels             → Vessel management
/proformas           → Proforma list
/proformas/:id       → Proforma detail + send + FDA creation
/tenders             → Tender board
/tenders/:id         → Tender detail + bidding
/voyages             → Voyage management
/voyages/:id         → Voyage detail (checklist, docs, chat, reviews)
/service-requests    → Service marketplace
/messages            → Messaging hub
/nominations         → Direct nominations
/fixtures            → Fixture management
/cargo-positions     → Cargo & Position Board
/vessel-track        → AIS vessel tracking map
/forum               → Community forum
/company-profile     → My company profile
/market              → Market data (indices, bunker)
/sof                 → Statement of Facts list
/sof/:id             → SOF detail (timeline event view)
/fda                 → Final Disbursement Account list
/fda/:id             → FDA detail (estimated vs actual comparison view)
/admin               → Admin panel (admin only)
/settings            → Account settings
```

---

## 8. BUSINESS LOGIC — KEY WORKFLOWS

### 8.1 Tender → Nomination → Voyage Flow
```
1. Shipowner creates tender (port, vessel info, cargo, 24/48h expiry)
2. Agents serving that port see the tender and submit bids (with optional PDF proforma)
3. Shipowner reviews bids → selects one → other bids auto-rejected
4. Shipowner confirms nomination → email sent to agent
5. System auto-creates:
   a. Voyage record linking shipowner + agent
   b. Conversation between parties
6. Both parties manage voyage: checklists, documents, chat, appointments
7. After completion: mutual reviews (affects trust score)
```

### 8.2 Proforma Calculation Engine
```
1. User selects vessel + port + parameters (berth days, cargo, etc.)
2. System looks up tariffs from 18+ tariff tables for that port
3. Falls back to formula-based estimates if no DB tariff exists
4. Calculates: pilotage, tugboat, mooring, berthing, agency, MARPOL,
   LCB, sanitary dues, chamber fees, light dues, supervision, misc
5. Returns line items + totals in USD and EUR
6. User can save as proforma → send via email → track status
```

### 8.3 Quick Estimate
- Same as full calculation but supports external vessels (no DB vessel required)
- Auto-detects Turkish/foreign flag → appropriate tariff category
- Returns `tariffSource: "database"` or `"estimate"` to indicate data quality

### 8.4 Trust Score
Composite score from: completed voyages, success rate, average rating (agent reviews + voyage reviews), bid win rate.

### 8.5 Company Verification
```
1. Agent/provider submits: tax number, MTO registration, P&I club
2. Admin reviews → approves/rejects
3. Verified badge shown in directory
```

### 8.6 PDA to FDA Flow
```
1. Agent/shipowner creates proforma (PDA) for estimated port costs
2. After voyage completion → "Create FDA from PDA" button on proforma detail
3. Proforma estimated line items are auto-imported into the FDA
4. User enters actual costs (actual amounts) for each line item
5. System auto-calculates variance: actual − estimated and as %
6. Positive variance = over budget (shown in red), negative = savings (shown in green)
7. FDA is approved → locked read-only → PDF exported → sent to shipowner
```

### 8.7 SOF Flow
```
1. Agent creates SOF when vessel arrives at port (linked to voyage or standalone)
2. 13 standard port call events are auto-added (vessel arrived, NOR tendered, all fast, etc.)
3. Agent updates event date/times in real-time as operations progress
4. Custom events can be added (rain delay, breakdown, shift change, etc.)
5. Events that don't count toward laytime are flagged as "deductible"
6. SOF is finalized (locked read-only) → PDF exported → distributed to all parties
```

### 8.8 WebSocket Real-time Events
```
message:new          — New direct message (emitted to all conversation participants)
voyage:chat:new      — New message in voyage chat
notification:new     — In-app notification (tender bid, nomination, service offer)
typing:start         — User started typing in conversation
typing:stop          — User stopped typing
```

---

## 9. ENVIRONMENT VARIABLES

```env
# Required
DATABASE_URL=postgresql://...
SESSION_SECRET=...

# Email
RESEND_API_KEY=re_...

# AI
ANTHROPIC_API_KEY=sk-ant-...

# AIS Tracking
AIS_STREAM_API_KEY=...

# Vessel Lookup (RapidAPI)
VESSEL_API_KEY=...

# Market Data (optional)
TRADING_ECONOMICS_API_KEY=...

# Exchange Rates
# (TCMB is free, no key needed)

# Payment (İyzico)
IYZICO_API_KEY=sandbox-...
IYZICO_SECRET_KEY=sandbox-...
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

# App
APP_URL=https://vesselpda.com
```

---

## 10. UI/UX DESIGN SYSTEM

### Theme Colors (Dark Maritime)
```
Primary Background: #0B1120 (deep navy)
Secondary Background: #1A2744 (panel blue)
Accent: #38BDF8 (sky blue)
Success: #22C55E
Warning: #F59E0B
Danger: #EF4444
Text Primary: #F1F5F9
Text Secondary: #94A3B8
```

### Component Patterns
- Use `<Card>` from shadcn for content panels
- Use `<Badge>` for status indicators
- Use `<Dialog>` for modals, NOT separate pages
- Use `<Sheet>` for mobile sidebars
- Use `<Tabs>` for section switching within pages
- Toast notifications via `useToast()` hook
- Loading states: `<Skeleton>` components
- Error boundary: `<ErrorBoundary>` wraps authenticated routes

### Dashboard Pattern
Each role has a specific dashboard component:
- `shipowner-dashboard.tsx` — vessels, tenders, voyages overview
- `agent-dashboard.tsx` — bids, nominations, service requests
- `provider-dashboard.tsx` — service requests, offers
- `admin-dashboard.tsx` — platform stats, pending approvals

---

## 11. NOTIFICATION SYSTEM

Notifications are created server-side via `storage.createNotification()` and displayed via `<NotificationBell>` component.

### Notification Types
```
forum_reply        — Someone replied to your topic
bid_received       — New bid on your tender
bid_selected       — Your bid was selected
nomination         — You were nominated
nomination_response — Agent responded to nomination
message            — New direct message
mention            — @mentioned in message
service_request    — New service request in your port
service_offer      — New offer on your request
service_offer_selected — Your offer accepted
eta_change         — ETA updated on voyage
cargo_match        — New cargo listing matching your fleet
system             — Admin announcements
```

### Email Notifications (via Resend)
Sent for: nominations, nomination responses, bid received, bid selected, new tenders, forum replies, proforma delivery, contact form.

---

## 12. ADDING NEW FEATURES — CHECKLIST

When adding a new feature, follow this order:

### Step 1: Database Schema
```typescript
// In shared/schema.ts
export const newTable = pgTable("new_table", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  // ... fields
  createdAt: timestamp("created_at").defaultNow(),
});

export const newTableRelations = relations(newTable, ({ one }) => ({
  user: one(users, { fields: [newTable.userId], references: [users.id] }),
}));

export const insertNewTableSchema = createInsertSchema(newTable).omit({ id: true, createdAt: true });
export type InsertNewTable = z.infer<typeof insertNewTableSchema>;
export type NewTable = typeof newTable.$inferSelect;
```

### Step 2: Storage Layer
```typescript
// In server/storage.ts — add CRUD methods to DatabaseStorage class
async getNewItems(userId: string): Promise<NewTable[]> { ... }
async createNewItem(data: InsertNewTable): Promise<NewTable> { ... }
```

### Step 3: API Routes
```typescript
// Add endpoints to the appropriate module file in server/routes/
// For example, vessel-related routes go in server/routes/vessel.routes.ts
router.get("/api/new-items", isAuthenticated, async (req: any, res) => { ... });
router.post("/api/new-items", isAuthenticated, async (req: any, res) => { ... });

// If creating a new module, mount it in server/routes.ts registerRoutes():
import newRouter from "./routes/new.routes";
app.use("/api/new-items", newRouter);
```

### Step 4: Frontend Page
```tsx
// In client/src/pages/new-feature.tsx
// Use TanStack Query for data fetching:
const { data, isLoading } = useQuery({
  queryKey: ["/api/new-items"],
  queryFn: () => fetch("/api/new-items").then(r => r.json()),
});
```

### Step 5: Add Route
```tsx
// In client/src/App.tsx — add to AuthenticatedRouter
<Route path="/new-feature" component={NewFeature} />
```

### Step 6: Add Navigation
```tsx
// In client/src/components/app-sidebar.tsx — add menu item
```

### Step 7: Run Migration
```bash
# NEVER use npm run db:push --force
# Use psql $DATABASE_URL with CREATE TABLE IF NOT EXISTS for new tables
psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS new_table (...)"
```

---

## 13. COMMON PATTERNS IN CODEBASE

### API Call Pattern (Frontend)
```tsx
// GET
const { data, isLoading } = useQuery({
  queryKey: ["/api/endpoint"],
});

// POST/PATCH/DELETE
const mutation = useMutation({
  mutationFn: (data) => fetch("/api/endpoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(r => r.json()),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/endpoint"] });
    toast({ title: "Success" });
  },
});
```

### Auth Check Pattern (Backend)
```typescript
router.get("/api/resource", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const user = await storage.getUser(userId);
  // Admin sees all, others see own
  if (user?.userRole === "admin") {
    return res.json(await storage.getAllResources());
  }
  res.json(await storage.getResourcesByUser(userId));
});
```

### File Storage Pattern
New uploads are saved to disk via `server/file-storage.ts` (`uploads/{category}/` directory). Old base64 records in the DB remain untouched (backward compatible). Static files are served via `/uploads/*`.

```typescript
// Save a file to disk instead of storing base64 in DB
import { saveBase64File } from "../file-storage";
const fileUrl = saveBase64File(base64Data, "certificates"); // → /uploads/certificates/uuid.pdf
```

### Notification Pattern
```typescript
await storage.createNotification({
  userId: targetUserId,
  type: "notification_type",
  title: "Title",
  message: "Description",
  link: "/relevant-page",
});
```

---

## 14. WHAT NOT TO DO

1. ❌ Don't add endpoints directly in `server/routes.ts` — add to the appropriate module file in `server/routes/`
2. ❌ Don't use Prisma — we use Drizzle ORM
3. ❌ Don't use react-router — we use Wouter
4. ❌ Don't add Next.js features (getServerSideProps, app router, etc.)
5. ❌ Don't store sensitive data in localStorage — use sessions
6. ❌ Don't create tables without relations and Zod schemas
7. ❌ Don't bypass `isAuthenticated` middleware for protected routes
8. ❌ Don't use `any` types without comment explaining why
9. ❌ Don't add npm packages without checking if shadcn/ui already provides it
10. ❌ Don't create separate CSS files — use Tailwind classes
11. ❌ Don't use `fetch()` with hardcoded URLs — always use relative paths `/api/...`
12. ❌ Don't create REST endpoints that don't follow existing patterns
13. ❌ Don't skip try-catch + `next(error)` — always forward errors to the global error handler
14. ❌ Don't skip Zod validation — use `insertSchema.safeParse()` on every POST/PATCH body
15. ❌ Don't store uploaded files as base64 in the DB — use `file-storage.ts` to save to disk

---

## 15. DEVELOPMENT PRIORITIES

### Phase 1 — Completed ✅
- SQL injection fix (parameterized queries) ✅
- Rate limiting (express-rate-limit) ✅
- Input validation (Zod middleware) ✅
- CORS configuration ✅
- Error handling (AppError + global handler) ✅
- N+1 query optimization + pagination ✅
- File storage migration (base64 → disk) ✅
- PDF export (proforma, SOF, FDA via PDFKit) ✅
- Payment integration (İyzico sandbox) ✅
- AIS API with auto-reconnect + mock fallback ✅
- WebSocket real-time (Socket.io) ✅
- SOF module (Statement of Facts) ✅
- FDA module (Final Disbursement Account) ✅
- Modular route architecture (22 route files) ✅
- Proforma calculator with tariff database ✅
- Tender system (create → bid → nominate) ✅
- Voyage management with documents ✅
- Company directory with verification ✅
- Forum community ✅
- Direct messaging + email bridge ✅
- Vessel tracking (AIS + mock) ✅
- Admin panel with full CRUD ✅

### Phase 2 — Next
- Redis cache layer
- Mobile responsive improvements
- Multi-port proforma comparison
- Dashboard charts (Recharts)
- Mapbox map integration improvements
- Test infrastructure (Vitest + Supertest)
- İyzico production activation

### Phase 3 — Future
- Port congestion tracking
- Advanced fixture management with CP terms
- Freight calculator with route optimization
- API documentation (Swagger/OpenAPI)
- Multi-language support (TR, EN)
- Automated tariff updates from official sources

---

## 16. IMPORTANT BUSINESS CONTEXT

### Turkish Maritime Terminology
- PDA = Proforma Disbursement Account (tahmini masraf hesabı)
- FDA = Final Disbursement Account (kesin masraf hesabı)
- SOF = Statement of Facts (durum raporu)
- NOR = Notice of Readiness (hazırlık bildirimi)
- GRT = Gross Register Tonnage
- NRT = Net Register Tonnage
- DWT = Deadweight Tonnage
- LOA = Length Overall
- ETA = Estimated Time of Arrival
- ETD = Estimated Time of Departure
- Laycan = Laydays & Cancelling (yükleme tarihi aralığı)
- Demurrage = Sürastarya (gecikme cezası)
- Despatch = Sürastarya iadesi (erken tamamlama primi)
- Cabotage = Kabotaj (domestic coastal trade)
- P&I = Protection & Indemnity (deniz sigortası)
- MTO = Maritime Transport Operator

### Key External APIs
| API | Purpose | Rate Limit |
|-----|---------|------------|
| TCMB | Exchange rates (USD, EUR, GBP) | Free, no key |
| AIS Stream | Real-time vessel positions | WebSocket, key required |
| RapidAPI Vessel Info | IMO vessel lookup | Key required |
| RapidAPI Port Info | Port details | Key required |
| Nominatim (OSM) | Port geocoding | 1 req/sec, free |
| Trading Economics | Freight indices (BDI, BCTI, BDTI) | Key required |
| Resend | Transactional emails | Key required |
| Anthropic | AI chat assistant | Key required |
| İyzico | Payment processing | Sandbox + Production |

---

*Last updated: March 2026 — Based on actual codebase analysis (580+ commits, 14 major improvements)*
