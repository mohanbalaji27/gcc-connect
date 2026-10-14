# GCC Connect — Enterprise Threat Model & Security Controls

## 1. System Overview & Trust Boundaries

```
[Untrusted Clients]                   [Security Gateway]                 [Authoritative Core]
┌──────────────────┐                  ┌──────────────────────┐           ┌───────────────────┐
│ Web / PWA        │──HTTPS/WSS──────▶│ Helmet / CORS        │──────────▶│ Express TS API    │
│ React Native App │ (Untrusted Dev)  │ Rate Limiter (IP/Usr)│           │ Transactional DB  │
│ Attacker Scripts │                  │ JWT & Cookie Session │           │ Concurrency Mutex │
└──────────────────┘                  └──────────────────────┘           └───────────────────┘
```

All clients (Web, Android APK, iOS IPA, and automated scripts) reside **outside the trust boundary** and are considered hostile and untrusted. The backend API and PostgreSQL database are authoritative.

---

## 2. STRIDE Threat Analysis & Implemented Defenses

| Threat Category | Attack Vector | Threat Scenario | Implemented Defense & Verification |
|---|---|---|---|
| **Spoofing** | Identity Forgery | Attacker sends modified `employeeId` in booking request to book on behalf of another user. | **Server-side identity derivation:** The employee identity is exclusively derived from verified server-side JWT session context. Any `employeeId` in request bodies is rejected or ignored. *(Verified in test 4)* |
| **Spoofing** | OTP Brute Force | Attacker attempts to guess 6-digit OTP codes via automated request looping. | **Cryptographic generation & attempt lockout:** 6-digit OTP generated via `crypto.randomInt`, stored only as SHA-256 hash. Max 3 verification attempts permitted; locked and invalidated immediately on 3rd failure. Sliding-window IP rate limiter limits attempts. *(Verified in test 9)* |
| **Tampering** | Double Booking Race Condition | Two employees submit concurrent booking requests for the same desk within milliseconds. | **Atomic database transaction & resource mutex:** Concurrency lock ensures sequential transaction isolation. First transaction commits; second transaction encounters conflicting record and fails with `409 Conflict`. *(Verified in test 5)* |
| **Tampering** | QR Payload Modification | Attacker modifies opaque QR payload or bearer token in request to forge privileged access. | **Physical QR decoupling & Hashed tokens:** Physical QR codes only contain opaque identifiers (`res_dk_...`) and grant no rights; rights are verified authoritatively. One-time tokens are verified against SHA-256 hashes and checked for single-redemption limits. *(Verified in test 8)* |
| **Repudiation** | Denying Action | User denies creating or cancelling a booking, or admin denies changing policy. | **Immutable Structured Audit Logging:** Every security-relevant event (`CREATE_DESK_BOOKING`, `CANCEL_BOOKING`, `ASSIGN_USER_ROLE`, `UPDATE_POLICY`) is recorded in `audit_logs` with actor ID, email, IP address, and timestamp. |
| **Information Disclosure** | Stack Trace & Secrets Leak | Server error response leaks internal DB schema or framework versions. | **Production Error Masking:** Centralized error handler suppresses internal error messages and stack traces in production (`process.env.NODE_ENV === 'production'`). |
| **Information Disclosure** | PII & Credential Logs | Passwords, bearer tokens, or OTP codes stored in log files. | **Strict Log Sanitization:** `logAuditEvent` and `logSecurityEvent` strip sensitive fields (`password`, `otp`, `bearerToken`, `token`) before persisting to database. |
| **Denial of Service** | API Flooding & Resource Exhaustion | Script floods booking or OTP endpoints to crash server or monopolize desks. | **Layered Rate Limiting & Booking Quotas:** Sliding-window rate limiters per IP, per user, and per endpoint. Advance booking limit (14 days) and active booking quota (3 desks) enforced in database query. |
| **Elevation of Privilege** | Self-Role Elevation | Standard employee sends request to `/api/admin/employees/assign-role` with `SUPER_ADMIN`. | **Strict RBAC & Self-Modification Block:** Middleware verifies role (`requireRole('SUPER_ADMIN')`). Self-role elevation is explicitly rejected even if requested by an admin. *(Verified in test 2 & 3)* |
| **Elevation of Privilege** | Deactivated Employee Access | Terminated or suspended employee continues using active JWT token. | **Real-Time Database Account Check:** Session authentication middleware checks `is_active` status in the database on every authenticated request. Suspended users receive `403 Account suspended` immediately. *(Verified in test 10)* |

---

## 3. Residual Risks & Operational Controls

1. **Physical Presence Verification:**
   - Scanning a physical QR code proves camera sight of the sticker, but does not provide cryptographic physical presence proof if the QR image is shared. If physical-presence verification is required by enterprise policy, geofencing or BLE beacon checks should be integrated.
2. **Device-Level Key Extraction on Rooted Devices:**
   - Mobile tokens stored in secure storage can theoretically be dumped by an adversary with root access to their own phone. However, this only compromises their own session, not the system or other users. Session revocation endpoints mitigate this.
3. **Emergency Notification Killswitch:**
   - An administrator can instantly disable non-critical push notifications via `/api/admin/policies` (`notifications_enabled = false`) during incident response.
