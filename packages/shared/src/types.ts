export type UserRole =
  | 'EMPLOYEE'
  | 'TEAM_COORDINATOR'
  | 'FACILITIES_ADMIN'
  | 'EVENTS_ADMIN'
  | 'SUPER_ADMIN'
  | 'RECEPTION_ADMIN';

export type ResourceCategory = 'DESK' | 'MEETING_ROOM' | 'COLLAB_TABLE';

export type ResourceStatus = 'AVAILABLE' | 'BOOKED' | 'RESTRICTED' | 'MAINTENANCE';

export type BookingStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CANCELLED'
  | 'RELEASED'
  | 'EXPIRED';

export type QrType = 'PHYSICAL_RESOURCE' | 'ONE_TIME_TOKEN' | 'DYNAMIC_INVITE';

export type NotificationType =
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_CANCELLATION'
  | 'CHECKIN_REMINDER'
  | 'AUTO_RELEASE_WARNING'
  | 'ANNOUNCEMENT_BROADCAST'
  | 'SECURITY_ALERT';

export interface EmployeeUser {
  id: string;
  employeeCode: string;
  email: string;
  name: string;
  department: string;
  team: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface Amenity {
  id: string;
  name: string;
  code: string;
  icon: string;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  city: string;
  timeZone: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string;
  mapSvgUrl?: string;
}

export interface Zone {
  id: string;
  floorId: string;
  name: string;
  colorHex: string;
  designatedTeam?: string;
}

export interface DeskResource {
  id: string;
  code: string;
  name: string;
  category: 'DESK' | 'COLLAB_TABLE';
  floorId: string;
  zoneId?: string;
  posX: number;
  posY: number;
  isAccessible: boolean;
  hasStandingDesk: boolean;
  hasDualMonitors: boolean;
  hasUsbCDock: boolean;
  status: ResourceStatus;
  qrOpaqueId: string;
  activeBookingId?: string;
}

export interface RoomResource {
  id: string;
  code: string;
  name: string;
  category: 'MEETING_ROOM';
  floorId: string;
  capacity: number;
  isAccessible: boolean;
  hasVideoConference: boolean;
  hasDigitalWhiteboard: boolean;
  hasPhoneBooth: boolean;
  status: ResourceStatus;
  qrOpaqueId: string;
}

export interface Booking {
  id: string;
  resourceId: string;
  resourceCategory: ResourceCategory;
  resourceCode: string;
  resourceName: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm or ISO
  endTime: string; // HH:mm or ISO
  status: BookingStatus;
  checkInAt?: string;
  createdAt: string;
  isQrOriginated: boolean;
  title?: string;
  attendeesCount?: number;
}

export interface ResourceQr {
  id: string;
  resourceId: string;
  resourceCategory: ResourceCategory;
  opaqueCode: string;
  encodedPayload: string;
  createdAt: string;
  isActive: boolean;
}

export interface OneTimeBookingToken {
  id: string;
  tokenIdentifier: string; // public reference ID
  tokenHash: string; // secure SHA-256 hash of random bearer token
  scopeResourceId?: string;
  scopeCategory?: ResourceCategory;
  maxRedemptions: number;
  redemptionsCount: number;
  expiresAt: string;
  revokedAt?: string;
  restrictedEmployeeId?: string;
  bookingDate?: string;
  bookingStartTime?: string;
  bookingEndTime?: string;
  createdByAdminId: string;
  createdAt: string;
  purpose: string;
}

export interface OfficeEvent {
  id: string;
  title: string;
  description: string;
  category: 'WORKSHOP' | 'ALL_HANDS' | 'WELLNESS' | 'TECH_TALK' | 'SOCIAL';
  date: string;
  startTime: string;
  endTime: string;
  locationName: string;
  maxAttendees: number;
  registeredCount: number;
  organizerName: string;
  isWaitlistEnabled: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  authorName: string;
  createdAt: string;
  targetDepartment?: string;
}

export interface BookingPolicy {
  maxDeskDaysInAdvance: number;
  maxActiveDeskBookingsPerEmployee: number;
  maxRoomHoursPerBooking: number;
  checkInWindowMinutesBefore: number;
  autoReleaseGracePeriodMinutes: number;
  requireCheckIn: boolean;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

export interface SecurityEventEntry {
  id: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  ipAddress: string;
  actorId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
