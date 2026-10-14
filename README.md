# GCC Connect — Secure Enterprise Workplace Platform
### Tailored for Zimmer Biomet Bangalore GCC Hub (Tender Drawing OST-ID-TD-ANSR-ZB-01)

[![Security Tests](https://img.shields.io/badge/Security%20Tests-10%2F10%20Passing-success)](file:///./packages/backend/tests/security-concurrency.test.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
[![PWA](https://img.shields.io/badge/PWA-Installable-purple)](https://web.dev/progressive-web-apps/)

**GCC Connect** is a unified, enterprise-grade workplace booking and employee experience platform built specifically for corporate Global Capability Centres (100–500 employees).

This implementation directly embeds the **Zimmer Biomet Bangalore GCC Layout Plan** (Drawing `OST-ID-TD-ANSR-ZB-01`), featuring all **184 Workstations** (`Z001` - `Z184`) across **11 functional departments**, executive cabins, video conference meeting suites, phone privacy pods, and the 46-seat cafeteria townhall area.

---

## 🏛️ System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Untrusted Client Surfaces                │
                    │  • Responsive Web & Installable PWA (React / Vite TS)  │
                    │  • Android & iOS Native Apps (React Native / Expo TS)  │
                    │  • Automated Scripts / Direct API Callers              │
                    └────────────────────────────────────────────────────────┘
                                                │ (HTTPS / Bearer JWT / HttpOnly)
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │           Security & Governance Gateway                │
                    │  • Sliding-Window Rate Limiters (IP, User, Endpoint)   │
                    │  • Helmet HTTP Headers & Strict CORS Isolation         │
                    │  • Zod Request Validation & Request Size Limits        │
                    │  • RBAC Authorization (6 Roles) & Anti-Self Elevation  │
                    └────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               Authoritative Backend                    │
                    │  • Concurrency-Safe Booking Engine (Zero Overlaps)     │
                    │  • Idempotency-Key Request Deduplication               │
                    │  • Physical QR Decoupling (Opaque IDs)                 │
                    │  • One-Time Cryptographic Tokens (SHA-256 Hashed)      │
                    │  • Privileged Server Notification Outbox               │
                    │  • Excel / CSV Bulk Roster Import (Dry-Run Preview)    │
                    │  • Structured Audit & Security Event Logger            │
                    └────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │          Authoritative Relational Database             │
                    │  • PostgreSQL 16 (Production) / pg-mem (Local Dev)     │
                    │  • Atomic Transactions, Foreign Keys & Check Limits    │
                    └────────────────────────────────────────────────────────┘
```

---

## 🪑 Seating Plan Breakdown (184 Workstations)

Mapped directly from the provided architectural layout and cost-centre seating assignment:

| Desk Range | Department / Team | Cost Centres | Workstations |
|---|---|---|---|
| **Z001 - Z005** | Manufacturing Engineering | GCC - Production – Ind Var – WARSAW Ops | 5 Seats |
| **Z006 - Z040** | Engineering Services team | GCC - R&D - CAD, Packaging & Labeling, Biocomp, Project Mgmt | 35 Seats |
| **Z041 - Z074** | Sustaining Engineering | GCC - Sustaining Engineering & Knee NPI | 34 Seats |
| **Z075 - Z086** | Robotics Engineering | GCC - Robotics Engineering (DTS) | 12 Seats |
| **Z087 - Z119** | Quality & Regulatory Affairs | Quality Montreal, Quality US, Winterthur, Regulatory Affairs | 33 Seats |
| **Z120 - Z149** | Information Technology | APAC IT, CISO & Corp Compliance, D&A, Global Infrastructure | 30 Seats |
| **Z150 - Z152** | Facilities, Transport | Facilities & Workplace Services | 3 Seats |
| **Z153 - Z168** | Procurement | GCC - G & A Purchasing & Direct Variable | 16 Seats |
| **Z169 - Z178** | Clinical Affairs | GCC - R&D - Clinical Affairs Internal | 10 Seats |
| **Z179 - Z182** | Human Resources | GCC - G&A HR - Talent Acquisition | 4 Seats |
| **Z183 - Z184** | Finance | GCC - G&A Finance - Controllership - APAC | 2 Seats |
| **Total** | **11 Functional GCC Divisions** | **Enterprise Zimmer Biomet Seating Table** | **184 Seats** |

### Meeting & Collaboration Spaces:
- **Meeting Room 1 (8 PAX):** Video Conference, 4K Display, Digital Whiteboard
- **Meeting Room 2 (8 PAX):** Video Conference, 4K Display, Digital Whiteboard
- **Meeting Room 3 (6 PAX):** Video Conference, Presentation Display
- **Executive Cabins 1 & 2:** Private leadership suites
- **Phone Privacy Booths (P.B 1 - 4):** Single-occupancy acoustic soundproof pods
- **Collab Spaces (North, South, Central):** Casual team collaboration zones
- **Cafeteria & Townhall (46 Seats):** Multi-purpose dining and company all-hands venue
- **Wellness & Mother's Room:** Private ergonomic rest space

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+ (Node 22 or 26 supported)
- npm 10+
- Zero external database installation required! (Runs with built-in transactional engine out-of-the-box).

### 1. Run Automated Security & Concurrency Tests
Verify all 10 security vectors (IDOR, double-booking race condition, OTP brute force, token redemption):
```bash
cd packages/backend
npm test
```

### 2. Start Authoritative Backend
```bash
cd packages/backend
npm run dev
```
* Backend runs on: `http://localhost:4000`
* Interactive OpenAPI Documentation: `http://localhost:4000/api/docs`
* Health Check: `http://localhost:4000/api/health`

### 3. Start Responsive Web & PWA
```bash
cd packages/web
npm run dev
```
* Open in browser: `http://localhost:3000`

### 4. Start Mobile Application (Expo Android / iOS)
```bash
cd packages/mobile
npm run start
```

---

## 👥 Seeded Corporate Personas (Demo Switcher)

Switch personas instantly using the top banner dropdown in the web and mobile applications:

| Persona | Code | Role | Department | Access Level |
|---|---|---|---|---|
| **Aarav Sharma** | `EMP-1001` | `EMPLOYEE` | Engineering Services | Desk & room bookings, scan QR, events |
| **Priya Nair** | `EMP-1002` | `TEAM_COORDINATOR`| Robotics DTS | Team coordination & desk reservation |
| **Vikram Patel** | `EMP-1003` | `FACILITIES_ADMIN` | Facilities & Transport | Floor plan, QR stickers, booking policies |
| **Neha Gupta** | `EMP-1004` | `EVENTS_ADMIN` | Human Resources | Community events & announcements |
| **Rohan Deshmukh** | `EMP-1000` | `SUPER_ADMIN` | IT & CISO | Full administrative access, audit logs, roster import |
| **Meera Sen** | `EMP-1005` | `RECEPTION_ADMIN` | Workplace Operations | Guest check-ins, visitor management |

---

## 🛡️ Key Security Guarantees

1. **Anti-Double-Booking Concurrency Safety:**
   Database-level sequential transaction isolation and resource mutexes guarantee that simultaneous booking attempts for the same workstation or room slot cannot create overlapping reservations.
2. **Physical QR Decoupling:**
   Physical QR stickers only encode non-sensitive opaque identifiers (`res_dk_z001`). The sticker never grants booking authority by itself. Authentication, quota, and policy checks are executed server-side.
3. **One-Time Cryptographic Tokens:**
   Generated via `crypto.randomBytes(32)` and stored only as SHA-256 hashes. Concurrency locks prevent duplicate redemptions, with strict expiration and instant administrative revocation.
4. **IDOR / BOLA Prevention:**
   Employees can only view and manage their own reservations. Modification or cancellation of another employee's booking is rejected with `403 Forbidden` and audited as a security alert.
5. **Real-Time Account Suspension:**
   Deactivated employees are blocked in real-time on every API call, even if they possess an unexpired JWT token.
6. **Privileged Server Notifications:**
   Push notifications and broadcasts can only be dispatched by the server using an allowlisted template catalog, protected by an instant emergency killswitch.
