import {
  EmployeeUser,
  Booking,
  BookingPolicy,
  UserRole,
  OfficeEvent,
  Announcement,
  AuditLogEntry,
  SecurityEventEntry,
} from '@gcc-connect/shared';

// Read API base from environment (injected at build time by Vite)
// Falls back to '/api' which is proxied to localhost:4000 in dev
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

// ------------------------------------------------------------------
// Token management — stored in localStorage, sent as Bearer header.
// httpOnly cookies are ALSO set server-side for CSRF-safe sessions.
// ------------------------------------------------------------------
let authToken: string | null = (() => {
  try {
    return localStorage.getItem('gcc_token');
  } catch {
    return null; // SSR or storage blocked
  }
})();

export function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem('gcc_token', token);
    } else {
      localStorage.removeItem('gcc_token');
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — token stays in memory
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

// ------------------------------------------------------------------
// Core fetch wrapper — injects auth, handles errors uniformly
// ------------------------------------------------------------------
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  // Set content type unless uploading FormData
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  // Merge any extra headers (e.g. Idempotency-Key)
  Object.entries(extraHeaders).forEach(([k, v]) => headers.set(k, v));

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // include cookies for server-side session
  });

  // Try to parse JSON body for error messages
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(
      data.message || data.error || `HTTP ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    // Surface conflict alternatives (e.g. room booking)
    if (data.alternatives) error.alternatives = data.alternatives;
    throw error;
  }

  return data as T;
}

// ==================================================================
// 1. Authentication
// ==================================================================
export async function devLogin(employeeCode: string) {
  const res = await apiFetch<{ success: boolean; token: string; user: EmployeeUser }>(
    '/auth/dev-login',
    { method: 'POST', body: JSON.stringify({ employeeCode }) }
  );
  setAuthToken(res.token);
  return res;
}

export async function requestOtp(email: string) {
  return apiFetch<{ success: boolean; message: string; devOtp?: string }>(
    '/auth/request-otp',
    { method: 'POST', body: JSON.stringify({ email }) }
  );
}

export async function verifyOtp(email: string, otp: string) {
  const res = await apiFetch<{ success: boolean; token: string; user: EmployeeUser }>(
    '/auth/verify-otp',
    { method: 'POST', body: JSON.stringify({ email, otp }) }
  );
  setAuthToken(res.token);
  return res;
}

export async function getCurrentUser() {
  return apiFetch<{ user: EmployeeUser }>('/auth/me');
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  setAuthToken(null);
}

// ==================================================================
// 2. Resources & Map
// ==================================================================
export async function getFloors() {
  return apiFetch<{ floors: any[]; zones: any[] }>('/resources/floors');
}

export async function getFloorDesks(floorId: string, date: string) {
  return apiFetch<{ floorId: string; date: string; desks: any[] }>(
    `/resources/floors/${floorId}/desks?date=${encodeURIComponent(date)}`
  );
}

export async function searchRooms(params: {
  date: string;
  startTime?: string;
  endTime?: string;
  minCapacity?: number;
  floorId?: string;
}) {
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ) as Record<string, string>
  ).toString();
  return apiFetch<{ date: string; rooms: any[] }>(`/resources/rooms?${query}`);
}

// Admin: Update zone assignment for a desk (map editing)
export async function updateDeskZone(deskId: string, zoneId: string) {
  return apiFetch<{ success: boolean }>('/admin/resources/desk-zone', {
    method: 'PUT',
    body: JSON.stringify({ deskId, zoneId }),
  });
}

// Admin: Bulk update zone seat allocations
export async function bulkUpdateZones(
  assignments: Array<{ deskCode: string; zoneId: string; designatedTeam?: string }>
) {
  return apiFetch<{ success: boolean; updated: number }>('/admin/resources/zone-assignments', {
    method: 'PUT',
    body: JSON.stringify({ assignments }),
  });
}

// ==================================================================
// 3. Bookings
// ==================================================================
export async function createDeskBooking(
  resourceId: string,
  date: string,
  isQrOriginated = false
) {
  const idempotencyKey = `web_desk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return apiFetch<Booking>(
    '/bookings/desks',
    { method: 'POST', body: JSON.stringify({ resourceId, date, isQrOriginated }) },
    { 'Idempotency-Key': idempotencyKey }
  );
}

