import { z } from 'zod';

export const UserRoleSchema = z.enum([
  'EMPLOYEE',
  'TEAM_COORDINATOR',
  'FACILITIES_ADMIN',
  'EVENTS_ADMIN',
  'SUPER_ADMIN',
  'RECEPTION_ADMIN',
]);

// Auth Schemas
export const DevLoginSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required'),
});

export const OtpRequestSchema = z.object({
  email: z.string().email('Valid corporate email is required').refine(
    (e) => e.endsWith('@company.com') || e.endsWith('@gcc.internal') || e.endsWith('@demo.gcc.internal'),
    { message: 'Must be an approved corporate domain email' }
  ),
});

export const OtpVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain numbers only'),
});

// Desk Booking
export const CreateDeskBookingSchema = z.object({
  resourceId: z.string().min(1, 'Resource ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  isQrOriginated: z.boolean().default(false),
});

// Room Booking
export const CreateRoomBookingSchema = z.object({
  resourceId: z.string().min(1, 'Resource ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm (24hr)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be HH:mm (24hr)'),
  title: z.string().min(3).max(100).default('Team Meeting'),
  attendeesCount: z.number().int().min(1).max(50).default(2),
  isQrOriginated: z.boolean().default(false),
}).refine(
  (data) => data.startTime < data.endTime,
  { message: 'Start time must be before end time', path: ['endTime'] }
);

// Room Search
export const RoomSearchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
  floorId: z.string().optional(),
  hasVideoConference: z.coerce.boolean().optional(),
});

// Check-in & Cancellation
export const CheckInSchema = z.object({
  bookingId: z.string().min(1),
  qrOpaqueId: z.string().optional(),
});

export const CancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().max(200).optional(),
});

// QR Scanning
export const ScanQrPayloadSchema = z.object({
  qrData: z.string().min(1).max(500),
});

// One-Time Booking Tokens
export const CreateOneTimeTokenSchema = z.object({
  scopeResourceId: z.string().optional(),
  scopeCategory: z.enum(['DESK', 'MEETING_ROOM', 'COLLAB_TABLE']).optional(),
  maxRedemptions: z.number().int().min(1).max(100).default(1),
  validHours: z.number().min(0.5).max(168).default(24), // max 7 days
  restrictedEmployeeId: z.string().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookingStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  bookingEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  purpose: z.string().min(3).max(100),
});

export const RedeemOneTimeTokenSchema = z.object({
  bearerToken: z.string().min(8).max(128),
  targetResourceId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const RevokeTokenSchema = z.object({
  tokenId: z.string().min(1),
  reason: z.string().min(3).max(100),
});

// Administration
export const AssignRoleSchema = z.object({
  userId: z.string().min(1),
  role: UserRoleSchema,
});

export const SuspendUserSchema = z.object({
  userId: z.string().min(1),
  isSuspended: z.boolean(),
  reason: z.string().min(3).max(200),
});

export const UpdatePolicySchema = z.object({
  maxDeskDaysInAdvance: z.number().int().min(1).max(60),
  maxActiveDeskBookingsPerEmployee: z.number().int().min(1).max(10),
  maxRoomHoursPerBooking: z.number().int().min(1).max(12),
  checkInWindowMinutesBefore: z.number().int().min(5).max(60),
  autoReleaseGracePeriodMinutes: z.number().int().min(5).max(60),
  requireCheckIn: z.boolean(),
});

export const SendAnnouncementSchema = z.object({
  title: z.string().min(3).max(120),
  content: z.string().min(5).max(1000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  targetDepartment: z.string().optional(),
  sendPushNotification: z.boolean().default(false),
});

export const RegisterEventSchema = z.object({
  eventId: z.string().min(1),
});
