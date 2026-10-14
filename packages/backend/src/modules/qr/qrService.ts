import crypto from 'crypto';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, transaction } from '../../db/index.js';
import { OneTimeBookingToken, ResourceCategory } from '@gcc-connect/shared';
import { AuthContext, hashString } from '../auth/authService.js';
import { logAuditEvent, logSecurityEvent } from '../security/auditLogger.js';
import { createDeskBooking, createRoomBooking } from '../bookings/bookingService.js';
import { withResourceLock } from '../bookings/mutex.js';

export async function resolveQrCode(options: {
  rawQrData: string;
  user: AuthContext;
  date?: string;
  ipAddress: string;
}) {
  const { rawQrData, user, date = new Date().toISOString().split('T')[0], ipAddress } = options;

  let opaqueCode = rawQrData.trim();

  // Strip prefixes like gcc://book/ or https://.../scan?code=
  if (opaqueCode.startsWith('gcc://book/')) {
    opaqueCode = opaqueCode.replace('gcc://book/', '');
  } else if (opaqueCode.includes('code=')) {
    const url = new URL(opaqueCode, 'http://localhost');
    opaqueCode = url.searchParams.get('code') || opaqueCode;
  }

  // Check if it's a physical resource QR
  const qrRecord = await queryOne('SELECT * FROM resource_qrs WHERE opaque_code = $1 AND is_active = 1', [opaqueCode]);

  if (qrRecord) {
    if (qrRecord.resource_category === 'DESK') {
      const desk = await queryOne(
        `SELECT d.*, z.name as zone_name, z.color_hex as zone_color, z.designated_team 
         FROM desks d 
         LEFT JOIN zones z ON d.zone_id = z.id 
         WHERE d.id = $1`,
        [qrRecord.resource_id]
      );

      if (!desk) {
        throw new Error('RESOURCE_NOT_FOUND');
      }

      // Check current booking status for the requested date
      const existingBooking = await queryOne(
        `SELECT id, employee_id, employee_name, start_time, end_time, status 
         FROM bookings 
         WHERE resource_id = $1 AND date = $2 AND status IN ('CONFIRMED', 'CHECKED_IN')`,
        [desk.id, date]
      );

      const isBooked = !!existingBooking;
      const isBookedByCurrentUser = existingBooking?.employee_id === user.id;

      await logAuditEvent({
        action: 'SCAN_PHYSICAL_QR',
        actorId: user.id,
        actorEmail: user.email,
        targetType: 'PHYSICAL_QR',
        targetId: qrRecord.id,
        details: { opaqueCode, resourceCategory: 'DESK', resourceCode: desk.code },
        ipAddress,
      });

      return {
        type: 'PHYSICAL_RESOURCE',
        category: 'DESK',
        resource: {
          id: desk.id,
          code: desk.code,
          name: desk.name,
          category: 'DESK',
          zoneName: desk.zone_name,
          zoneColor: desk.zone_color,
          designatedTeam: desk.designated_team,
          isAccessible: desk.is_accessible === 1,
          hasStandingDesk: desk.has_standing_desk === 1,
          hasDualMonitors: desk.has_dual_monitors === 1,
          hasUsbCDock: desk.has_usb_c_dock === 1,
          status: desk.status,
          isAvailable: !isBooked && desk.status === 'AVAILABLE',
          isBookedByCurrentUser,
          activeBookingId: existingBooking?.id,
        },
      };
    } else if (qrRecord.resource_category === 'MEETING_ROOM') {
      const room = await queryOne('SELECT * FROM rooms WHERE id = $1', [qrRecord.resource_id]);
      if (!room) {
        throw new Error('RESOURCE_NOT_FOUND');
      }

      // List bookings for room on date
      const roomBookings = await query(
        `SELECT id, start_time, end_time, title, employee_name 
         FROM bookings 
         WHERE resource_id = $1 AND date = $2 AND status IN ('CONFIRMED', 'CHECKED_IN')
         ORDER BY start_time ASC`,
        [room.id, date]
      );

      await logAuditEvent({
        action: 'SCAN_PHYSICAL_QR',
        actorId: user.id,
        actorEmail: user.email,
        targetType: 'PHYSICAL_QR',
        targetId: qrRecord.id,
        details: { opaqueCode, resourceCategory: 'MEETING_ROOM', resourceCode: room.code },
        ipAddress,
      });

      return {
        type: 'PHYSICAL_RESOURCE',
        category: 'MEETING_ROOM',
        resource: {
          id: room.id,
          code: room.code,
          name: room.name,
          category: 'MEETING_ROOM',
          capacity: room.capacity,
          isAccessible: room.is_accessible === 1,
          hasVideoConference: room.has_video_conference === 1,
          hasDigitalWhiteboard: room.has_digital_whiteboard === 1,
          hasPhoneBooth: room.has_phone_booth === 1,
          status: room.status,
          scheduledBookings: roomBookings,
        },
      };
    }
  }

  // If not a physical QR, check if it's a one-time token reference or bearer token
  const tokenHash = hashString(opaqueCode);
  const tokenRecord = await queryOne(
    'SELECT * FROM one_time_tokens WHERE token_hash = $1 OR token_identifier = $2',
    [tokenHash, opaqueCode]
  );

  if (tokenRecord) {
    return {
      type: 'ONE_TIME_TOKEN',
      tokenIdentifier: tokenRecord.token_identifier,
      purpose: tokenRecord.purpose,
      scopeCategory: tokenRecord.scope_category,
      maxRedemptions: tokenRecord.max_redemptions,
      redemptionsCount: tokenRecord.redemptions_count,
      expiresAt: tokenRecord.expires_at,
      isRevoked: !!tokenRecord.revoked_at,
      isExpired: new Date(tokenRecord.expires_at).getTime() < Date.now(),
    };
  }

  throw new Error('INVALID_QR_PAYLOAD');
}

