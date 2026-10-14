import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../../db/index.js';
import { UserRole, EmployeeUser } from '@gcc-connect/shared';
import { logAuditEvent, logSecurityEvent } from '../security/auditLogger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gcc-enterprise-sec-token-sign-key-dev-only-32b';
const JWT_EXPIRES_IN = '8h';

export interface AuthContext {
  id: string;
  employeeCode: string;
  email: string;
  name: string;
  department: string;
  team: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthContext;
}

export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateToken(user: AuthContext): string {
  return jwt.sign(
    {
      id: user.id,
      employeeCode: user.employeeCode,
      email: user.email,
      name: user.name,
      department: user.department,
      team: user.team,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function devLogin(employeeCode: string, ipAddress: string): Promise<{ token: string; user: AuthContext }> {
  // Reject in production if dev mode is disabled
  const devSetting = await queryOne('SELECT value FROM app_settings WHERE key = $1', ['dev_mode_allowed']);
  if (process.env.NODE_ENV === 'production' && devSetting?.value !== 'true') {
    throw new Error('DEV_MODE_DISABLED');
  }

  const employee = await queryOne<EmployeeUser>(
    'SELECT * FROM employees WHERE employee_code = $1',
    [employeeCode]
  );

  if (!employee) {
    await logSecurityEvent({
      eventType: 'AUTH_DEV_LOGIN_FAILED',
      severity: 'LOW',
      description: `Unknown employee code attempted in dev login: ${employeeCode}`,
      ipAddress,
    });
    throw new Error('EMPLOYEE_NOT_FOUND');
  }

  if (!employee.isActive && (employee as any).is_active === 0) {
    await logSecurityEvent({
      eventType: 'AUTH_SUSPENDED_USER_LOGIN',
      severity: 'MEDIUM',
      description: `Suspended employee attempted login: ${employee.email}`,
      ipAddress,
      actorId: employee.id,
    });
    throw new Error('ACCOUNT_SUSPENDED');
  }

  const userContext: AuthContext = {
    id: employee.id,
    employeeCode: employee.employeeCode || (employee as any).employee_code,
    email: employee.email,
    name: employee.name,
    department: employee.department,
    team: employee.team,
    role: employee.role,
  };

  const token = generateToken(userContext);

  await logAuditEvent({
    action: 'DEV_LOGIN_SUCCESS',
    actorId: userContext.id,
    actorEmail: userContext.email,
    targetType: 'SESSION',
    targetId: userContext.id,
    ipAddress,
  });

  return { token, user: userContext };
}

export async function requestOtp(email: string, ipAddress: string): Promise<{ success: boolean; message: string; devOtp?: string }> {
  const employee = await queryOne<EmployeeUser>('SELECT * FROM employees WHERE email = $1', [email]);
  if (!employee) {
    // Return standard success-like message to prevent email enumeration
    return { success: true, message: 'If an authorized account exists for this corporate email, an OTP has been dispatched.' };
  }

  if (!employee.isActive && (employee as any).is_active === 0) {
    throw new Error('ACCOUNT_SUSPENDED');
  }

  // Generate 6-digit cryptographically secure OTP
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const otpHash = hashString(rawOtp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 5 min expiry

  // Invalidate any previous OTPs for this email
  await execute('DELETE FROM otp_codes WHERE email = $1', [email]);

  const otpId = `otp_${uuidv4()}`;
  await execute(
    `INSERT INTO otp_codes (id, email, otp_hash, attempts, max_attempts, expires_at, created_at)
     VALUES ($1, $2, $3, 0, 3, $4, $5)`,
    [otpId, email, otpHash, expiresAt, now.toISOString()]
  );

  await logAuditEvent({
    action: 'OTP_REQUESTED',
    actorId: employee.id,
    actorEmail: email,
    targetType: 'OTP',
    targetId: otpId,
    ipAddress,
  });

  // In local development, return devOtp for testing convenience
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    success: true,
    message: 'OTP sent to authorized corporate mailbox.',
    devOtp: isDev ? rawOtp : undefined,
  };
}

export async function verifyOtp(email: string, rawOtp: string, ipAddress: string): Promise<{ token: string; user: AuthContext }> {
  const otpRecord = await queryOne(
    'SELECT * FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
    [email]
  );

  if (!otpRecord) {
    throw new Error('OTP_NOT_FOUND_OR_EXPIRED');
  }

  const now = new Date().toISOString();
  if (otpRecord.expires_at < now) {
    await execute('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);
    throw new Error('OTP_EXPIRED');
  }

  if (otpRecord.attempts >= otpRecord.max_attempts) {
    await execute('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);
    await logSecurityEvent({
      eventType: 'OTP_MAX_ATTEMPTS_EXCEEDED',
      severity: 'HIGH',
      description: `Max OTP verification attempts exceeded for ${email}`,
      ipAddress,
    });
    throw new Error('OTP_MAX_ATTEMPTS_EXCEEDED');
  }

  const otpHash = hashString(rawOtp);
  if (otpHash !== otpRecord.otp_hash) {
    await execute('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
    await logSecurityEvent({
      eventType: 'OTP_INVALID_ATTEMPT',
      severity: 'MEDIUM',
      description: `Failed OTP attempt for ${email}. Remaining attempts: ${otpRecord.max_attempts - (otpRecord.attempts + 1)}`,
      ipAddress,
    });
    throw new Error('INVALID_OTP');
  }

  // Consume OTP
  await execute('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);

  const employee = await queryOne<EmployeeUser>('SELECT * FROM employees WHERE email = $1', [email]);
  if (!employee || (!employee.isActive && (employee as any).is_active === 0)) {
    throw new Error('ACCOUNT_SUSPENDED');
  }

  const userContext: AuthContext = {
    id: employee.id,
    employeeCode: employee.employeeCode || (employee as any).employee_code,
    email: employee.email,
    name: employee.name,
    department: employee.department,
    team: employee.team,
    role: employee.role,
  };

  const token = generateToken(userContext);

  await logAuditEvent({
    action: 'OTP_LOGIN_SUCCESS',
    actorId: userContext.id,
    actorEmail: userContext.email,
    targetType: 'SESSION',
    targetId: userContext.id,
    ipAddress,
  });

  return { token, user: userContext };
}

// Authentication Middleware
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.gcc_session;

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthContext;

    // Verify account is still active in database (revocation / suspension check)
    const emp = await queryOne('SELECT is_active FROM employees WHERE id = $1', [decoded.id]);
    if (!emp || emp.is_active === 0) {
      res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'Employee account is deactivated or suspended' });
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or signature invalid' });
  }
}

// Role Authorization Middleware
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next(); // Super admin has global authorization
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Insufficient permissions. Allowed roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
