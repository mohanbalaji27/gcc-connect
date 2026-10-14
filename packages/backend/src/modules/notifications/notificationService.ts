import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute, query } from '../../db/index.js';
import { NotificationType } from '@gcc-connect/shared';

const ALLOWED_TEMPLATES: Set<NotificationType> = new Set([
  'BOOKING_CONFIRMATION',
  'BOOKING_CANCELLATION',
  'CHECKIN_REMINDER',
  'AUTO_RELEASE_WARNING',
  'ANNOUNCEMENT_BROADCAST',
  'SECURITY_ALERT',
]);

export async function isNotificationServiceEnabled(): Promise<boolean> {
  const setting = await queryOne(
    'SELECT value FROM app_settings WHERE key = $1',
    ['notifications_enabled']
  );
  return setting ? setting.value === 'true' : true;
}

export async function sendNotification(options: {
  type: NotificationType;
  recipientId: string;
  recipientEmail: string;
  title: string;
  body: string;
}): Promise<{ id: string; status: 'SENT' | 'SUPPRESSED' }> {
  const { type, recipientId, recipientEmail, title, body } = options;

  if (!ALLOWED_TEMPLATES.has(type)) {
    throw new Error(`UNAUTHORIZED_NOTIFICATION_TEMPLATE:${type}`);
  }

  // Check emergency kill-switch
  const enabled = await isNotificationServiceEnabled();
  if (!enabled && type !== 'SECURITY_ALERT') {
    return { id: 'suppressed', status: 'SUPPRESSED' };
  }

  // Sanitize message body to prevent injection
  const sanitizedTitle = title.replace(/<[^>]*>?/gm, '').trim();
  const sanitizedBody = body.replace(/<[^>]*>?/gm, '').trim();

  const id = `notif_${uuidv4()}`;
  const now = new Date().toISOString();

  // Save in transactional outbox
  await execute(
    `INSERT INTO notifications_outbox (id, type, recipient_id, recipient_email, title, body, status, sent_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'SENT', $7, $8)`,
    [id, type, recipientId, recipientEmail, sanitizedTitle, sanitizedBody, now, now]
  );

  return { id, status: 'SENT' };
}

export async function broadcastAnnouncement(options: {
  title: string;
  content: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  authorName: string;
  targetDepartment?: string;
  sendPush?: boolean;
}): Promise<void> {
  const { title, content, severity, authorName, targetDepartment, sendPush = false } = options;
  const announcementId = `ann_${uuidv4()}`;
  const now = new Date().toISOString();

  await execute(
    `INSERT INTO announcements (id, title, content, severity, author_name, created_at, target_department)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [announcementId, title, content, severity, authorName, now, targetDepartment || null]
  );

  if (sendPush) {
    // Deliver notification to active employees
    let employeesQuery = 'SELECT id, email FROM employees WHERE is_active = 1';
    const params: any[] = [];
    if (targetDepartment) {
      employeesQuery += ' AND department = $1';
      params.push(targetDepartment);
    }

    const recipients = await query<{ id: string; email: string }>(employeesQuery, params);
    for (const recipient of recipients) {
      await sendNotification({
        type: 'ANNOUNCEMENT_BROADCAST',
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        title: `GCC Announcement: ${title}`,
        body: content.substring(0, 150),
      }).catch(() => {});
    }
  }
}

export async function getNotificationsForEmployee(employeeId: string) {
  return await query(
    'SELECT * FROM notifications_outbox WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 20',
    [employeeId]
  );
}
