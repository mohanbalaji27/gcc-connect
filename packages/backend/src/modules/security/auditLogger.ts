import { v4 as uuidv4 } from 'uuid';
import { execute } from '../../db/index.js';

export async function logAuditEvent(options: {
  action: string;
  actorId: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ipAddress: string;
}): Promise<void> {
  const { action, actorId, actorEmail, targetType, targetId, details = {}, ipAddress } = options;
  const id = `audit_${uuidv4()}`;
  const timestamp = new Date().toISOString();

  // Sanitize details to never leak passwords, OTPs, or bearer tokens
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.password;
  delete sanitizedDetails.otp;
  delete sanitizedDetails.bearerToken;
  delete sanitizedDetails.token;

  await execute(
    `INSERT INTO audit_logs (id, action, actor_id, actor_email, target_type, target_id, details, ip_address, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, action, actorId, actorEmail, targetType, targetId, JSON.stringify(sanitizedDetails), ipAddress, timestamp]
  );
}

export async function logSecurityEvent(options: {
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  ipAddress: string;
  actorId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { eventType, severity, description, ipAddress, actorId, details = {} } = options;
  const id = `sec_${uuidv4()}`;
  const timestamp = new Date().toISOString();

  const sanitized = { ...details };
  delete sanitized.password;
  delete sanitized.otp;
  delete sanitized.bearerToken;

  await execute(
    `INSERT INTO security_events (id, event_type, severity, description, ip_address, actor_id, details, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, eventType, severity, description, ipAddress, actorId || null, JSON.stringify(sanitized), timestamp]
  );
}