export async function createOneTimeToken(options: {
  scopeResourceId?: string;
  scopeCategory?: ResourceCategory;
  maxRedemptions?: number;
  validHours?: number;
  restrictedEmployeeId?: string;
  bookingDate?: string;
  bookingStartTime?: string;
  bookingEndTime?: string;
  purpose: string;
  admin: AuthContext;
  ipAddress: string;
}) {
  const {
    scopeResourceId,
    scopeCategory = 'DESK',
    maxRedemptions = 1,
    validHours = 24,
    restrictedEmployeeId,
    bookingDate,
    bookingStartTime,
    bookingEndTime,
    purpose,
    admin,
    ipAddress,
  } = options;

  // Generate 32-byte cryptographically secure token
  const rawBearerToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashString(rawBearerToken);
  const tokenIdentifier = `tok_${uuidv4().substring(0, 8)}`;
  const tokenId = `ott_${uuidv4()}`;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + validHours * 3600 * 1000).toISOString();

  await query(
    `INSERT INTO one_time_tokens (
       id, token_identifier, token_hash, scope_resource_id, scope_category,
       max_redemptions, redemptions_count, expires_at, restricted_employee_id,
       booking_date, booking_start_time, booking_end_time, created_by_admin_id,
       created_at, purpose
     ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      tokenId,
      tokenIdentifier,
      tokenHash,
      scopeResourceId || null,
      scopeCategory,
      maxRedemptions,
      expiresAt,
      restrictedEmployeeId || null,
      bookingDate || null,
      bookingStartTime || null,
      bookingEndTime || null,
      admin.id,
      now.toISOString(),
      purpose,
    ]
  );

  // Generate QR Data URL for display and scanning
  const qrPayload = `gcc://token/${rawBearerToken}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#0F275A', light: '#FFFFFF' },
  });

  await logAuditEvent({
    action: 'CREATE_ONE_TIME_TOKEN',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'ONE_TIME_TOKEN',
    targetId: tokenId,
    details: { tokenIdentifier, scopeCategory, maxRedemptions, validHours, purpose },
    ipAddress,
  });

  return {
    tokenId,
    tokenIdentifier,
    bearerToken: rawBearerToken, // returned once to admin
    qrDataUrl,
    expiresAt,
    maxRedemptions,
    purpose,
  };
}

