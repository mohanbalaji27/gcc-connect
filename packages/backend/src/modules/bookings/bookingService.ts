import { v4 as uuidv4 } from 'uuid';
import { transaction, query, queryOne } from '../../db/index.js';
import { Booking, BookingPolicy } from '@gcc-connect/shared';
import { AuthContext } from '../auth/authService.js';
import { logAuditEvent, logSecurityEvent } from '../security/auditLogger.js';
import { sendNotification } from '../notifications/notificationService.js';

export async function getBookingPolicies(): Promise<BookingPolicy> {
  const policy = await queryOne(
    'SELECT * FROM booking_policies ORDER BY updated_at DESC LIMIT 1'
  );
  if (!policy) {
    return {
      maxDeskDaysInAdvance: 14,
      maxActiveDeskBookingsPerEmployee: 3,
      maxRoomHoursPerBooking: 4,
      checkInWindowMinutesBefore: 30,
      autoReleaseGracePeriodMinutes: 15,
      requireCheckIn: true,
    };
  }

  return {
    maxDeskDaysInAdvance: policy.max_desk_days_in_advance,
    maxActiveDeskBookingsPerEmployee: policy.max_active_desk_bookings_per_employee,
    maxRoomHoursPerBooking: policy.max_room_hours_per_booking,
    checkInWindowMinutesBefore: policy.check_in_window_minutes_before,
    autoReleaseGracePeriodMinutes: policy.auto_release_grace_period_minutes,
    requireCheckIn: policy.require_check_in === 1,
  };
}

export async function checkIdempotency(key: string, employeeId: string): Promise<{ code: number; body: any } | null> {
  const record = await queryOne(
    'SELECT * FROM booking_idempotency WHERE idempotency_key = $1 AND employee_id = $2',
    [key, employeeId]
  );
  if (record) {
    return {
      code: record.response_code,
      body: JSON.parse(record.response_body),
    };
  }
  return null;
}

