import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  DevLoginSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  CreateDeskBookingSchema,
  CreateRoomBookingSchema,
  RoomSearchSchema,
  ScanQrPayloadSchema,
  CreateOneTimeTokenSchema,
  RedeemOneTimeTokenSchema,
  RevokeTokenSchema,
  AssignRoleSchema,
  SuspendUserSchema,
  UpdatePolicySchema,
  SendAnnouncementSchema,
} from '@gcc-connect/shared';
import {
  devLogin,
  requestOtp,
  verifyOtp,
  authenticate,
  requireRole,
  AuthenticatedRequest,
} from './modules/auth/authService.js';
import {
  createDeskBooking,
  createRoomBooking,
  cancelBooking,
  checkInBooking,
  getEmployeeBookings,
  getBookingPolicies,
} from './modules/bookings/bookingService.js';
import {
  resolveQrCode,
  createOneTimeToken,
  redeemOneTimeToken,
  revokeToken,
  getResourceQrInventory,
} from './modules/qr/qrService.js';
import {
  broadcastAnnouncement,
  getNotificationsForEmployee,
} from './modules/notifications/notificationService.js';
import {
  processEmployeeImport,
  assignUserRole,
  setUserSuspension,
  updateBookingPolicies,
} from './modules/admin/adminService.js';
import { query, queryOne } from './db/index.js';
import {
  authRateLimiter,
  bookingRateLimiter,
  generalApiLimiter,
} from './modules/security/rateLimiter.js';

export const apiRouter = Router();

// Helper to get remote IP
function getIp(req: any): string {
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------
apiRouter.get('/health', async (_req, res) => {
  const dbCheck = await queryOne('SELECT 1 as alive');
  res.json({
    status: 'HEALTHY',
    service: 'GCC Connect Authoritative Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbCheck?.alive === 1 ? 'UP' : 'DOWN',
  });
});

// -----------------------------------------------------------------------------
// 1. Authentication Endpoints
// -----------------------------------------------------------------------------
apiRouter.post('/auth/dev-login', authRateLimiter, async (req, res) => {
  try {
    const parse = DevLoginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
      return;
    }

    const { token, user } = await devLogin(parse.data.employeeCode, getIp(req));
    res.cookie('gcc_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 3600 * 1000,
    });

    res.json({ success: true, token, user });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'DEV_LOGIN_FAILED' });
  }
});

apiRouter.post('/auth/request-otp', authRateLimiter, async (req, res) => {
  try {
    const parse = OtpRequestSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
      return;
    }

    const result = await requestOtp(parse.data.email, getIp(req));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'OTP_REQUEST_FAILED' });
  }
});

apiRouter.post('/auth/verify-otp', authRateLimiter, async (req, res) => {
  try {
    const parse = OtpVerifySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
      return;
    }

    const { token, user } = await verifyOtp(parse.data.email, parse.data.otp, getIp(req));
    res.cookie('gcc_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 3600 * 1000,
    });

    res.json({ success: true, token, user });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'OTP_VERIFICATION_FAILED' });
  }
});

apiRouter.get('/auth/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

apiRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie('gcc_session');
  res.json({ success: true });
});

// -----------------------------------------------------------------------------
// 2. Resources (Floors, Desks, Rooms)
// -----------------------------------------------------------------------------
apiRouter.get('/resources/floors', authenticate, async (_req, res) => {
  const floors = await query(
    `SELECT f.*, b.name as building_name, b.code as building_code, b.city 
     FROM floors f JOIN buildings b ON f.building_id = b.id ORDER BY f.floor_number ASC`
  );
  const zones = await query('SELECT * FROM zones');
  res.json({ floors, zones });
});