export async function redeemOneTimeToken(options: {
  bearerToken: string;
  targetResourceId?: string;
  date?: string;
  user: AuthContext;
  ipAddress: string;
}) {
  const { bearerToken, targetResourceId, date, user, ipAddress } = options;
  const tokenHash = hashString(bearerToken);

  return await withResourceLock(`token:${tokenHash}`, async () => {
    return await transaction(async (client) => {
      // Row-level lock on the token to prevent concurrent redemption races
      const tokenRes = await client.query(
      'SELECT * FROM one_time_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    const token = tokenRes.rows[0];
    if (!token) {
      await logSecurityEvent({
        eventType: 'TOKEN_INVALID_REDEMPTION_ATTEMPT',
        severity: 'MEDIUM',
        description: `Attempt to redeem non-existent token by ${user.email}`,
        ipAddress,
        actorId: user.id,
      });
      throw new Error('TOKEN_NOT_FOUND');
    }

    if (token.revoked_at) {
      await logSecurityEvent({
        eventType: 'TOKEN_REVOKED_REDEMPTION_ATTEMPT',
        severity: 'MEDIUM',
        description: `Attempt to redeem revoked token ${token.token_identifier}`,
        ipAddress,
        actorId: user.id,
      });
      throw new Error('TOKEN_REVOKED');
    }

    const nowIso = new Date().toISOString();
    if (token.expires_at < nowIso) {
      throw new Error('TOKEN_EXPIRED');
    }

    // Atomic concurrency check
    if (token.redemptions_count >= token.max_redemptions) {
      await logSecurityEvent({
        eventType: 'TOKEN_MAX_REDEMPTIONS_EXCEEDED',
        severity: 'HIGH',
        description: `Concurrent/repeated redemption attempt on exhausted token ${token.token_identifier}`,
        ipAddress,
        actorId: user.id,
      });
      throw new Error('TOKEN_MAX_REDEMPTIONS_REACHED');
    }

    // Employee restriction check
    if (token.restricted_employee_id && token.restricted_employee_id !== user.id) {
      throw new Error('TOKEN_RESTRICTED_TO_OTHER_EMPLOYEE');
    }

    // Determine target resource
    const finalResourceId = token.scope_resource_id || targetResourceId;
    if (!finalResourceId) {
      throw new Error('TARGET_RESOURCE_REQUIRED');
    }

    const bookingDate = token.booking_date || date || nowIso.split('T')[0];

    // Atomically increment redemptions count
    await client.query(
      'UPDATE one_time_tokens SET redemptions_count = redemptions_count + 1 WHERE id = $1',
      [token.id]
    );

    // Create the booking if scope is defined
    let createdBooking: any = null;
    const redemptionId = `red_${uuidv4()}`;

    if (token.scope_category === 'MEETING_ROOM') {
      const startTime = token.booking_start_time || '10:00';
      const endTime = token.booking_end_time || '11:00';
      createdBooking = await createRoomBooking({
        resourceId: finalResourceId,
        date: bookingDate,
        startTime,
        endTime,
        title: `Token Reservation (${token.purpose})`,
        isQrOriginated: true,
        user,
        ipAddress,
      });
    } else {
      createdBooking = await createDeskBooking({
        resourceId: finalResourceId,
        date: bookingDate,
        isQrOriginated: true,
        user,
        ipAddress,
      });
    }

    await client.query(
      `INSERT INTO token_redemptions (id, token_id, employee_id, booking_id, redeemed_at, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [redemptionId, token.id, user.id, createdBooking.id, nowIso, ipAddress]
    );

      return {
        success: true,
        tokenIdentifier: token.token_identifier,
        booking: createdBooking,
      };
    });
  });
}

export async function revokeToken(tokenId: string, reason: string, admin: AuthContext, ipAddress: string): Promise<void> {
  const token = await queryOne('SELECT * FROM one_time_tokens WHERE id = $1', [tokenId]);
  if (!token) {
    throw new Error('TOKEN_NOT_FOUND');
  }

  const now = new Date().toISOString();
  await query('UPDATE one_time_tokens SET revoked_at = $1 WHERE id = $2', [now, tokenId]);

  await logAuditEvent({
    action: 'REVOKE_TOKEN',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'ONE_TIME_TOKEN',
    targetId: tokenId,
    details: { reason },
    ipAddress,
  });
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#0B1A3D', light: '#FFFFFF' },
  });
}

export async function getResourceQrInventory() {
  const rows = await query<any>(
    `SELECT q.id, q.opaque_code, q.resource_category, q.encoded_payload,
            d.code as desk_code, d.name as desk_name, z.name as zone_name,
            r.code as room_code, r.name as room_name, r.capacity as room_capacity
     FROM resource_qrs q
     LEFT JOIN desks d ON q.resource_id = d.id
     LEFT JOIN zones z ON d.zone_id = z.id
     LEFT JOIN rooms r ON q.resource_id = r.id
     ORDER BY q.resource_category ASC, d.code ASC, r.code ASC`
  );

  return rows.map((r) => ({
    qrId: r.id,
    opaqueCode: r.opaque_code,
    category: r.resource_category,
    label: r.resource_category === 'DESK' ? r.desk_code : r.room_code,
    name: r.resource_category === 'DESK' ? r.desk_name : r.room_name,
    subtext: r.resource_category === 'DESK' ? r.zone_name : `Capacity: ${r.room_capacity} pax`,
    payload: r.encoded_payload,
  }));
}
