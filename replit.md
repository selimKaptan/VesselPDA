# VesselPDA - Maritime Platform

## Overview
VesselPDA is a professional web-based maritime platform designed to revolutionize interactions between ship agents, shipowners, and maritime service providers. Its primary purpose is to enable ship agents to generate instant proforma disbursement accounts efficiently and to connect shipowners with a comprehensive directory of maritime service providers. The platform aims to streamline maritime operations, enhance transparency, and foster a connected ecosystem within the shipping industry, ultimately becoming the leading digital hub for maritime professionals.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I would like to see the agent work through the problem step-by-step. I prefer clear and concise communication.

## System Architecture
The platform is built with a modern web stack, featuring a maritime-themed UI/UX with a deep blue color palette and a Glassmorphism Design System for floating UI components.

**Technical Implementations:**
- **Frontend**: React, Vite, Tailwind CSS, and Shadcn UI are used for a responsive and intuitive user interface.
- **Backend**: Express.js with PostgreSQL and Drizzle ORM handles data persistence and API logic.
- **Authentication**: Custom email/password authentication with email verification and session management.
- **User & Role Management**: A six-role system (Shipowner, Agent, Broker, Provider, Master, Admin) with granular permissions.
- **Vessel & Port Management**: Comprehensive tools for managing vessel data and port information.
- **Proforma Generation**: Formula-based proforma disbursement account generation with PDF export, live exchange rates, and a detailed quick estimate feature.
- **Company Profiles & Directory**: Verified company profiles and a comprehensive directory of maritime service providers.
- **Subscription System**: A 3-tier subscription model.
- **Vessel Tracking**: Live AIS vessel tracking using Mapbox GL JS.
- **Port Call & Voyage Management**: Systems for tendering port calls, managing voyages, and handling service requests.
- **Communication & Collaboration**: Features include a forum/discussion board, direct messaging, and a notification system.
- **Document Management**: Capabilities for managing various maritime documents.
- **Assessment & Reporting**: Mutual assessment features, Statement of Facts (SOF) module, Final Disbursement Account (FDA) module with variance calculation, and DA comparison reports.
- **Scheduling & Planning**: Vessel schedule calendar and a voyage invitation system.
- **Internationalization & Accessibility**: Support for multiple languages (TR/EN) and dark mode.
- **Navigation System**: An icon rail with an expandable panel, updated with a comprehensive IA overhaul including categories like Port Operations, Commercial, Fleet, Services & Directory, Finance, Workspace, and Intelligence.
- **Admin Tools**: Admin user management and an audit log system.
- **Specialized Modules**:
    - **Q88 Vessel Questionnaire Module**: A multi-tab form for vessel data, with auto-fill, PDF export, and sharing capabilities.
    - **Berthing Fees Formula System**: Dynamic calculation of berthing fees based on GT and flags.
    - **VTS Fees Lookup System**: Lookup of VTS fees based on NRT and vessel flag category.
    - **Harbour Master Dues System**: Complex calculation of harbour master dues based on service type and GRT.
    - **Cargo Operations Tab (Voyage Detail)**: A "Command Center" for managing cargo activities, including logging, tracking, and multi-receiver support.
    - **Crew Management Enhancements**: Comprehensive crew roster management, including medical fitness tracking, document uploads, and status filtering.
    - **Voyage Contacts Module**: Management of voyage-specific contacts with bulk paste functionality and integration with cargo report sending.
    - **Husbandry & Services Only Voyage Type**: A specialized UI for "Husbandry" voyages, featuring a "Logistics Control Tower" with Crew Logistics Board and Service Boat & Deliveries stepper.
    - **AI Smart Drop Module**: Document analysis using Claude-Haiku for detecting maritime events, with a drag-and-drop interface and action execution.
    - **Drag & Drop Hotel Reservation**: Crew cards are draggable (via @dnd-kit/core) onto the Hotel Hub panel; dropping opens a Quick Hotel Booking dialog for assigning hotel name and check-in/check-out dates.
    - **Crew Logistics Persistence**: `voyage_crew_logistics` DB table stores all crew board data (flight, hotel, OkToBoard, timeline, docs, etc.) per voyage. Frontend uses debounced auto-save (1s) via `PUT /api/voyages/:id/crew-logistics`; data loads via `useQuery` on page open. Save indicator shows "Kaydediliyor…" / "Kaydedildi" in board header.
    - **AI Human-in-the-Loop Verification**: AI natural language parsing (MODE 2) now stages suggestions instead of auto-applying; affected crew cards glow neon blue with inline ✓ Accept / ✕ Reject buttons per suggestion.
    - **Spotlight Focus Mode**: "⚠️ Action Required" filter activates a backdrop-blur overlay over the crew board; only action-required cards escape to z-20 foreground with pronounced glow.
    - **Voyages Cancelled Color Fix**: Cancelled-status voyage cards now show a neutral slate header strip instead of the purpose-of-call colour.
- **Security**: Helmet Content-Security-Policy headers are configured.
- **Demo System**: Server-side seeding for demo accounts, enabling immediate access to pre-populated data.
- **PDF Export System**: Reusable components for generating PDFs with consistent headers, footers, and company branding.

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **bcryptjs**: Used for secure password hashing.
- **AISStream.io**: Provides live AIS vessel tracking data.
- **RapidAPI (Zyla Labs Vessel Information API)**: Used for retrieving detailed vessel information.
- **Turkish Central Bank (TCMB)**: Source for live exchange rates.
- **Resend**: Transactional email service for various platform communications.
- **jsPDF + html2canvas**: Libraries for client-side PDF generation.
- **Mapbox GL JS**: Powers interactive maps for vessel tracking.
- **Anthropic AI**: Utilized for the AI Assistant (Claude-Haiku) in the AI Smart Drop module.
- **Yahoo Finance API**: Provides market data indices (BDI, BCTI, BDTI).