import { Booking, EmployeeUser } from '@gcc-connect/shared';

// For Android emulator 10.0.2.2, iOS localhost, or local dev machine IP
const API_HOST = 'http://10.0.2.2:4000/api';

let mobileAuthToken: string | null = null;

export function setMobileToken(token: string | null) {
  mobileAuthToken = token;
}

export function getMobileToken(): string | null {
  return mobileAuthToken;
}

export async function mobileFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (mobileAuthToken) {
    headers.set('Authorization', `Bearer ${mobileAuthToken}`);
  }

  const response = await fetch(`${API_HOST}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Network request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export async function mobileDevLogin(employeeCode: string) {
  const res = await mobileFetch<{ success: boolean; token: string; user: EmployeeUser }>(
    '/auth/dev-login',
    {
      method: 'POST',
      body: JSON.stringify({ employeeCode }),
    }
  );
  setMobileToken(res.token);
  return res;
}

export async function mobileGetDesks(floorId: string, date: string) {
  return await mobileFetch<{ floorId: string; date: string; desks: any[] }>(
    `/resources/floors/${floorId}/desks?date=${date}`
  );
}

export async function mobileScanQr(qrData: string, date?: string) {
  const query = date ? `?date=${date}` : '';
  return await mobileFetch<any>(`/qr/scan${query}`, {
    method: 'POST',
    body: JSON.stringify({ qrData }),
  });
}

export async function mobileBookDesk(resourceId: string, date: string, isQrOriginated = false) {
  const idempotencyKey = `mob_desk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await mobileFetch<Booking>('/bookings/desks', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ resourceId, date, isQrOriginated }),
  });
}

export async function mobileBookRoom(params: {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  attendeesCount: number;
  isQrOriginated?: boolean;
}) {
  const idempotencyKey = `mob_rm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await mobileFetch<Booking>('/bookings/rooms', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(params),
  });
}

export async function mobileGetMyBookings() {
  return await mobileFetch<{ bookings: Booking[] }>('/bookings/my');
}

export async function mobileCheckInBooking(id: string) {
  return await mobileFetch<{ success: boolean; booking: Booking }>(`/bookings/${id}/check-in`, {
    method: 'POST',
  });
}

export async function mobileCancelBooking(id: string) {
  return await mobileFetch(`/bookings/${id}/cancel`, { method: 'POST' });
}

export async function mobileGetEvents() {
  return await mobileFetch<{ events: any[] }>('/events');
}

export async function mobileGetAnnouncements() {
  return await mobileFetch<{ announcements: any[] }>('/announcements');
}
