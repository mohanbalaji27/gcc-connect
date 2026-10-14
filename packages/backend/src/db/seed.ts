import { initDatabase, execute, query } from './index.js';

export async function seedDatabase(): Promise<void> {
  await initDatabase();

  // Check if already seeded
  const existingEmployees = await query('SELECT count(*) as count FROM employees');
  if (parseInt(existingEmployees[0]?.count || '0', 10) > 0) {
    return;
  }

  const now = new Date().toISOString();

  // 1. Buildings
  await execute(
    `INSERT INTO buildings (id, code, name, city, time_zone)
     VALUES ($1, $2, $3, $4, $5)`,
    ['bld_blr_01', 'BTP-T4', 'Bengaluru GCC Hub (Tower 4)', 'Bengaluru', 'Asia/Kolkata']
  );

  // 2. Floors
  await execute(
    `INSERT INTO floors (id, building_id, floor_number, name, map_svg_url)
     VALUES
     ($1, $2, $3, $4, $5),
     ($6, $7, $8, $9, $10)`,
    [
      'flr_blr_03', 'bld_blr_01', 3, 'Floor 3 — Engineering & AI Labs', '/maps/floor3.svg',
      'flr_blr_04', 'bld_blr_01', 4, 'Floor 4 — Executive, Finance & Operations', '/maps/floor4.svg',
    ]
  );

  // 3. Zones
  await execute(
    `INSERT INTO zones (id, floor_id, name, color_hex, designated_team)
     VALUES
     ($1, $2, $3, $4, $5),
     ($6, $7, $8, $9, $10),
     ($11, $12, $13, $14, $15),
     ($16, $17, $18, $19, $20),
     ($21, $22, $23, $24, $25)`,
    [
      'zone_eng_alpha', 'flr_blr_03', 'Alpha Zone (Cloud & Core)', '#1A56DB', 'Engineering',
      'zone_ai_beta', 'flr_blr_03', 'Beta Zone (AI & Data)', '#0D9488', 'Data Science',
      'zone_collab_gamma', 'flr_blr_03', 'Gamma Collaboration Arena', '#7E22CE', 'Product',
      'zone_exec_delta', 'flr_blr_04', 'Delta Executive Suite', '#0B1A3D', 'Leadership',
      'zone_ops_finance', 'flr_blr_04', 'Finance & Operations Hub', '#D97706', 'Operations',
    ]
  );

  // 4. Employees (Seed Personas)
  const employees = [
    {
      id: 'emp_1000',
      code: 'EMP-1000',
      email: 'rohan.deshmukh@company.com',
      name: 'Rohan Deshmukh',
      dept: 'Enterprise IT & Security',
      team: 'Cybersecurity',
      role: 'SUPER_ADMIN',
    },
    {
      id: 'emp_1001',
      code: 'EMP-1001',
      email: 'aarav.sharma@company.com',
      name: 'Aarav Sharma',
      dept: 'Engineering',
      team: 'Core Platform',
      role: 'EMPLOYEE',
    },
    {
      id: 'emp_1002',
      code: 'EMP-1002',
      email: 'priya.nair@company.com',
      name: 'Priya Nair',
      dept: 'Product',
      team: 'Workplace Tech',
      role: 'TEAM_COORDINATOR',
    },
    {
      id: 'emp_1003',
      code: 'EMP-1003',
      email: 'vikram.patel@company.com',
      name: 'Vikram Patel',
      dept: 'Workplace Services',
      team: 'Facilities Management',
      role: 'FACILITIES_ADMIN',
    },
    {
      id: 'emp_1004',
      code: 'EMP-1004',
      email: 'neha.gupta@company.com',
      name: 'Neha Gupta',
      dept: 'Corporate Communications',
      team: 'Employee Engagement',
      role: 'EVENTS_ADMIN',
    },
    {
      id: 'emp_1005',
      code: 'EMP-1005',
      email: 'meera.sen@company.com',
      name: 'Meera Sen',
      dept: 'Workplace Operations',
      team: 'Reception & Concierge',
      role: 'RECEPTION_ADMIN',
    },
  ];

  for (const emp of employees) {
    await execute(
      `INSERT INTO employees (id, employee_code, email, name, department, team, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)`,
      [emp.id, emp.code, emp.email, emp.name, emp.dept, emp.team, emp.role, now]
    );
  }

  // 5. Desks on Floor 3 (Grid of 24 desks)
  for (let i = 1; i <= 24; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    const code = `D3-${num}`;
    const deskId = `desk_f3_${num}`;
    const opaqueQr = `res_dk_b3_${num}`;
    const zoneId = i <= 8 ? 'zone_eng_alpha' : i <= 16 ? 'zone_ai_beta' : 'zone_collab_gamma';
    
    // Grid positions (8 columns x 3 rows)
    const col = (i - 1) % 8;
    const row = Math.floor((i - 1) / 8);
    const posX = 70 + col * 90;
    const posY = 100 + row * 110;

    const isAccessible = i === 1 || i === 9 || i === 17 ? 1 : 0;
    const hasStandingDesk = i % 2 === 1 ? 1 : 0;
    const hasDualMonitors = i % 3 === 0 ? 1 : 0;
    const hasUsbCDock = 1;

    await execute(
      `INSERT INTO desks (id, code, name, category, floor_id, zone_id, pos_x, pos_y, is_accessible, has_standing_desk, has_dual_monitors, has_usb_c_dock, status, qr_opaque_id)
       VALUES ($1, $2, $3, 'DESK', 'flr_blr_03', $4, $5, $6, $7, $8, $9, $10, 'AVAILABLE', $11)`,
      [deskId, code, `Desk ${code}`, zoneId, posX, posY, isAccessible, hasStandingDesk, hasDualMonitors, hasUsbCDock, opaqueQr]
    );

    // Physical QR Record
    await execute(
      `INSERT INTO resource_qrs (id, resource_id, resource_category, opaque_code, encoded_payload, created_at, is_active)
       VALUES ($1, $2, 'DESK', $3, $4, $5, 1)`,
      [`qr_${deskId}`, deskId, opaqueQr, `gcc://book/${opaqueQr}`, now]
    );
  }

  // 6. Desks on Floor 4 (Grid of 16 desks)
  for (let i = 1; i <= 16; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    const code = `D4-${num}`;
    const deskId = `desk_f4_${num}`;
    const opaqueQr = `res_dk_b4_${num}`;
    const zoneId = i <= 8 ? 'zone_exec_delta' : 'zone_ops_finance';

    const col = (i - 1) % 8;
    const row = Math.floor((i - 1) / 8);
    const posX = 70 + col * 90;
    const posY = 120 + row * 120;

    await execute(
      `INSERT INTO desks (id, code, name, category, floor_id, zone_id, pos_x, pos_y, is_accessible, has_standing_desk, has_dual_monitors, has_usb_c_dock, status, qr_opaque_id)
       VALUES ($1, $2, $3, 'DESK', 'flr_blr_04', $4, $5, $6, $7, $8, 1, 1, 'AVAILABLE', $9)`,
      [deskId, code, `Desk ${code}`, zoneId, posX, posY, i === 1 ? 1 : 0, 1, opaqueQr]
    );

    await execute(
      `INSERT INTO resource_qrs (id, resource_id, resource_category, opaque_code, encoded_payload, created_at, is_active)
       VALUES ($1, $2, 'DESK', $3, $4, $5, 1)`,
      [`qr_${deskId}`, deskId, opaqueQr, `gcc://book/${opaqueQr}`, now]
    );
  }

  // 7. Meeting Rooms
  const rooms = [
    {
      id: 'room_horizon',
      code: 'RM-HORIZON',
      name: 'Boardroom Horizon',
      floorId: 'flr_blr_04',
      capacity: 18,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_horizon',
    },
    {
      id: 'room_orion',
      code: 'RM-ORION',
      name: 'Orion Video Conference Suite',
      floorId: 'flr_blr_03',
      capacity: 10,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_orion',
    },
    {
      id: 'room_apollo',
      code: 'RM-APOLLO',
      name: 'Apollo Privacy & Phone Pod',
      floorId: 'flr_blr_03',
      capacity: 2,
      vc: 1,
      wb: 0,
      booth: 1,
      qr: 'res_rm_apollo',
    },
    {
      id: 'room_gemini',
      code: 'RM-GEMINI',
      name: 'Gemini Design & Brainstorm Lab',
      floorId: 'flr_blr_03',
      capacity: 8,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_gemini',
    },
    {
      id: 'room_nebula',
      code: 'RM-NEBULA',
      name: 'Nebula Agile Scrum Room',
      floorId: 'flr_blr_03',
      capacity: 6,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_nebula',
    },
    {
      id: 'room_zenith',
      code: 'RM-ZENITH',
      name: 'Zenith Executive Briefing Center',
      floorId: 'flr_blr_04',
      capacity: 12,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_zenith',
    },
  ];

  for (const rm of rooms) {
    await execute(
      `INSERT INTO rooms (id, code, name, category, floor_id, capacity, is_accessible, has_video_conference, has_digital_whiteboard, has_phone_booth, status, qr_opaque_id)
       VALUES ($1, $2, $3, 'MEETING_ROOM', $4, $5, 1, $6, $7, $8, 'AVAILABLE', $9)`,
      [rm.id, rm.code, rm.name, rm.floorId, rm.capacity, rm.vc, rm.wb, rm.booth, rm.qr]
    );

    await execute(
      `INSERT INTO resource_qrs (id, resource_id, resource_category, opaque_code, encoded_payload, created_at, is_active)
       VALUES ($1, $2, 'MEETING_ROOM', $3, $4, $5, 1)`,
      [`qr_${rm.id}`, rm.id, rm.qr, `gcc://book/${rm.qr}`, now]
    );
  }

  // 8. Office Events
  const today = new Date().toISOString().split('T')[0];
  await execute(
    `INSERT INTO office_events (id, title, description, category, date, start_time, end_time, location_name, max_attendees, registered_count, organizer_name, is_waitlist_enabled)
     VALUES
     ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1),
     ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 1),
     ($23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, 1)`,
    [
      'evt_01', 'Q4 GCC All-Hands & Strategic Vision', 'Global Capability Centre updates, executive address and team awards.', 'ALL_HANDS', today, '15:00', '16:30', 'Floor 4 Townhall Area', 150, 42, 'Neha Gupta',
      'evt_02', 'Cloud Infrastructure & GenAI Workshop', 'Hands-on architectural patterns for enterprise GenAI agents on hybrid cloud.', 'TECH_TALK', today, '17:00', '18:30', 'Orion Video Conference Suite', 30, 18, 'Aarav Sharma',
      'evt_03', 'Workplace Ergonomics & Health Screening', 'Interactive session with ergonomics specialists and posture assessments.', 'WELLNESS', today, '11:00', '12:30', 'Collab Arena Floor 3', 25, 9, 'Vikram Patel',
    ]
  );

  // 9. Announcements
  await execute(
    `INSERT INTO announcements (id, title, content, severity, author_name, created_at, target_department)
     VALUES
     ($1, $2, $3, 'INFO', $4, $5, NULL),
     ($6, $7, $8, 'WARNING', $9, $10, NULL)`,
    [
      'ann_01', 'Welcome to Bengaluru GCC Tower 4 Hub', 'Floor 3 & 4 are fully operational with smart desk check-in, collaborative hubs, and video conferencing pods.', 'Facilities Team', now,
      'ann_02', 'Scheduled Network & Wi-Fi Optimization', 'Tower 4 Wi-Fi will undergo seamless AP channel tuning on Saturday 02:00-04:00 AM IST.', 'Enterprise IT', now,
    ]
  );

  // 10. Booking Policies
  await execute(
    `INSERT INTO booking_policies (id, max_desk_days_in_advance, max_active_desk_bookings_per_employee, max_room_hours_per_booking, check_in_window_minutes_before, auto_release_grace_period_minutes, require_check_in, updated_at)
     VALUES ('policy_default', 14, 3, 4, 30, 15, 1, $1)`,
    [now]
  );

  // 11. Application Settings
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES
     ('notifications_enabled', 'true', $1),
     ('auto_release_enabled', 'true', $2),
     ('dev_mode_allowed', 'true', $3)`,
    [now, now, now]
  );
}

// Standalone execution if run directly via tsx
if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase()
    .then(() => {
      console.log('Database seeded successfully with enterprise GCC data.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