export async function recordIdempotency(key: string, employeeId: string, code: number, body: any): Promise<void> {
  await query(
    `INSERT INTO booking_idempotency (idempotency_key, employee_id, response_code, response_body, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [key, employeeId, code, JSON.stringify(body), new Date().toISOString()]
  );
}

export async function createDeskBooking(options: {
  resourceId: string;
  date: string;
  isQrOriginated?: boolean;
  user: AuthContext;
  ipAddress: string;
  idempotencyKey?: string;
}): Promise<Booking> {
  const { resourceId, date, isQrOriginated = false, user, ipAddress, idempotencyKey } = options;

  // 1. Idempotency Check
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, user.id);
    if (cached) {
      return cached.body;
    }
  }

  const policies = await getBookingPolicies();
  const todayStr = new Date().toISOString().split('T')[0];

  // 2. Validate Booking Date
  if (date < todayStr) {
    throw new Error('BOOKING_DATE_IN_PAST');
  }

  const maxAllowedDate = new Date();
  maxAllowedDate.setDate(maxAllowedDate.getDate() + policies.maxDeskDaysInAdvance);
  const maxAllowedStr = maxAllowedDate.toISOString().split('T')[0];
  if (date > maxAllowedStr) {
    throw new Error(`ADVANCE_BOOKING_LIMIT_EXCEEDED:${policies.maxDeskDaysInAdvance}_DAYS`);
  }

  // 3. Quota Enforcement: Check Active Future Desk Bookings
  const activeCountRes = await queryOne(
    `SELECT count(*) as count FROM bookings 
     WHERE employee_id = $1 AND resource_category = 'DESK' 
       AND date >= $2 AND status IN ('CONFIRMED', 'CHECKED_IN')`,
    [user.id, todayStr]
  );

  const activeCount = parseInt(activeCountRes?.count || '0', 10);
  if (activeCount >= policies.maxActiveDeskBookingsPerEmployee) {
    await logSecurityEvent({
      eventType: 'BOOKING_QUOTA_EXCEEDED',
      severity: 'LOW',
      description: `Employee ${user.email} exceeded active desk booking quota of ${policies.maxActiveDeskBookingsPerEmployee}`,
      ipAddress,
      actorId: user.id,
    });
    throw new Error(`ACTIVE_DESK_QUOTA_EXCEEDED:MAX_${policies.maxActiveDeskBookingsPerEmployee}`);
  }

  // 4. Atomic Transaction with Concurrency Lock
  const newBooking = await transaction(async (client) => {
    // Check desk exists & active
    const deskRes = await client.query('SELECT * FROM desks WHERE id = $1', [resourceId]);
    const desk = deskRes.rows[0];
    if (!desk) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    if (desk.status === 'MAINTENANCE' || desk.status === 'RESTRICTED') {
      throw new Error(`RESOURCE_STATUS_${desk.status}`);
    }

    // Atomic double-booking prevention
    const conflictRes = await client.query(
      `SELECT id FROM bookings 
       WHERE resource_id = $1 AND date = $2 AND status IN ('CONFIRMED', 'CHECKED_IN')`,
      [resourceId, date]
    );

    if (conflictRes.rows.length > 0) {
      throw new Error('DESK_ALREADY_BOOKED');
    }

    // Check if user already booked another desk on the same date
    const userConflictRes = await client.query(
      `SELECT id, resource_name FROM bookings 
       WHERE employee_id = $1 AND date = $2 AND resource_category = 'DESK' AND status IN ('CONFIRMED', 'CHECKED_IN')`,
      [user.id, date]
    );

    if (userConflictRes.rows.length > 0) {
      throw new Error(`EMPLOYEE_ALREADY_HAS_DESK_FOR_DATE:${userConflictRes.rows[0].resource_name}`);
    }

    const bookingId = `bk_dk_${uuidv4()}`;
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO bookings (
         id, resource_id, resource_category, resource_code, resource_name,
         employee_id, employee_name, employee_email, date, start_time, end_time,
         status, created_at, is_qr_originated, title
       ) VALUES ($1, $2, 'DESK', $3, $4, $5, $6, $7, $8, '09:00', '18:00', 'CONFIRMED', $9, $10, 'Full Day Workstation')`,
      [
        bookingId,
        desk.id,
        desk.code,
        desk.name,
        user.id,
        user.name,
        user.email,
        date,
        now,
        isQrOriginated ? 1 : 0,
      ]
    );

    return {
      id: bookingId,
      resourceId: desk.id,
      resourceCategory: 'DESK',
      resourceCode: desk.code,
      resourceName: desk.name,
      employeeId: user.id,
      employeeName: user.name,
      employeeEmail: user.email,
      date,
      startTime: '09:00',
      endTime: '18:00',
      status: 'CONFIRMED',
      createdAt: now,
      isQrOriginated,
      title: 'Full Day Workstation',
    } as Booking;
  });

  if (idempotencyKey) {
    await recordIdempotency(idempotencyKey, user.id, 201, newBooking);
  }

  await logAuditEvent({
    action: 'CREATE_DESK_BOOKING',
    actorId: user.id,
    actorEmail: user.email,
    targetType: 'DESK_BOOKING',
    targetId: newBooking.id,
    details: { resourceId, date, isQrOriginated },
    ipAddress,
  });

  // Privileged server notification
  await sendNotification({
    type: 'BOOKING_CONFIRMATION',
    recipientId: user.id,
    recipientEmail: user.email,
    title: 'Workstation Reserved',
    body: `Your workstation ${newBooking.resourceName} is confirmed for ${newBooking.date}.`,
  }).catch(() => {});

  return newBooking;
}

