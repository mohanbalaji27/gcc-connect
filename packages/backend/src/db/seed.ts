import { initDatabase, execute, query } from './index.js';

interface DeskClusterConfig {
  start: number;
  end: number;
  dept: string;
  zoneId: string;
  costCentres: string;
  baseX: number;
  baseY: number;
  cols: number;
  colSpacing: number;
  rowSpacing: number;
}

export async function seedDatabase(): Promise<void> {
  await initDatabase();

  // Clear existing data for fresh idempotent seeding
  await execute('DELETE FROM bookings');
  await execute('DELETE FROM resource_qrs');
  await execute('DELETE FROM desks');
  await execute('DELETE FROM rooms');
  await execute('DELETE FROM zones');
  await execute('DELETE FROM floors');
  await execute('DELETE FROM buildings');
  await execute('DELETE FROM event_registrations');
  await execute('DELETE FROM office_events');
  await execute('DELETE FROM announcements');
  await execute('DELETE FROM booking_policies');
  await execute('DELETE FROM app_settings');
  await execute('DELETE FROM employees');

  const now = new Date().toISOString();

  // 1. Building - Zimmer Biomet Bangalore GCC Hub
  await execute(
    `INSERT INTO buildings (id, code, name, city, time_zone)
     VALUES ($1, $2, $3, $4, $5)`,
    ['bld_zb_blr', 'ANSR-ZB-01', 'Zimmer Biomet GCC Hub (Bangalore)', 'Bangalore', 'Asia/Kolkata']
  );

  // 2. Floor - Main Operations Floor
  await execute(
    `INSERT INTO floors (id, building_id, floor_number, name, map_svg_url)
     VALUES ($1, $2, $3, $4, $5)`,
    ['flr_zb_01', 'bld_zb_blr', 1, 'Level 1 — Main Operations Floor (184 Seats)', '/maps/zb-layout-plan.svg']
  );

  // 3. Zones based on Seating Assignment Table
  const zones = [
    { id: 'zone_mfg_eng', name: 'Manufacturing Engineering', color: '#0284C7', team: 'WARSAW Ops' },
    { id: 'zone_eng_services', name: 'Engineering Services (CAD & R&D)', color: '#2563EB', team: 'Biocomp & Systems' },
    { id: 'zone_sustaining_eng', name: 'Sustaining Engineering & Knee NPI', color: '#4F46E5', team: 'Sustaining Eng' },
    { id: 'zone_robotics', name: 'Robotics Engineering (DTS)', color: '#7C3AED', team: 'Robotics DTS' },
    { id: 'zone_quality_ra', name: 'Quality & Regulatory Affairs', color: '#9333EA', team: 'Quality & Regulatory' },
    { id: 'zone_it', name: 'Information Technology & CISO', color: '#0D9488', team: 'IT & Infrastructure' },
    { id: 'zone_facilities', name: 'Facilities & Transport', color: '#059669', team: 'Workplace Ops' },
    { id: 'zone_procurement', name: 'Procurement & Purchasing', color: '#D97706', team: 'Procurement' },
    { id: 'zone_clinical', name: 'Clinical Affairs', color: '#E11D48', team: 'Clinical Affairs' },
    { id: 'zone_hr', name: 'Human Resources & Talent Acquisition', color: '#DB2777', team: 'HR & People' },
    { id: 'zone_finance', name: 'Finance & Controllership', color: '#475569', team: 'Controllership' },
  ];

  for (const z of zones) {
    await execute(
      `INSERT INTO zones (id, floor_id, name, color_hex, designated_team)
       VALUES ($1, 'flr_zb_01', $2, $3, $4)`,
      [z.id, z.name, z.color, z.team]
    );
  }

  // 4. Employees / Key Personas
  const employees = [
    {
      id: 'emp_1000',
      code: 'EMP-1000',
      email: 'rohan.deshmukh@company.com',
      name: 'Rohan Deshmukh',
      dept: 'Information Technology',
      team: 'CISO & Corp Compliance',
      role: 'SUPER_ADMIN',
    },
    {
      id: 'emp_1001',
      code: 'EMP-1001',
      email: 'aarav.sharma@company.com',
      name: 'Aarav Sharma',
      dept: 'Engineering Services team',
      team: 'CAD and Systems',
      role: 'EMPLOYEE',
    },
    {
      id: 'emp_1002',
      code: 'EMP-1002',
      email: 'priya.nair@company.com',
      name: 'Priya Nair',
      dept: 'Robotics Engineering',
      team: 'Robotics DTS',
      role: 'TEAM_COORDINATOR',
    },
    {
      id: 'emp_1003',
      code: 'EMP-1003',
      email: 'vikram.patel@company.com',
      name: 'Vikram Patel',
      dept: 'Facilities, Transport',
      team: 'Facilities Management',
      role: 'FACILITIES_ADMIN',
    },
    {
      id: 'emp_1004',
      code: 'EMP-1004',
      email: 'neha.gupta@company.com',
      name: 'Neha Gupta',
      dept: 'Human Resources',
      team: 'Talent Acquisition',
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
    {
      id: 'emp_1006',
      code: 'EMP-1006',
      email: 'kavita.rao@company.com',
      name: 'Kavita Rao',
      dept: 'Quality & Regulatory Affairs',
      team: 'Quality Affairs APO',
      role: 'EMPLOYEE',
    },
    {
      id: 'emp_1007',
      code: 'EMP-1007',
      email: 'rajesh.verma@company.com',
      name: 'Rajesh Verma',
      dept: 'Procurement',
      team: 'G & A Purchasing',
      role: 'EMPLOYEE',
    },
  ];

  for (const emp of employees) {
    await execute(
      `INSERT INTO employees (id, employee_code, email, name, department, team, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)`,
      [emp.id, emp.code, emp.email, emp.name, emp.dept, emp.team, emp.role, now]
    );
  }

  // 5. Desk Clusters matching the architectural drawing and Seating Assignment Table
  const clusters: DeskClusterConfig[] = [
    // Z001 - Z005: Manufacturing Engineering (Bottom-Left Bay)
    {
      start: 1,
      end: 5,
      dept: 'Manufacturing Engineering',
      zoneId: 'zone_mfg_eng',
      costCentres: 'GCC - Production – Ind Var – WARSAW Ops',
      baseX: 80,
      baseY: 680,
      cols: 3,
      colSpacing: 50,
      rowSpacing: 45,
    },
    // Z006 - Z040: Engineering Services team (Mid-Left Bays)
    {
      start: 6,
      end: 40,
      dept: 'Engineering Services team',
      zoneId: 'zone_eng_services',
      costCentres: 'GCC - R&D - CAD, Packaging & Biocomp',
      baseX: 80,
      baseY: 340,
      cols: 6,
      colSpacing: 48,
      rowSpacing: 45,
    },
    // Z041 - Z074: Sustaining Engineering (Top-Center & Angled Wing)
    {
      start: 41,
      end: 74,
      dept: 'Sustaining Engineering',
      zoneId: 'zone_sustaining_eng',
      costCentres: 'GCC - Sustaining Engineering & Knee NPI',
      baseX: 420,
      baseY: 60,
      cols: 6,
      colSpacing: 48,
      rowSpacing: 45,
    },
    // Z075 - Z086: Robotics Engineering (Top-Right Wing)
    {
      start: 75,
      end: 86,
      dept: 'Robotics Engineering',
      zoneId: 'zone_robotics',
      costCentres: 'GCC - Robotics Engineering (DTS)',
      baseX: 720,
      baseY: 100,
      cols: 4,
      colSpacing: 50,
      rowSpacing: 45,
    },
    // Z087 - Z119: Quality & Regulatory Affairs (Upper-Mid Wing)
    {
      start: 87,
      end: 119,
      dept: 'Quality & Regulatory Affairs',
      zoneId: 'zone_quality_ra',
      costCentres: 'GCC - R&D - Quality & Regulatory Affairs',
      baseX: 450,
      baseY: 260,
      cols: 6,
      colSpacing: 48,
      rowSpacing: 45,
    },
    // Z120 - Z149: Information Technology (Central / IT Bay near IT Build Room)
    {
      start: 120,
      end: 149,
      dept: 'Information Technology',
      zoneId: 'zone_it',
      costCentres: 'GCC - G&A IT - APAC, D&A, CISO & Global Infra',
      baseX: 440,
      baseY: 460,
      cols: 6,
      colSpacing: 48,
      rowSpacing: 45,
    },
    // Z150 - Z152: Facilities, Transport
    {
      start: 150,
      end: 152,
      dept: 'Facilities, Transport',
      zoneId: 'zone_facilities',
      costCentres: 'Facilities & Workplace Ops',
      baseX: 440,
      baseY: 640,
      cols: 3,
      colSpacing: 50,
      rowSpacing: 45,
    },
    // Z153 - Z168: Procurement (Lower Center Pods)
    {
      start: 153,
      end: 168,
      dept: 'Procurement',
      zoneId: 'zone_procurement',
      costCentres: 'GCC - G&A Purchasing & Direct Variable',
      baseX: 620,
      baseY: 520,
      cols: 4,
      colSpacing: 48,
      rowSpacing: 45,
    },
    // Z169 - Z178: Clinical Affairs (Lower Right Pods)
    {
      start: 169,
      end: 178,
      dept: 'Clinical Affairs',
      zoneId: 'zone_clinical',
      costCentres: 'GCC - R&D - Clinical Affairs Internal',
      baseX: 620,
      baseY: 680,
      cols: 4,
      colSpacing: 48,
      rowSpacing: 45,
    },
    // Z179 - Z182: Human Resources (Lower Pods)
    {
      start: 179,
      end: 182,
      dept: 'Human Resources',
      zoneId: 'zone_hr',
      costCentres: 'GCC - G&A HR - Talent Acquisition',
      baseX: 300,
      baseY: 760,
      cols: 2,
      colSpacing: 50,
      rowSpacing: 45,
    },
    // Z183 - Z184: Finance (Lower Pods)
    {
      start: 183,
      end: 184,
      dept: 'Finance',
      zoneId: 'zone_finance',
      costCentres: 'GCC - G&A Finance - Controllership - APAC',
      baseX: 300,
      baseY: 830,
      cols: 2,
      colSpacing: 50,
      rowSpacing: 45,
    },
  ];

  for (const cluster of clusters) {
    for (let seatNum = cluster.start; seatNum <= cluster.end; seatNum++) {
      const codeStr = seatNum < 10 ? `Z00${seatNum}` : seatNum < 100 ? `Z0${seatNum}` : `Z${seatNum}`;
      const deskId = `desk_${codeStr.toLowerCase()}`;
      const opaqueQr = `res_dk_${codeStr.toLowerCase()}`;

      const indexInCluster = seatNum - cluster.start;
      const col = indexInCluster % cluster.cols;
      const row = Math.floor(indexInCluster / cluster.cols);
      const posX = cluster.baseX + col * cluster.colSpacing;
      const posY = cluster.baseY + row * cluster.rowSpacing;

      // Amenities mapping
      const isAccessible = seatNum % 15 === 1 ? 1 : 0;
      const hasStandingDesk = seatNum % 2 === 1 ? 1 : 0;
      const hasDualMonitors = seatNum % 3 === 0 ? 1 : 0;
      const hasUsbCDock = 1;

      await execute(
        `INSERT INTO desks (id, code, name, category, floor_id, zone_id, pos_x, pos_y, is_accessible, has_standing_desk, has_dual_monitors, has_usb_c_dock, status, qr_opaque_id)
         VALUES ($1, $2, $3, 'DESK', 'flr_zb_01', $4, $5, $6, $7, $8, $9, $10, 'AVAILABLE', $11)`,
        [
          deskId,
          codeStr,
          `Workstation ${codeStr}`,
          cluster.zoneId,
          posX,
          posY,
          isAccessible,
          hasStandingDesk,
          hasDualMonitors,
          hasUsbCDock,
          opaqueQr,
        ]
      );

      // Physical QR Record for every workstation
      await execute(
        `INSERT INTO resource_qrs (id, resource_id, resource_category, opaque_code, encoded_payload, created_at, is_active)
         VALUES ($1, $2, 'DESK', $3, $4, $5, 1)`,
        [`qr_${deskId}`, deskId, opaqueQr, `gcc://book/${opaqueQr}`, now]
      );
    }
  }

  // 6. Meeting Rooms & Spaces from Architectural Drawing
  const meetingSpaces = [
    {
      id: 'room_mr8_a',
      code: 'MR-01',
      name: 'Meeting Room 1 (8 PAX)',
      capacity: 8,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_mr8_a',
    },
    {
      id: 'room_mr8_b',
      code: 'MR-02',
      name: 'Meeting Room 2 (8 PAX)',
      capacity: 8,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_mr8_b',
    },
    {
      id: 'room_mr6_c',
      code: 'MR-03',
      name: 'Meeting Room 3 (6 PAX)',
      capacity: 6,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_mr6_c',
    },
    {
      id: 'room_cabin_1',
      code: 'CABIN-01',
      name: 'Executive Cabin 1',
      capacity: 4,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_cabin_1',
    },
    {
      id: 'room_cabin_2',
      code: 'CABIN-02',
      name: 'Executive Cabin 2',
      capacity: 4,
      vc: 1,
      wb: 1,
      booth: 0,
      qr: 'res_rm_cabin_2',
    },
    {
      id: 'room_pb_1',
      code: 'PB-01',
      name: 'Phone Booth 1 (P.B 1)',
      capacity: 1,
      vc: 1,
      wb: 0,
      booth: 1,
      qr: 'res_rm_pb_1',
    },
    {
      id: 'room_pb_2',
      code: 'PB-02',
      name: 'Phone Booth 2 (P.B 2)',
      capacity: 1,
      vc: 1,
      wb: 0,
      booth: 1,
      qr: 'res_rm_pb_2',
    },
    {
      id: 'room_pb_3',
      code: 'PB-03',
      name: 'Phone Booth 3 (P.B 3)',
      capacity: 1,
      vc: 1,
      wb: 0,
      booth: 1,
      qr: 'res_rm_pb_3',
    },
    {
      id: 'room_pb_4',
      code: 'PB-04',
      name: 'Phone Booth 4 (P.B 4)',
      capacity: 1,
      vc: 1,
      wb: 0,
      booth: 1,
      qr: 'res_rm_pb_4',
    },
    {
      id: 'room_collab_north',
      code: 'COLLAB-N',
      name: 'Collab Space North',
      capacity: 10,
      vc: 0,
      wb: 1,
      booth: 0,
      qr: 'res_rm_collab_n',
    },
    {
      id: 'room_collab_south',
      code: 'COLLAB-S',
      name: 'Collab Space South',
      capacity: 12,
      vc: 0,
      wb: 1,
      booth: 0,
      qr: 'res_rm_collab_s',
    },
    {
      id: 'room_cafeteria',
      code: 'CAFE-46',
      name: 'Cafeteria & Townhall (46 Seats)',
      capacity: 46,
      vc: 1,
      wb: 0,
      booth: 0,
      qr: 'res_rm_cafe_46',
    },
    {
      id: 'room_wellness',
      code: 'WELLNESS',
      name: "Wellness & Mother's Room",
      capacity: 2,
      vc: 0,
      wb: 0,
      booth: 0,
      qr: 'res_rm_wellness',
    },
  ];

  for (const space of meetingSpaces) {
    await execute(
      `INSERT INTO rooms (id, code, name, category, floor_id, capacity, is_accessible, has_video_conference, has_digital_whiteboard, has_phone_booth, status, qr_opaque_id)
       VALUES ($1, $2, $3, 'MEETING_ROOM', 'flr_zb_01', $4, 1, $5, $6, $7, 'AVAILABLE', $8)`,
      [space.id, space.code, space.name, space.capacity, space.vc, space.wb, space.booth, space.qr]
    );

    await execute(
      `INSERT INTO resource_qrs (id, resource_id, resource_category, opaque_code, encoded_payload, created_at, is_active)
       VALUES ($1, $2, 'MEETING_ROOM', $3, $4, $5, 1)`,
      [`qr_${space.id}`, space.id, space.qr, `gcc://book/${space.qr}`, now]
    );
  }

  // 7. Events
  const today = new Date().toISOString().split('T')[0];
  await execute(
    `INSERT INTO office_events (id, title, description, category, date, start_time, end_time, location_name, max_attendees, registered_count, organizer_name, is_waitlist_enabled)
     VALUES
     ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1),
     ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 1),
     ($23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, 1)`,
    [
      'evt_01', 'Zimmer Biomet GCC Townhall & Strategic Roadmap', 'Quarterly global operations update, innovation awards, and leadership Q&A.', 'ALL_HANDS', today, '14:30', '16:00', 'Cafeteria & Townhall (46 Seats)', 150, 48, 'Neha Gupta',
      'evt_02', 'Robotics & DTS Technical Architecture Showcase', 'Deep dive into robotic surgical workflow systems and precision diagnostics.', 'TECH_TALK', today, '16:30', '18:00', 'Meeting Room 1 (8 PAX)', 25, 14, 'Priya Nair',
      'evt_03', 'Workplace Ergonomics & Posture Alignment Workshop', 'Certified occupational wellness consultant providing personalized desk posture guidance.', 'WELLNESS', today, '11:00', '12:30', 'Collab Space North', 20, 8, 'Vikram Patel',
    ]
  );

  // 8. Announcements
  await execute(
    `INSERT INTO announcements (id, title, content, severity, author_name, created_at, target_department)
     VALUES
     ($1, $2, $3, 'INFO', $4, $5, NULL),
     ($6, $7, $8, 'WARNING', $9, $10, NULL)`,
    [
      'ann_01', 'Welcome to Zimmer Biomet Bangalore GCC Floor Plan', 'All 184 workstations across 11 functional departments and 13 meeting/collab spaces are mapped with QR booking.', 'Workplace Experience', now,
      'ann_02', 'IT Kit-Build Room & Server Room Maintenance', 'MDF and UPS room scheduled battery test on Saturday 02:00 - 04:00 AM IST. Workstation connectivity remains unaffected.', 'IT & Facilities', now,
    ]
  );

  // 9. Policies & Settings
  await execute(
    `INSERT INTO booking_policies (id, max_desk_days_in_advance, max_active_desk_bookings_per_employee, max_room_hours_per_booking, check_in_window_minutes_before, auto_release_grace_period_minutes, require_check_in, updated_at)
     VALUES ('policy_default', 14, 3, 4, 30, 15, 1, $1)`,
    [now]
  );

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
      console.log('Database seeded successfully with 184 Zimmer Biomet GCC workstations & facilities.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
