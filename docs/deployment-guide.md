# GCC Connect — Production Deployment & Integration Guide

## 1. Architecture & Portability Overview

GCC Connect is engineered with clean environment boundaries:
- **Local Development / Offline Mode:** Runs entirely with zero external prerequisites. Uses the internal transactional PostgreSQL engine (`pg-mem`), pre-seeded with 184 Zimmer Biomet Bangalore workstations and seeded test personas.
- **Enterprise Staging & Production:** Connects directly to PostgreSQL 16+ via standard connection strings (`DATABASE_URL`), with production security headers, CORS protection, rate-limiting, and hardened error masking.

---

## 2. Environment Variables Configuration

| Variable | Required in Prod | Default (Dev) | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Setting to `production` disables dev-login and masks stack traces |
| `PORT` | Optional | `4000` | Port for the authoritative API server |
| `DATABASE_URL` | Yes (in Prod) | *In-memory SQLite/Postgres* | PostgreSQL connection string: `postgres://user:pass@host:5432/dbname` |
| `DATABASE_SSL` | Optional | `false` | Set to `true` when connecting to AWS RDS or Azure Postgres |
| `JWT_SECRET` | Yes | *dev-signing-key* | 256-bit cryptographic secret for signing user sessions |
| `DEV_MODE_ALLOWED`| Yes | `true` | Must be explicitly set to `false` in production environments |
| `CORS_ALLOWED_ORIGINS`| Optional | `http://localhost:3000` | Comma-separated list of approved web application domains |

---

## 3. Microsoft Integration Boundaries

The core application operates completely independently of Microsoft Graph or Exchange. Integration adapters are provided for future deployment once corporate Microsoft licensing and Azure tenant approvals are established:

### A. Microsoft Entra ID (Azure AD) SSO Adapter
- **Protocol:** OpenID Connect (OIDC) / OAuth 2.0 Authorization Code flow with PKCE.
- **Scope required:** `openid profile email`
- **Verification:** The backend validates identity token signatures using Microsoft's public JWKS (`https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys`), checking `iss` (issuer), `aud` (client ID), and `exp`.
- **Roster Alignment:** Extracted email claim is validated against the active employee roster.

### B. Exchange / Outlook Room Calendar Synchronization
- **Adapter Mode:** Webhook / Graph delta query.
- **Boundary:** GCC Connect database remains authoritative for internal workplace quotas, policies, and desk check-ins. If Outlook room booking sync is enabled, an outbox worker dispatches Graph API requests (`/users/{room_email}/calendar/events`) asynchronously.

---

## 4. Production Deployment with Docker Compose

To deploy the authoritative backend, web client, and PostgreSQL 16 database:

```bash
cd docker
docker-compose up -d --build
```

Verify services:
- Authoritative API: `http://localhost:4000/api/health`
- Interactive OpenAPI Docs: `http://localhost:4000/api/docs`
- Web Application & PWA: `http://localhost`