export async function createRoomBooking(params: {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  attendeesCount: number;
  isQrOriginated?: boolean;
}) {
  const idempotencyKey = `web_rm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return apiFetch<Booking>(
    '/bookings/rooms',
    { method: 'POST', body: JSON.stringify(params) },
    { 'Idempotency-Key': idempotencyKey }
  );
}

export async function getMyBookings() {
  return apiFetch<{ bookings: Booking[] }>('/bookings/my');
}

export async function cancelBooking(id: string) {
  return apiFetch<{ success: boolean; message: string }>(`/bookings/${id}/cancel`, {
    method: 'POST',
  });
}

export async function checkInBooking(id: string) {
  return apiFetch<{ success: boolean; booking: Booking }>(`/bookings/${id}/check-in`, {
    method: 'POST',
  });
}

// ==================================================================
// 4. QR Codes & One-Time Tokens
// ==================================================================
export async function scanQrCode(qrData: string, date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<any>(`/qr/scan${query}`, {
    method: 'POST',
    body: JSON.stringify({ qrData }),
  });
}

export async function createOneTimeToken(params: {
  scopeResourceId?: string;
  scopeCategory?: string;
  maxRedemptions: number;
  validHours: number;
  purpose: string;
}) {
  return apiFetch<any>('/qr/tokens', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function redeemOneTimeToken(
  bearerToken: string,
  targetResourceId?: string,
  date?: string
) {
  return apiFetch<any>('/qr/tokens/redeem', {
    method: 'POST',
    body: JSON.stringify({ bearerToken, targetResourceId, date }),
  });
}

export async function getQrInventory() {
  return apiFetch<{ inventory: any[] }>('/qr/inventory');
}

// ==================================================================
// 5. Events & Announcements
// ==================================================================
export async function getEvents() {
  return apiFetch<{ events: OfficeEvent[] }>('/events');
}

export async function registerForEvent(eventId: string) {
  return apiFetch<{ success: boolean; message: string }>(
    `/events/${eventId}/register`,
    { method: 'POST' }
  );
}

export async function getAnnouncements() {
  return apiFetch<{ announcements: Announcement[] }>('/announcements');
}

export async function broadcastAnnouncement(params: {
  title: string;
  content: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  targetDepartment?: string;
  sendPushNotification?: boolean;
}) {
  return apiFetch<{ success: boolean; message: string }>('/announcements', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ==================================================================
// 6. Admin
// ==================================================================
export async function getAdminEmployees() {
  return apiFetch<{ employees: EmployeeUser[] }>('/admin/employees');
}

export async function assignUserRole(userId: string, role: UserRole) {
  return apiFetch<{ success: boolean; message: string }>('/admin/employees/assign-role', {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });
}

export async function suspendUser(userId: string, isSuspended: boolean, reason: string) {
  return apiFetch<{ success: boolean; message: string }>('/admin/employees/suspend', {
    method: 'POST',
    body: JSON.stringify({ userId, isSuspended, reason }),
  });
}

export async function importEmployees(fileBase64: string, dryRun: boolean) {
  return apiFetch<any>(`/admin/employees/import?dryRun=${dryRun}`, {
    method: 'POST',
    body: JSON.stringify({ fileBase64 }),
  });
}

export async function getPolicies() {
  return apiFetch<{ policy: BookingPolicy }>('/admin/policies');
}

export async function updatePolicies(policy: BookingPolicy) {
  return apiFetch<{ success: boolean; policy: BookingPolicy }>('/admin/policies', {
    method: 'PUT',
    body: JSON.stringify(policy),
  });
}

export async function getAuditLogs() {
  return apiFetch<{ logs: AuditLogEntry[] }>('/admin/audit-logs');
}

export async function getSecurityEvents() {
  return apiFetch<{ events: SecurityEventEntry[] }>('/admin/security-events');
}