export async function createRoomBooking(options: {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  attendeesCount?: number;
  isQrOriginated?: boolean;
  user: AuthContext;
  ipAddress: string;
  idempotencyKey?: string;
}): Promise<Booking> {
  const {
    resourceId,
    date,
    startTime,
    endTime,
    title = 'Team Collaboration',
    attendeesCount = 2,
    isQrOriginated = false,
    user,
    ipAddress,
    idempotencyKey,
  } = options;

  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, user.id);
    if (cached) {
      return cached.body;
    }
  }

  const policies = await getBookingPolicies();
  const todayStr = new Date().toISOString().split('T')[0];

  if (date < todayStr) {
    throw new Error('BOOKING_DATE_IN_PAST');
  }

  // Duration calculation
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const durationHours = (endH * 60 + endM - (startH * 60 + startM)) / 60;

  if (durationHours <= 0) {
    throw new Error('INVALID_DURATION:END_BEFORE_START');
  }
  if (durationHours > policies.maxRoomHoursPerBooking) {
    throw new Error(`MAX_DURATION_EXCEEDED:LIMIT_${policies.maxRoomHoursPerBooking}_HOURS`);
  }

  const newBooking = await transaction(async (client) => {
    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1', [resourceId]);
    const room = roomRes.rows[0];
    if (!room) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    if (room.status === 'MAINTENANCE') {
      throw new Error('RESOURCE_UNDER_MAINTENANCE');
    }

    // Atomic overlap detection:
    // (start_time < newEndTime AND end_time > newStartTime)
    const conflictRes = await client.query(
      `SELECT id, start_time, end_time, title, employee_name FROM bookings 
       WHERE resource_id = $1 AND date = $2 AND status IN ('CONFIRMED', 'CHECKED_IN')
         AND start_time < $3 AND end_time > $4`,
      [resourceId, date, endTime, startTime]
    );

    if (conflictRes.rows.length > 0) {
      // Find alternative available rooms
      const alternativesRes = await client.query(
        `SELECT r.id, r.name, r.capacity, r.code FROM rooms r
         WHERE r.id != $1 AND r.status = 'AVAILABLE'
           AND NOT EXISTS (
             SELECT 1 FROM bookings b 
             WHERE b.resource_id = r.id AND b.date = $2 AND b.status IN ('CONFIRMED', 'CHECKED_IN')
               AND b.start_time < $3 AND b.end_time > $4
           ) LIMIT 3`,
        [resourceId, date, endTime, startTime]
      );

      const err: any = new Error('ROOM_ALREADY_BOOKED');
      err.conflict = conflictRes.rows[0];
      err.alternatives = alternativesRes.rows;
      throw err;
    }

    const bookingId = `bk_rm_${uuidv4()}`;
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO bookings (
         id, resource_id, resource_category, resource_code, resource_name,
         employee_id, employee_name, employee_email, date, start_time, end_time,
         status, created_at, is_qr_originated, title, attendees_count
       ) VALUES ($1, $2, 'MEETING_ROOM', $3, $4, $5, $6, $7, $8, $9, $10, 'CONFIRMED', $11, $12, $13, $14)`,
      [
        bookingId,
        room.id,
        room.code,
        room.name,
        user.id,
        user.name,
        user.email,
        date,
        startTime,
        endTime,
        now,
        isQrOriginated ? 1 : 0,
        title,
        attendeesCount,
      ]
    );

    return {
      id: bookingId,
      resourceId: room.id,
      resourceCategory: 'MEETING_ROOM',
      resourceCode: room.code,
      resourceName: room.name,
      employeeId: user.id,
      employeeName: user.name,
      employeeEmail: user.email,
      date,
      startTime,
      endTime,
      status: 'CONFIRMED',
      createdAt: now,
      isQrOriginated,
      title,
      attendeesCount,
    } as Booking;
  });

  if (idempotencyKey) {
    await recordIdempotency(idempotencyKey, user.id, 201, newBooking);
  }

  await logAuditEvent({
    action: 'CREATE_ROOM_BOOKING',
    actorId: user.id,
    actorEmail: user.email,
    targetType: 'ROOM_BOOKING',
    targetId: newBooking.id,
    details: { resourceId, date, startTime, endTime, attendeesCount },
    ipAddress,
  });

  await sendNotification({
    type: 'BOOKING_CONFIRMATION',
    recipientId: user.id,
    recipientEmail: user.email,
    title: 'Meeting Room Reserved',
    body: `${newBooking.resourceName} is confirmed for ${newBooking.date} (${newBooking.startTime} - ${newBooking.endTime}).`,
  }).catch(() => {});

  return newBooking;
}

export async function cancelBooking(bookingId: string, user: AuthContext, ipAddress: string): Promise<void> {
  const booking = await queryOne('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  if (!booking) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  // Strict Object-Level Authorization (IDOR / BOLA Prevention)
  const isOwner = booking.employee_id === user.id;
  const isAdmin = ['SUPER_ADMIN', 'FACILITIES_ADMIN'].includes(user.role);

  if (!isOwner && !isAdmin) {
    await logSecurityEvent({
      eventType: 'IDOR_UNAUTHORIZED_CANCEL_ATTEMPT',
      severity: 'HIGH',
      description: `User ${user.email} attempted to cancel booking ${bookingId} belonging to ${booking.employee_email}`,
      ipAddress,
      actorId: user.id,
    });
    throw new Error('FORBIDDEN_NOT_BOOKING_OWNER');
  }

  if (booking.status === 'CANCELLED') {
    return; // idempotent
  }

  await query('UPDATE bookings SET status = $1 WHERE id = $2', ['CANCELLED', bookingId]);

  await logAuditEvent({
    action: 'CANCEL_BOOKING',
    actorId: user.id,
    actorEmail: user.email,
    targetType: 'BOOKING',
    targetId: bookingId,
    ipAddress,
  });

  await sendNotification({
    type: 'BOOKING_CANCELLATION',
    recipientId: booking.employee_id,
    recipientEmail: booking.employee_email,
    title: 'Booking Cancelled',
    body: `Your reservation for ${booking.resource_name} on ${booking.date} has been cancelled.`,
  }).catch(() => {});
}

export async function checkInBooking(bookingId: string, user: AuthContext, ipAddress: string): Promise<Booking> {
  const booking = await queryOne('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  if (!booking) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  const isOwner = booking.employee_id === user.id;
  const isAdmin = ['SUPER_ADMIN', 'FACILITIES_ADMIN', 'RECEPTION_ADMIN'].includes(user.role);

  if (!isOwner && !isAdmin) {
    throw new Error('FORBIDDEN_NOT_BOOKING_OWNER');
  }

  if (booking.status === 'CANCELLED' || booking.status === 'RELEASED') {
    throw new Error(`CANNOT_CHECKIN_STATUS_${booking.status}`);
  }

  const now = new Date().toISOString();
  await query('UPDATE bookings SET status = $1, check_in_at = $2 WHERE id = $3', ['CHECKED_IN', now, bookingId]);

  await logAuditEvent({
    action: 'CHECKIN_SUCCESS',
    actorId: user.id,
    actorEmail: user.email,
    targetType: 'BOOKING',
    targetId: bookingId,
    ipAddress,
  });

  return {
    ...booking,
    status: 'CHECKED_IN',
    checkInAt: now,
  } as Booking;
}

export async function getEmployeeBookings(employeeId: string): Promise<Booking[]> {
  const rows = await query<any>(
    'SELECT * FROM bookings WHERE employee_id = $1 ORDER BY date DESC, start_time DESC',
    [employeeId]
  );

  return rows.map((r) => ({
    id: r.id,
    resourceId: r.resource_id,
    resourceCategory: r.resource_category,
    resourceCode: r.resource_code,
    resourceName: r.resource_name,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    employeeEmail: r.employee_email,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status,
    checkInAt: r.check_in_at,
    createdAt: r.created_at,
    isQrOriginated: r.is_qr_originated === 1,
    title: r.title,
    attendeesCount: r.attendees_count,
  }));
}
