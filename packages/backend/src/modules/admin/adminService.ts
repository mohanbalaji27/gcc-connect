import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, transaction } from '../../db/index.js';
import { UserRole, BookingPolicy } from '@gcc-connect/shared';
import { AuthContext } from '../auth/authService.js';
import { logAuditEvent, logSecurityEvent } from '../security/auditLogger.js';

export interface ImportPreviewRow {
  rowNumber: number;
  employeeCode: string;
  email: string;
  name: string;
  department: string;
  team: string;
  role: string;
  isValid: boolean;
  errors: string[];
}

export interface ImportResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows?: number;
  errors: Array<{ row: number; errors: string[] }>;
  preview: ImportPreviewRow[];
}

const VALID_ROLES = new Set<string>([
  'EMPLOYEE',
  'TEAM_COORDINATOR',
  'FACILITIES_ADMIN',
  'EVENTS_ADMIN',
  'SUPER_ADMIN',
  'RECEPTION_ADMIN',
]);

export async function processEmployeeImport(
  buffer: Buffer,
  dryRun: boolean,
  admin: AuthContext,
  ipAddress: string
): Promise<ImportResult> {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('EMPTY_WORKBOOK');
  }

  const rawRows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const preview: ImportPreviewRow[] = [];
  const errorsList: Array<{ row: number; errors: string[] }> = [];

  const existingEmails = new Set(
    (await query<{ email: string }>('SELECT email FROM employees')).map((r) => r.email.toLowerCase())
  );
  const existingCodes = new Set(
    (await query<{ employee_code: string }>('SELECT employee_code FROM employees')).map((r) => r.employee_code.toLowerCase())
  );

  let rowNum = 1;
  const validRecordsToCommit: any[] = [];

  for (const row of rawRows) {
    rowNum++;
    const rowErrors: string[] = [];

    const code = String(row['Employee Code'] || row['employeeCode'] || row['code'] || '').trim();
    const email = String(row['Email'] || row['email'] || '').trim().toLowerCase();
    const name = String(row['Name'] || row['name'] || '').trim();
    const dept = String(row['Department'] || row['department'] || '').trim();
    const team = String(row['Team'] || row['team'] || '').trim();
    const role = String(row['Role'] || row['role'] || 'EMPLOYEE').trim().toUpperCase();

    if (!code) rowErrors.push('Missing employee code');
    if (!email || !email.includes('@')) rowErrors.push('Invalid email format');
    if (!name) rowErrors.push('Missing name');
    if (!dept) rowErrors.push('Missing department');
    if (!VALID_ROLES.has(role)) rowErrors.push(`Invalid role: ${role}`);

    if (existingEmails.has(email)) rowErrors.push(`Email already registered: ${email}`);
    if (existingCodes.has(code.toLowerCase())) rowErrors.push(`Employee code already exists: ${code}`);

    const isValid = rowErrors.length === 0;
    if (!isValid) {
      errorsList.push({ row: rowNum, errors: rowErrors });
    } else {
      existingEmails.add(email);
      existingCodes.add(code.toLowerCase());
      validRecordsToCommit.push({
        id: `emp_${uuidv4()}`,
        code,
        email,
        name,
        dept,
        team,
        role,
      });
    }

    if (preview.length < 50) {
      preview.push({
        rowNumber: rowNum,
        employeeCode: code,
        email,
        name,
        department: dept,
        team,
        role,
        isValid,
        errors: rowErrors,
      });
    }
  }

  let committedRows = 0;

  if (!dryRun && validRecordsToCommit.length > 0) {
    const now = new Date().toISOString();
    await transaction(async (client) => {
      for (const rec of validRecordsToCommit) {
        await client.query(
          `INSERT INTO employees (id, employee_code, email, name, department, team, role, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)`,
          [rec.id, rec.code, rec.email, rec.name, rec.dept, rec.team, rec.role, now]
        );
      }
    });
    committedRows = validRecordsToCommit.length;

    await logAuditEvent({
      action: 'BULK_IMPORT_EMPLOYEES',
      actorId: admin.id,
      actorEmail: admin.email,
      targetType: 'ROSTER',
      targetId: 'bulk',
      details: { committedRows, invalidCount: errorsList.length },
      ipAddress,
    });
  }

  return {
    totalRows: rawRows.length,
    validRows: validRecordsToCommit.length,
    invalidRows: errorsList.length,
    committedRows,
    errors: errorsList,
    preview,
  };
}

export async function assignUserRole(userId: string, newRole: UserRole, admin: AuthContext, ipAddress: string): Promise<void> {
  const targetUser = await queryOne('SELECT * FROM employees WHERE id = $1', [userId]);
  if (!targetUser) {
    throw new Error('USER_NOT_FOUND');
  }

  // Prevent self-role modification
  if (userId === admin.id) {
    await logSecurityEvent({
      eventType: 'SELF_ROLE_ELEVATION_ATTEMPT',
      severity: 'HIGH',
      description: `User ${admin.email} attempted to modify their own role`,
      ipAddress,
      actorId: admin.id,
    });
    throw new Error('CANNOT_MODIFY_OWN_ROLE');
  }

  await execute('UPDATE employees SET role = $1 WHERE id = $2', [newRole, userId]);

  await logAuditEvent({
    action: 'ASSIGN_USER_ROLE',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'USER_ROLE',
    targetId: userId,
    details: { previousRole: targetUser.role, newRole },
    ipAddress,
  });
}

export async function setUserSuspension(userId: string, isSuspended: boolean, reason: string, admin: AuthContext, ipAddress: string): Promise<void> {
  const targetUser = await queryOne('SELECT * FROM employees WHERE id = $1', [userId]);
  if (!targetUser) {
    throw new Error('USER_NOT_FOUND');
  }

  if (userId === admin.id) {
    throw new Error('CANNOT_SUSPEND_SELF');
  }

  const activeValue = isSuspended ? 0 : 1;
  await execute('UPDATE employees SET is_active = $1 WHERE id = $2', [activeValue, userId]);

  await logAuditEvent({
    action: isSuspended ? 'SUSPEND_USER' : 'REACTIVATE_USER',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'USER_STATUS',
    targetId: userId,
    details: { reason, isSuspended },
    ipAddress,
  });
}

export async function updateBookingPolicies(policy: BookingPolicy, admin: AuthContext, ipAddress: string): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `UPDATE booking_policies SET
       max_desk_days_in_advance = $1,
       max_active_desk_bookings_per_employee = $2,
       max_room_hours_per_booking = $3,
       check_in_window_minutes_before = $4,
       auto_release_grace_period_minutes = $5,
       require_check_in = $6,
       updated_at = $7
     WHERE id = 'policy_default'`,
    [
      policy.maxDeskDaysInAdvance,
      policy.maxActiveDeskBookingsPerEmployee,
      policy.maxRoomHoursPerBooking,
      policy.checkInWindowMinutesBefore,
      policy.autoReleaseGracePeriodMinutes,
      policy.requireCheckIn ? 1 : 0,
      now,
    ]
  );

  await logAuditEvent({
    action: 'UPDATE_BOOKING_POLICIES',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'POLICY',
    targetId: 'policy_default',
    details: policy as any,
    ipAddress,
  });
}