apiRouter.get('/resources/floors/:floorId/desks', authenticate, async (req, res) => {
  const { floorId } = req.params;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

  const desks = await query(
    `SELECT d.*, z.name as zone_name, z.color_hex as zone_color, z.designated_team,
            b.id as active_booking_id, b.employee_id as booked_by_employee_id, b.employee_name as booked_by_employee_name
     FROM desks d
     LEFT JOIN zones z ON d.zone_id = z.id
     LEFT JOIN bookings b ON d.id = b.resource_id AND b.date = $2 AND b.status IN ('CONFIRMED', 'CHECKED_IN')
     WHERE d.floor_id = $1
     ORDER BY d.code ASC`,
    [floorId, date]
  );

  const mapped = desks.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    category: d.category,
    floorId: d.floor_id,
    zoneId: d.zone_id,
    zoneName: d.zone_name,
    zoneColor: d.zone_color,
    designatedTeam: d.designated_team,
    posX: d.pos_x,
    posY: d.pos_y,
    isAccessible: d.is_accessible === 1,
    hasStandingDesk: d.has_standing_desk === 1,
    hasDualMonitors: d.has_dual_monitors === 1,
    hasUsbCDock: d.has_usb_c_dock === 1,
    status: d.active_booking_id ? 'BOOKED' : d.status,
    qrOpaqueId: d.qr_opaque_id,
    activeBookingId: d.active_booking_id,
    bookedBy: d.booked_by_employee_name,
  }));

  res.json({ floorId, date, desks: mapped });
});

apiRouter.get('/resources/rooms', authenticate, async (req, res) => {
  const parse = RoomSearchSchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
    return;
  }

  const { date, startTime, endTime, minCapacity, floorId, hasVideoConference } = parse.data;

  let sql = 'SELECT r.*, f.name as floor_name FROM rooms r JOIN floors f ON r.floor_id = f.id WHERE 1=1';
  const params: any[] = [];

  if (minCapacity) {
    params.push(minCapacity);
    sql += ` AND r.capacity >= $${params.length}`;
  }
  if (floorId) {
    params.push(floorId);
    sql += ` AND r.floor_id = $${params.length}`;
  }
  if (hasVideoConference) {
    sql += ' AND r.has_video_conference = 1';
  }

  sql += ' ORDER BY r.capacity ASC';
  const rooms = await query(sql, params);

  // If time window provided, annotate availability
  const roomsWithAvailability = await Promise.all(
    rooms.map(async (room) => {
      let isAvailable = room.status === 'AVAILABLE';
      let conflictingBooking: any = null;

      if (startTime && endTime) {
        conflictingBooking = await queryOne(
          `SELECT id, title, employee_name, start_time, end_time FROM bookings
           WHERE resource_id = $1 AND date = $2 AND status IN ('CONFIRMED', 'CHECKED_IN')
             AND start_time < $3 AND end_time > $4`,
          [room.id, date, endTime, startTime]
        );
        if (conflictingBooking) {
          isAvailable = false;
        }
      }

      return {
        id: room.id,
        code: room.code,
        name: room.name,
        category: room.category,
        floorId: room.floor_id,
        floorName: room.floor_name,
        capacity: room.capacity,
        isAccessible: room.is_accessible === 1,
        hasVideoConference: room.has_video_conference === 1,
        hasDigitalWhiteboard: room.has_digital_whiteboard === 1,
        hasPhoneBooth: room.has_phone_booth === 1,
        status: isAvailable ? 'AVAILABLE' : 'BOOKED',
        qrOpaqueId: room.qr_opaque_id,
        conflictingBooking,
      };
    })
  );

  res.json({ date, rooms: roomsWithAvailability });
});

// -----------------------------------------------------------------------------
// 3. Bookings
// -----------------------------------------------------------------------------
apiRouter.post('/bookings/desks', authenticate, bookingRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = CreateDeskBookingSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
      return;
    }

    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    const booking = await createDeskBooking({
      resourceId: parse.data.resourceId,
      date: parse.data.date,
      isQrOriginated: parse.data.isQrOriginated,
      user: req.user!,
      ipAddress: getIp(req),
      idempotencyKey,
    });

    res.status(201).json(booking);
  } catch (err: any) {
    if (err.message === 'DESK_ALREADY_BOOKED' || err.message?.startsWith('EMPLOYEE_ALREADY_HAS_DESK')) {
      res.status(409).json({ error: 'CONFLICT', message: err.message });
    } else {
      res.status(400).json({ error: 'BOOKING_FAILED', message: err.message });
    }
  }
});

