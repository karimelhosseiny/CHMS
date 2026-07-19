const request = require('supertest');
const createApp = require('../../src/app');
const { startMemoryServer, stopMemoryServer, clearCollections } = require('../testUtils/setupMemoryServer');
const { tokenFor, seedCourse, seedSection } = require('../testUtils/fixtures');

const app = createApp();

beforeAll(async () => {
  await startMemoryServer();
});

afterAll(async () => {
  await stopMemoryServer();
});

afterEach(async () => {
  await clearCollections();
});

async function signupAndLogin(studentId, name) {
  const email = `${studentId.toLowerCase()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'password123', name, studentId });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return loginRes.body.token;
}

describe('Auth flow', () => {
  it('registers a new student account and logs in with the same credentials', async () => {
    const token = await signupAndLogin('S1', 'Alice');
    expect(typeof token).toBe('string');

    const meRes = await request(app).get('/api/students/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.student.studentId).toBe('S1');
  });

  it('rejects login with the wrong password', async () => {
    await request(app).post('/api/auth/register').send({ email: 's1@example.com', password: 'password123', name: 'Alice', studentId: 'S1' });
    const res = await request(app).post('/api/auth/login').send({ email: 's1@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects a duplicate email registration', async () => {
    await request(app).post('/api/auth/register').send({ email: 's1@example.com', password: 'password123', name: 'Alice', studentId: 'S1' });
    const res = await request(app).post('/api/auth/register').send({ email: 's1@example.com', password: 'password456', name: 'Alice2', studentId: 'S2' });
    expect(res.status).toBe(409);
  });

  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/api/students/me');
    expect(res.status).toBe(401);
  });

  it('rejects a student token on an admin-only route', async () => {
    const token = await signupAndLogin('S1', 'Alice');
    const res = await request(app).get('/api/admin/schedule-consistency').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('End-to-end: register -> section fills -> waitlist -> drop -> promotion -> finalize', () => {
  it('walks the full lifecycle for three students sharing a 2-seat section', async () => {
    await seedCourse({ code: 'CS101', creditHours: 12 });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', capacity: 2 });

    const tokenAlice = await signupAndLogin('S1', 'Alice');
    const tokenBob = await signupAndLogin('S2', 'Bob');
    const tokenCara = await signupAndLogin('S3', 'Cara');

    const aliceReg = await request(app).post('/api/enrollments').set('Authorization', `Bearer ${tokenAlice}`).send({ sectionId: 'CS101-A' });
    expect(aliceReg.body.status).toBe('ENROLLED');

    const bobReg = await request(app).post('/api/enrollments').set('Authorization', `Bearer ${tokenBob}`).send({ sectionId: 'CS101-A' });
    expect(bobReg.body.status).toBe('ENROLLED');

    const caraReg = await request(app).post('/api/enrollments').set('Authorization', `Bearer ${tokenCara}`).send({ sectionId: 'CS101-A' });
    expect(caraReg.body.status).toBe('WAITLISTED');

    const finalizeRes = await request(app).post('/api/students/me/finalize').set('Authorization', `Bearer ${tokenAlice}`);
    expect(finalizeRes.status).toBe(200);

    const dropRes = await request(app).delete('/api/enrollments/CS101-A').set('Authorization', `Bearer ${tokenBob}`);
    expect(dropRes.status).toBe(204);

    const caraMe = await request(app).get('/api/students/me').set('Authorization', `Bearer ${tokenCara}`);
    const caraEnrollment = caraMe.body.enrollments.find((e) => e.sectionId === 'CS101-A');
    expect(caraEnrollment.status).toBe('ENROLLED');

    const bobFinalize = await request(app).post('/api/students/me/finalize').set('Authorization', `Bearer ${tokenBob}`);
    expect(bobFinalize.status).toBe(422);
  });
});

describe('Admin catalog management', () => {
  it('an admin can create a course, a section, and read the schedule-consistency report', async () => {
    const adminToken = tokenFor({ role: 'admin' });

    const courseRes = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'CS101', title: 'Intro to Programming', creditHours: 3 });
    expect(courseRes.status).toBe(201);

    const sectionRes = await request(app)
      .post('/api/admin/sections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionId: 'CS101-A',
        courseCode: 'CS101',
        term: 'Fall2026',
        capacity: 2,
        meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }],
        instructor: 'Dr. Lee',
        room: 'R100',
      });
    expect(sectionRes.status).toBe(201);

    const consistencyRes = await request(app).get('/api/admin/schedule-consistency').set('Authorization', `Bearer ${adminToken}`);
    expect(consistencyRes.status).toBe(200);
    expect(consistencyRes.body.consistent).toBe(true);
  });
});
