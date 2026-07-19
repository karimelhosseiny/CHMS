const request = require('supertest');
const createApp = require('../../src/app');
const { startMemoryServer, stopMemoryServer, clearCollections } = require('../testUtils/setupMemoryServer');
const { tokenFor, seedCourse, seedSection, seedStudent } = require('../testUtils/fixtures');
const Enrollment = require('../../src/models/Enrollment');

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

async function primeActiveCredits(studentId, creditHours) {
  await Enrollment.create({
    studentId,
    sectionId: 'FILLER-A',
    courseCode: 'FILLER',
    creditHours,
    status: 'ENROLLED',
    timestamp: new Date().toISOString(),
  });
}

describe('BVA - maximum credit limit boundary (standard cap = 18)', () => {
  it('17 + 1 credit = 18: at the boundary, succeeds', async () => {
    await seedCourse({ code: 'ONE', creditHours: 1 });
    await seedSection({ sectionId: 'ONE-A', courseCode: 'ONE' });
    await seedStudent();
    await primeActiveCredits('S1', 17);
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'ONE-A' });
    expect(res.status).toBe(201);
  });

  it('18 + 1 credit = 19: one over the boundary, rejected', async () => {
    await seedCourse({ code: 'ONE', creditHours: 1 });
    await seedSection({ sectionId: 'ONE-A', courseCode: 'ONE' });
    await seedStudent();
    await primeActiveCredits('S1', 18);
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'ONE-A' });
    expect(res.status).toBe(422);
  });
});

describe('BVA - full-time minimum boundary (12 credits)', () => {
  it('exactly 12 credits: at the boundary, finalize passes', async () => {
    await seedStudent();
    await primeActiveCredits('S1', 12);
    const res = await request(app)
      .post('/api/students/me/finalize')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`);
    expect(res.status).toBe(200);
  });

  it('11 credits: one below the boundary, finalize is rejected', async () => {
    await seedStudent();
    await primeActiveCredits('S1', 11);
    const res = await request(app)
      .post('/api/students/me/finalize')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`);
    expect(res.status).toBe(422);
  });

  it('13 credits: one above the boundary, finalize passes', async () => {
    await seedStudent();
    await primeActiveCredits('S1', 13);
    const res = await request(app)
      .post('/api/students/me/finalize')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`);
    expect(res.status).toBe(200);
  });
});

describe('BVA - section capacity boundary (last seat vs. no seats)', () => {
  it('capacity 1, 0 enrolled (1 seat available): registration enrolls', async () => {
    await seedCourse();
    await seedSection({ sectionId: 'CS101-A', capacity: 1, roster: [] });
    await seedStudent();
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS101-A' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ENROLLED');
  });

  it('capacity 1, 1 enrolled (0 seats available): registration waitlists', async () => {
    await seedCourse();
    await seedSection({ sectionId: 'CS101-A', capacity: 1, roster: ['S0'] });
    await seedStudent();
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS101-A' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('WAITLISTED');
  });
});

describe('BVA - prerequisite set boundary (all vs. all-but-one satisfied)', () => {
  it('all prerequisites satisfied: succeeds', async () => {
    await seedCourse({ code: 'CS301', prerequisites: ['CS101', 'CS201'] });
    await seedSection({ sectionId: 'CS301-A', courseCode: 'CS301' });
    await seedStudent({ completedCourses: ['CS101', 'CS201'] });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS301-A' });
    expect(res.status).toBe(201);
  });

  it('all but one prerequisite satisfied: rejected', async () => {
    await seedCourse({ code: 'CS301', prerequisites: ['CS101', 'CS201'] });
    await seedSection({ sectionId: 'CS301-A', courseCode: 'CS301' });
    await seedStudent({ completedCourses: ['CS101'] });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS301-A' });
    expect(res.status).toBe(422);
  });
});

describe('BVA - schedule overlap boundary (touching vs. overlapping by one minute)', () => {
  it('back-to-back slots that touch at the boundary (10:15 end / 10:15 start) do not conflict', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'MATH101', creditHours: 4 });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });
    await seedSection({ sectionId: 'MATH101-A', courseCode: 'MATH101', meetingTimes: [{ day: 'MON', start: '10:15', end: '11:30' }] });
    await seedStudent();
    const token = tokenFor({ studentId: 'S1' });
    await request(app).post('/api/enrollments').set('Authorization', `Bearer ${token}`).send({ sectionId: 'CS101-A' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'MATH101-A' });
    expect(res.status).toBe(201);
  });

  it('a one-minute overlap (10:14 end vs. 10:14 start... i.e. 10:15 start before 10:15 end) conflicts', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'MATH101', creditHours: 4 });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });
    await seedSection({ sectionId: 'MATH101-A', courseCode: 'MATH101', meetingTimes: [{ day: 'MON', start: '10:14', end: '11:30' }] });
    await seedStudent();
    const token = tokenFor({ studentId: 'S1' });
    await request(app).post('/api/enrollments').set('Authorization', `Bearer ${token}`).send({ sectionId: 'CS101-A' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'MATH101-A' });
    expect(res.status).toBe(409);
  });
});