apiRouter.post('/bookings/rooms', authenticate, bookingRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = CreateRoomBookingSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
      return;
    }

    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    const booking = await createRoomBooking({
      resourceId: parse.data.resourceId,
      date: parse.data.date,
      startTime: parse.data.startTime,
      endTime: parse.data.endTime,
      title: parse.data.title,
      attendeesCount: parse.data.attendeesCount,
      isQrOriginated: parse.data.isQrOriginated,
      user: req.user!,
      ipAddress: getIp(req),
      idempotencyKey,
    });

    res.status(201).json(booking);
  } catch (err: any) {
    if (err.message === 'ROOM_ALREADY_BOOKED') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Room is already booked for this time window',
        conflict: err.conflict,
        alternatives: err.alternatives,
      });
    } else {
      res.status(400).json({ error: 'BOOKING_FAILED', message: err.message });
    }
  }
});

apiRouter.get('/bookings/my', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const bookings = await getEmployeeBookings(req.user!.id);
  res.json({ bookings });
});

apiRouter.post('/bookings/:id/cancel', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await cancelBooking(req.params.id, req.user!, getIp(req));
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN_NOT_BOOKING_OWNER') {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot cancel another employee’s booking.' });
    } else {
      res.status(400).json({ error: err.message || 'CANCELLATION_FAILED' });
    }
  }
});

apiRouter.post('/bookings/:id/check-in', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await checkInBooking(req.params.id, req.user!, getIp(req));
    res.json({ success: true, booking });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'CHECKIN_FAILED' });
  }
});

// -----------------------------------------------------------------------------
// 4. QR Scanning & Tokens
// -----------------------------------------------------------------------------
apiRouter.post('/qr/scan', authenticate, generalApiLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = ScanQrPayloadSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
      return;
    }

    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const resolved = await resolveQrCode({
      rawQrData: parse.data.qrData,
      user: req.user!,
      date,
      ipAddress: getIp(req),
    });

    res.json(resolved);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'QR_RESOLUTION_FAILED' });
  }
});

apiRouter.post(
  '/qr/tokens',
  authenticate,
  requireRole('SUPER_ADMIN', 'FACILITIES_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = CreateOneTimeTokenSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
        return;
      }

      const result = await createOneTimeToken({
        ...parse.data,
        admin: req.user!,
        ipAddress: getIp(req),
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'TOKEN_CREATION_FAILED' });
    }
  }
);

apiRouter.post('/qr/tokens/redeem', authenticate, bookingRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = RedeemOneTimeTokenSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
      return;
    }

    const result = await redeemOneTimeToken({
      bearerToken: parse.data.bearerToken,
      targetResourceId: parse.data.targetResourceId,
      date: parse.data.date,
      user: req.user!,
      ipAddress: getIp(req),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'TOKEN_REDEMPTION_FAILED' });
  }
});

apiRouter.post(
  '/qr/tokens/:id/revoke',
  authenticate,
  requireRole('SUPER_ADMIN', 'FACILITIES_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = RevokeTokenSchema.safeParse({ tokenId: req.params.id, ...req.body });
      if (!parse.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
        return;
      }

      await revokeToken(req.params.id, parse.data.reason, req.user!, getIp(req));
      res.json({ success: true, message: 'Token revoked' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'REVOKE_FAILED' });
    }
  }
);

apiRouter.get(
  '/qr/inventory',
  authenticate,
  requireRole('SUPER_ADMIN', 'FACILITIES_ADMIN'),
  async (_req, res) => {
    const inventory = await getResourceQrInventory();
    res.json({ inventory });
  }
);

// -----------------------------------------------------------------------------
// 5. Office Events & Announcements
// -----------------------------------------------------------------------------
apiRouter.get('/events', authenticate, async (_req, res) => {
  const events = await query('SELECT * FROM office_events ORDER BY date ASC, start_time ASC');
  res.json({ events });
});

