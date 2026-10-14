-- GCC Connect Database Schema
-- Compatible with PostgreSQL 16 and in-memory SQL execution

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    team TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    is_active INTEGER NOT NULL DEFAULT 1,
    avatar_url TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    time_zone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS floors (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id),
    floor_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    map_svg_url TEXT
);

CREATE TABLE IF NOT EXISTS zones (
    id TEXT PRIMARY KEY,
    floor_id TEXT NOT NULL REFERENCES floors(id),
    name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    designated_team TEXT
);

CREATE TABLE IF NOT EXISTS desks (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'DESK',
    floor_id TEXT NOT NULL REFERENCES floors(id),
    zone_id TEXT REFERENCES zones(id),
    pos_x INTEGER NOT NULL,
    pos_y INTEGER NOT NULL,
    is_accessible INTEGER NOT NULL DEFAULT 0,
    has_standing_desk INTEGER NOT NULL DEFAULT 0,
    has_dual_monitors INTEGER NOT NULL DEFAULT 0,
    has_usb_c_dock INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    qr_opaque_id TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'MEETING_ROOM',
    floor_id TEXT NOT NULL REFERENCES floors(id),
    capacity INTEGER NOT NULL,
    is_accessible INTEGER NOT NULL DEFAULT 1,
    has_video_conference INTEGER NOT NULL DEFAULT 1,
    has_digital_whiteboard INTEGER NOT NULL DEFAULT 0,
    has_phone_booth INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    qr_opaque_id TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    resource_category TEXT NOT NULL,
    resource_code TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    employee_name TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    check_in_at TEXT,
    created_at TEXT NOT NULL,
    is_qr_originated INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    attendees_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_bookings_lookup ON bookings(resource_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_employee ON bookings(employee_id, date, status);

CREATE TABLE IF NOT EXISTS booking_idempotency (
    idempotency_key TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    response_code INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_qrs (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    resource_category TEXT NOT NULL,
    opaque_code TEXT UNIQUE NOT NULL,
    encoded_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS one_time_tokens (
    id TEXT PRIMARY KEY,
    token_identifier TEXT UNIQUE NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    scope_resource_id TEXT,
    scope_category TEXT,
    max_redemptions INTEGER NOT NULL DEFAULT 1,
    redemptions_count INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    restricted_employee_id TEXT,
    booking_date TEXT,
    booking_start_time TEXT,
    booking_end_time TEXT,
    created_by_admin_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    purpose TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS token_redemptions (
    id TEXT PRIMARY KEY,
    token_id TEXT NOT NULL REFERENCES one_time_tokens(id),
    employee_id TEXT NOT NULL REFERENCES employees(id),
    booking_id TEXT REFERENCES bookings(id),
    redeemed_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS office_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location_name TEXT NOT NULL,
    max_attendees INTEGER NOT NULL,
    registered_count INTEGER NOT NULL DEFAULT 0,
    organizer_name TEXT NOT NULL,
    is_waitlist_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS event_registrations (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES office_events(id),
    employee_id TEXT NOT NULL REFERENCES employees(id),
    registered_at TEXT NOT NULL,
    UNIQUE(event_id, employee_id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    author_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    target_department TEXT
);

CREATE TABLE IF NOT EXISTS booking_policies (
    id TEXT PRIMARY KEY,
    max_desk_days_in_advance INTEGER NOT NULL DEFAULT 14,
    max_active_desk_bookings_per_employee INTEGER NOT NULL DEFAULT 3,
    max_room_hours_per_booking INTEGER NOT NULL DEFAULT 4,
    check_in_window_minutes_before INTEGER NOT NULL DEFAULT 30,
    auto_release_grace_period_minutes INTEGER NOT NULL DEFAULT 15,
    require_check_in INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    actor_id TEXT,
    details TEXT,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, expires_at);

CREATE TABLE IF NOT EXISTS notifications_outbox (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    sent_at TEXT,
    error TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
