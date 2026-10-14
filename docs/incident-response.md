# GCC Connect — Incident Response Runbook

## 1. Severity Classification

- **SEV-1 (Critical):** Compromised Super Admin account, uncontained mass notification broadcast, database compromise, or systemic outage of booking engine.
- **SEV-2 (High):** Automated booking abuse / desk monopolization script active, rogue one-time token redemption flood, or active OTP brute-force attempt.
- **SEV-3 (Medium):** Compromised individual physical QR sticker, single employee account suspension dispute, or partial rate-limiting false positive.

---

## 2. Emergency Operational Switches

### A. Killswitch: Disable All Notifications Instantly
To prevent unauthorized broadcast messages or notification flooding:
```sql
UPDATE app_settings SET value = 'false', updated_at = NOW() WHERE key = 'notifications_enabled';
```
Or via Admin API:
`POST /api/admin/emergency/kill-notifications` (Requires `SUPER_ADMIN`).

### B. Disable Development Mode Instantly
In production, ensure development bypasses cannot be activated:
```sql
UPDATE app_settings SET value = 'false', updated_at = NOW() WHERE key = 'dev_mode_allowed';
```

---

## 3. Incident Playbooks

### Playbook 1: Compromised Physical QR Code
**Scenario:** A physical desk or meeting room QR sticker is copied, defaced, or posted publicly.
1. Identify the compromised resource: e.g. `desk_z042` with opaque code `res_dk_z042`.
2. Deactivate the physical QR code record immediately:
   ```sql
   UPDATE resource_qrs SET is_active = 0 WHERE opaque_code = 'res_dk_z042';
   ```
3. Generate a new opaque identifier (e.g. `res_dk_z042_v2`) in the Admin Portal under "QR Sticker Print".
4. Print the replacement sticker and instruct facilities staff to replace the physical label.
5. Invalidate any active reservations initiated via the compromised QR if fraud is suspected.

### Playbook 2: Compromised or Leaked One-Time Token
**Scenario:** A one-time guest pass token is leaked or shared in an unauthorized Slack channel.
1. Locate the token by identifier in the Admin Portal or database:
   ```sql
   SELECT id, token_identifier, redemptions_count, max_redemptions, expires_at 
   FROM one_time_tokens WHERE token_identifier = 'tok_xyz123';
   ```
2. Revoke the token immediately:
   ```sql
   UPDATE one_time_tokens SET revoked_at = NOW() WHERE token_identifier = 'tok_xyz123';
   ```
3. If an unauthorized reservation was created, cancel the booking:
   ```sql
   UPDATE bookings SET status = 'CANCELLED' WHERE id = (
     SELECT booking_id FROM token_redemptions WHERE token_id = 'tok_xyz123'
   );
   ```

### Playbook 3: Compromised Administrator Account
**Scenario:** An admin account is compromised or an employee holding administrative privileges is terminated.
1. Suspend the employee account immediately:
   ```sql
   UPDATE employees SET is_active = 0 WHERE id = 'emp_target_id';
   ```
2. Demote privileges to `EMPLOYEE`:
   ```sql
   UPDATE employees SET role = 'EMPLOYEE' WHERE id = 'emp_target_id';
   ```
3. Rotate JWT signing secrets if token forgery is suspected:
   Set a new `JWT_SECRET` environment variable and restart the backend. All existing active client sessions will be immediately invalidated and required to re-authenticate.
4. Review recent audit entries for unauthorized changes:
   ```sql
   SELECT * FROM audit_logs WHERE actor_id = 'emp_target_id' ORDER BY timestamp DESC LIMIT 100;
   ```