apiRouter.post('/events/:id/register', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const user = req.user!;

  const ev = await queryOne('SELECT * FROM office_events WHERE id = $1', [eventId]);
  if (!ev) {
    res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    return;
  }

  const existing = await queryOne(
    'SELECT * FROM event_registrations WHERE event_id = $1 AND employee_id = $2',
    [eventId, user.id]
  );
  if (existing) {
    res.status(400).json({ error: 'ALREADY_REGISTERED' });
    return;
  }

  await query(
    'INSERT INTO event_registrations (id, event_id, employee_id, registered_at) VALUES ($1, $2, $3, $4)',
    [`reg_${uuidv4()}`, eventId, user.id, new Date().toISOString()]
  );

  await query('UPDATE office_events SET registered_count = registered_count + 1 WHERE id = $1', [eventId]);
  res.json({ success: true, message: 'Successfully registered for event' });
});

apiRouter.get('/announcements', authenticate, async (_req, res) => {
  const announcements = await query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 20');
  res.json({ announcements });
});

apiRouter.post(
  '/announcements',
  authenticate,
  requireRole('SUPER_ADMIN', 'EVENTS_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = SendAnnouncementSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
        return;
      }

      await broadcastAnnouncement({
        title: parse.data.title,
        content: parse.data.content,
        severity: parse.data.severity,
        authorName: req.user!.name,
        targetDepartment: parse.data.targetDepartment,
        sendPush: parse.data.sendPushNotification,
      });

      res.status(201).json({ success: true, message: 'Announcement broadcasted' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'ANNOUNCEMENT_FAILED' });
    }
  }
);

apiRouter.get('/notifications/my', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const notifications = await getNotificationsForEmployee(req.user!.id);
  res.json({ notifications });
});

// -----------------------------------------------------------------------------
// 6. Admin Endpoints
// -----------------------------------------------------------------------------
apiRouter.get(
  '/admin/employees',
  authenticate,
  requireRole('SUPER_ADMIN', 'FACILITIES_ADMIN'),
  async (_req, res) => {
    const employees = await query('SELECT * FROM employees ORDER BY employee_code ASC');
    res.json({ employees });
  }
);

apiRouter.post(
  '/admin/employees/assign-role',
  authenticate,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = AssignRoleSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
        return;
      }

      await assignUserRole(parse.data.userId, parse.data.role, req.user!, getIp(req));
      res.json({ success: true, message: 'Role assigned successfully' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

apiRouter.post(
  '/admin/employees/suspend',
  authenticate,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = SuspendUserSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
        return;
      }

      await setUserSuspension(parse.data.userId, parse.data.isSuspended, parse.data.reason, req.user!, getIp(req));
      res.json({ success: true, message: parse.data.isSuspended ? 'Employee suspended' : 'Employee reactivated' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

apiRouter.post(
  '/admin/employees/import',
  authenticate,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dryRun = req.query.dryRun !== 'false';
      let fileBuffer: Buffer;

      if (req.body?.fileBase64) {
        fileBuffer = Buffer.from(req.body.fileBase64, 'base64');
      } else if (Buffer.isBuffer(req.body)) {
        fileBuffer = req.body;
      } else {
        res.status(400).json({ error: 'MISSING_FILE', message: 'Provide fileBase64 in JSON or binary body' });
        return;
      }

      const result = await processEmployeeImport(fileBuffer, dryRun, req.user!, getIp(req));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'IMPORT_FAILED' });
    }
  }
);

apiRouter.get('/admin/policies', authenticate, async (_req, res) => {
  const policy = await getBookingPolicies();
  res.json({ policy });
});

apiRouter.put(
  '/admin/policies',
  authenticate,
  requireRole('SUPER_ADMIN', 'FACILITIES_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = UpdatePolicySchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parse.error.format() });
        return;
      }

      await updateBookingPolicies(parse.data, req.user!, getIp(req));
      res.json({ success: true, policy: parse.data });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

apiRouter.get(
  '/admin/audit-logs',
  authenticate,
  requireRole('SUPER_ADMIN'),
  async (_req, res) => {
    const logs = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50');
    res.json({ logs });
  }
);

apiRouter.get(
  '/admin/security-events',
  authenticate,
  requireRole('SUPER_ADMIN'),
  async (_req, res) => {
    const events = await query('SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 50');
    res.json({ events });
  }
);
