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

const API_BASE = '/api';

let authToken: string | null = localStorage.getItem('gcc_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('gcc_token', token);
  } else {
    localStorage.removeItem('gcc_token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

// 1. Auth API
export async function devLogin(employeeCode: string) {
  const res = await apiFetch<{ success: boolean; token: string; user: EmployeeUser }>(
    '/auth/dev-login',
    {
      method: 'POST',
      body: JSON.stringify({ employeeCode }),
    }
  );
  setAuthToken(res.token);
  return res;
}

export async function requestOtp(email: string) {
  return await apiFetch<{ success: boolean; message: string; devOtp?: string }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, otp: string) {
  const res = await apiFetch<{ success: boolean; token: string; user: EmployeeUser }>(
    '/auth/verify-otp',
    {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }
  );
  setAuthToken(res.token);
  return res;
}

export async function getCurrentUser() {
  return await apiFetch<{ user: EmployeeUser }>('/auth/me');
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  setAuthToken(null);
}

// 2. Resources & Map API
export async function getFloors() {
  return await apiFetch<{ floors: any[]; zones: any[] }>('/resources/floors');
}

export async function getFloorDesks(floorId: string, date: string) {
  return await apiFetch<{ floorId: string; date: string; desks: any[] }>(
    `/resources/floors/${floorId}/desks?date=${date}`
  );
}

export async function searchRooms(params: {
  date: string;
  startTime?: string;
  endTime?: string;
  minCapacity?: number;
}) {
  const query = new URLSearchParams(params as any).toString();
  return await apiFetch<{ date: string; rooms: any[] }>(`/resources/rooms?${query}`);
}

// 3. Bookings API
export async function createDeskBooking(resourceId: string, date: string, isQrOriginated = false) {
  const idempotencyKey = `web_desk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await apiFetch<Booking>('/bookings/desks', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ resourceId, date, isQrOriginated }),
  });
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
  const idempotencyKey = `web_rm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await apiFetch<Booking>('/bookings/rooms', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(params),
  });
}

export async function getMyBookings() {
  return await apiFetch<{ bookings: Booking[] }>('/bookings/my');
}

export async function cancelBooking(id: string) {
  return await apiFetch(`/bookings/${id}/cancel`, { method: 'POST' });
}

export async function checkInBooking(id: string) {
  return await apiFetch<{ success: boolean; booking: Booking }>(`/bookings/${id}/check-in`, {
    method: 'POST',
  });
}

// 4. QR API
export async function scanQrCode(qrData: string, date?: string) {
  const query = date ? `?date=${date}` : '';
  return await apiFetch<any>(`/qr/scan${query}`, {
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
  return await apiFetch<any>('/qr/tokens', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function redeemOneTimeToken(bearerToken: string, targetResourceId?: string, date?: string) {
  return await apiFetch<any>('/qr/tokens/redeem', {
    method: 'POST',
    body: JSON.stringify({ bearerToken, targetResourceId, date }),
  });
}

export async function getQrInventory() {
  return await apiFetch<{ inventory: any[] }>('/qr/inventory');
}

// 5. Events & Announcements
export async function getEvents() {
  return await apiFetch<{ events: OfficeEvent[] }>('/events');
}

export async function registerForEvent(eventId: string) {
  return await apiFetch(`/events/${eventId}/register`, { method: 'POST' });
}

export async function getAnnouncements() {
  return await apiFetch<{ announcements: Announcement[] }>('/announcements');
}

export async function broadcastAnnouncement(params: {
  title: string;
  content: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  targetDepartment?: string;
  sendPushNotification?: boolean;
}) {
  return await apiFetch('/announcements', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// 6. Admin API
export async function getAdminEmployees() {
  return await apiFetch<{ employees: EmployeeUser[] }>('/admin/employees');
}

export async function assignUserRole(userId: string, role: UserRole) {
  return await apiFetch('/admin/employees/assign-role', {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });
}

export async function suspendUser(userId: string, isSuspended: boolean, reason: string) {
  return await apiFetch('/admin/employees/suspend', {
    method: 'POST',
    body: JSON.stringify({ userId, isSuspended, reason }),
  });
}

export async function importEmployees(fileBase64: string, dryRun: boolean) {
  return await apiFetch<any>(`/admin/employees/import?dryRun=${dryRun}`, {
    method: 'POST',
    body: JSON.stringify({ fileBase64 }),
  });
}

export async function getPolicies() {
  return await apiFetch<{ policy: BookingPolicy }>('/admin/policies');
}

export async function updatePolicies(policy: BookingPolicy) {
  return await apiFetch<{ success: boolean; policy: BookingPolicy }>('/admin/policies', {
    method: 'PUT',
    body: JSON.stringify(policy),
  });
}

export async function getAuditLogs() {
  return await apiFetch<{ logs: AuditLogEntry[] }>('/admin/audit-logs');
}

export async function getSecurityEvents() {
  return await apiFetch<{ events: SecurityEventEntry[] }>('/admin/security-events');
}
