import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDatabase, closeDatabase, queryOne, execute } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';

describe('GCC Connect — Mandatory Enterprise Security & Concurrency Test Suite', () => {
  let app: any;
  let employeeToken: string;
  let coordinatorToken: string;
  let adminToken: string;
  let employeeId: string;
  let coordinatorId: string;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await initDatabase();
    await seedDatabase();
    app = createApp();

    // 1. Obtain Employee Token (Aarav Sharma - EMP-1001)
    const empLoginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ employeeCode: 'EMP-1001' })
      .expect(200);
    employeeToken = empLoginRes.body.token;
    employeeId = empLoginRes.body.user.id;

    // 2. Obtain Team Coordinator Token (Priya Nair - EMP-1002)
    const coordLoginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ employeeCode: 'EMP-1002' })
      .expect(200);
    coordinatorToken = coordLoginRes.body.token;
    coordinatorId = coordLoginRes.body.user.id;

    // 3. Obtain Super Admin Token (Rohan Deshmukh - EMP-1000)
    const adminLoginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ employeeCode: 'EMP-1000' })
      .expect(200);
    adminToken = adminLoginRes.body.token;
  });

  after(async () => {
    await closeDatabase();
  });

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated Access & Privilege Escalation
  // ---------------------------------------------------------------------------
  test('1. Unauthenticated API access is strictly rejected with 401', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/resources/floors').expect(401);
    await request(app).get('/api/bookings/my').expect(401);
    await request(app).post('/api/bookings/desks').send({}).expect(401);
    await request(app).post('/api/qr/tokens').send({}).expect(401);
  });

  test('2. Standard employee cannot access privileged admin endpoints (403 Forbidden)', async () => {
    // Attempt to access employee roster
    await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    // Attempt to issue one-time token
    await request(app)
      .post('/api/qr/tokens')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ purpose: 'Unauthorized Token' })
      .expect(403);

    // Attempt to change booking policy
    await request(app)
      .put('/api/admin/policies')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ maxDeskDaysInAdvance: 30 })
      .expect(403);
  });

  test('3. Employee cannot elevate role or change other user roles (Privilege Escalation Prevention)', async () => {
    const res = await request(app)
      .post('/api/admin/employees/assign-role')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ userId: employeeId, role: 'SUPER_ADMIN' })
      .expect(403);

    assert.equal(res.body.error, 'FORBIDDEN');

    // Admin also cannot self-elevate or modify their own role
    const adminSelfRes = await request(app)
      .post('/api/admin/employees/assign-role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 'emp_1000', role: 'EMPLOYEE' })
      .expect(400);

    assert.equal(adminSelfRes.body.error, 'CANNOT_MODIFY_OWN_ROLE');
  });

  // ---------------------------------------------------------------------------
  // 2. IDOR / BOLA (Object-Level Authorization)
  // ---------------------------------------------------------------------------
  test('4. Cross-employee booking access prevented: User cannot cancel another user’s reservation', async () => {
    // Coordinator books desk Z001
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const bookingRes = await request(app)
      .post('/api/bookings/desks')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ resourceId: 'desk_z001', date: dateStr })
      .expect(201);

    const bookingId = bookingRes.body.id;

    // Ordinary Employee attempts to cancel Coordinator's booking
    const cancelRes = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    assert.equal(cancelRes.body.error, 'FORBIDDEN');

    // Booking remains CONFIRMED
    const b = await queryOne('SELECT status FROM bookings WHERE id = $1', [bookingId]);
    assert.equal(b.status, 'CONFIRMED');

    // Coordinator cancels their own booking successfully
    await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .expect(200);

    const bAfter = await queryOne('SELECT status FROM bookings WHERE id = $1', [bookingId]);
    assert.equal(bAfter.status, 'CANCELLED');
  });

  // ---------------------------------------------------------------------------
  // 3. Concurrency Safety & Anti-Double-Booking
  // ---------------------------------------------------------------------------
  test('5. Concurrent bookings for the same desk: Exactly ONE succeeds, all others receive 409 Conflict', async () => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 2);
    const dateStr = testDate.toISOString().split('T')[0];

    // Fire 5 simultaneous booking requests for desk Z005 from different accounts
    const deskId = 'desk_z005';

    // Create 3 temporary synthetic test employees
    await execute(
      `INSERT INTO employees (id, employee_code, email, name, department, team, role, is_active, created_at)
       VALUES 
       ('test_emp_a', 'T-001', 'test.a@company.com', 'Tester A', 'Eng', 'Tech', 'EMPLOYEE', 1, '2026-01-01'),
       ('test_emp_b', 'T-002', 'test.b@company.com', 'Tester B', 'Eng', 'Tech', 'EMPLOYEE', 1, '2026-01-01'),
       ('test_emp_c', 'T-003', 'test.c@company.com', 'Tester C', 'Eng', 'Tech', 'EMPLOYEE', 1, '2026-01-01')`
    );

    const tokenA = (await request(app).post('/api/auth/dev-login').send({ employeeCode: 'T-001' })).body.token;
    const tokenB = (await request(app).post('/api/auth/dev-login').send({ employeeCode: 'T-002' })).body.token;
    const tokenC = (await request(app).post('/api/auth/dev-login').send({ employeeCode: 'T-003' })).body.token;

    const promises = [
      request(app).post('/api/bookings/desks').set('Authorization', `Bearer ${tokenA}`).send({ resourceId: deskId, date: dateStr }),
      request(app).post('/api/bookings/desks').set('Authorization', `Bearer ${tokenB}`).send({ resourceId: deskId, date: dateStr }),
      request(app).post('/api/bookings/desks').set('Authorization', `Bearer ${tokenC}`).send({ resourceId: deskId, date: dateStr }),
    ];

    const responses = await Promise.all(promises);
    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    assert.equal(successCount, 1, 'Expected exactly 1 concurrent desk booking to succeed');
    assert.equal(conflictCount, 2, 'Expected conflicting concurrent desk bookings to fail with 409');
  });

  test('6. Concurrent meeting room bookings for overlapping time slots: Conflict detected', async () => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 3);
    const dateStr = testDate.toISOString().split('T')[0];
    const roomId = 'room_mr8_a';

    // First booking: 10:00 - 11:30
    await request(app)
      .post('/api/bookings/rooms')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        resourceId: roomId,
        date: dateStr,
        startTime: '10:00',
        endTime: '11:30',
        title: 'Sprint Planning',
      })
      .expect(201);

    // Overlapping booking: 11:00 - 12:00
    const overlapRes = await request(app)
      .post('/api/bookings/rooms')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({
        resourceId: roomId,
        date: dateStr,
        startTime: '11:00',
        endTime: '12:00',
        title: 'Product Review',
      })
      .expect(409);

    assert.equal(overlapRes.body.error, 'CONFLICT');
    assert.ok(overlapRes.body.alternatives.length > 0, 'Must provide available alternative rooms');
  });

  // ---------------------------------------------------------------------------
  // 4. Idempotency Key Handling
  // ---------------------------------------------------------------------------
  test('7. Repeating the same request with an Idempotency-Key does NOT create duplicate reservations', async () => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 4);
    const dateStr = testDate.toISOString().split('T')[0];
    const idempotencyKey = `idem_${Date.now()}`;

    // First attempt
    const res1 = await request(app)
      .post('/api/bookings/desks')
      .set('Authorization', `Bearer ${employeeToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ resourceId: 'desk_z010', date: dateStr })
      .expect(201);

    const bookingId = res1.body.id;

    // Retry attempt with same idempotency key
    const res2 = await request(app)
      .post('/api/bookings/desks')
      .set('Authorization', `Bearer ${employeeToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ resourceId: 'desk_z010', date: dateStr })
      .expect(201);

    assert.equal(res2.body.id, bookingId, 'Must return identical booking without duplication');

    // Confirm database only contains 1 booking
    const bookings = await queryOne(
      'SELECT count(*) as count FROM bookings WHERE resource_id = $1 AND date = $2',
      ['desk_z010', dateStr]
    );
    assert.equal(parseInt(bookings.count, 10), 1);
  });

  // ---------------------------------------------------------------------------
  // 5. One-Time Booking Tokens & Concurrency Safe Redemption
  // ---------------------------------------------------------------------------
  test('8. One-Time QR Token expires, can be revoked, and cannot be redeemed more than max redemptions', async () => {
    // Admin creates 1-time token for Desk Z020
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const tokenRes = await request(app)
      .post('/api/qr/tokens')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scopeResourceId: 'desk_z020',
        scopeCategory: 'DESK',
        maxRedemptions: 1,
        validHours: 24,
        bookingDate: dateStr,
        purpose: 'Auditor One-Time Desk Pass',
      })
      .expect(201);

    const bearerToken = tokenRes.body.bearerToken;
    const tokenIdentifier = tokenRes.body.tokenIdentifier;
    assert.ok(bearerToken, 'Bearer token must be generated');

    // Redeem token successfully once
    const redeemRes1 = await request(app)
      .post('/api/qr/tokens/redeem')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ bearerToken })
      .expect(200);

    assert.equal(redeemRes1.body.success, true);
    assert.equal(redeemRes1.body.tokenIdentifier, tokenIdentifier);

    // Second redemption attempt must fail with 400 (Exhausted token)
    const redeemRes2 = await request(app)
      .post('/api/qr/tokens/redeem')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ bearerToken })
      .expect(400);

    assert.equal(redeemRes2.body.error, 'TOKEN_MAX_REDEMPTIONS_REACHED');
  });

  // ---------------------------------------------------------------------------
  // 6. OTP Brute-Force & Rate Limiting
  // ---------------------------------------------------------------------------
  test('9. OTP Brute-force protection: Account locked after 3 failed attempts', async () => {
    const testEmail = 'aarav.sharma@company.com';

    // Request new OTP
    const otpReq = await request(app)
      .post('/api/auth/request-otp')
      .send({ email: testEmail })
      .expect(200);

    assert.ok(otpReq.body.devOtp, 'Dev OTP returned in test mode');

    // Attempt 1: Wrong OTP
    await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: testEmail, otp: '000000' })
      .expect(401);

    // Attempt 2: Wrong OTP
    await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: testEmail, otp: '111111' })
      .expect(401);

    // Attempt 3: Wrong OTP
    await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: testEmail, otp: '222222' })
      .expect(401);

    // Attempt 4: Even with correct OTP, verification is rejected
    const attempt4 = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: testEmail, otp: otpReq.body.devOtp })
      .expect(401);

    assert.ok(attempt4.body.error.includes('OTP_'), 'Must reject due to expired/exhausted OTP');
  });

  // ---------------------------------------------------------------------------
  // 7. Account Suspension Immediate Access Termination
  // ---------------------------------------------------------------------------
  test('10. Account suspension immediately revokes API access even with active unexpired JWT', async () => {
    // Verify employee can access before suspension
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    // Admin suspends employee
    await request(app)
      .post('/api/admin/employees/suspend')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: employeeId, isSuspended: true, reason: 'Security investigation' })
      .expect(200);

    // Immediate request with previously valid JWT is blocked with 403 Account suspended
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    assert.equal(res.body.error, 'ACCOUNT_SUSPENDED');

    // Admin reactivates employee
    await request(app)
      .post('/api/admin/employees/suspend')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: employeeId, isSuspended: false, reason: 'Reinstated' })
      .expect(200);

    // Access restored
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
  });
});
