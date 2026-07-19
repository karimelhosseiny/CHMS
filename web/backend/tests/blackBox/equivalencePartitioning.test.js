const request = require('supertest');
const createApp = require('../../src/app');
const { startMemoryServer, stopMemoryServer, clearCollections } = require('../testUtils/setupMemoryServer');
const { tokenFor, seedCourse, seedSection, seedStudent } = require('../testUtils/fixtures');

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

describe('EP - course registration / duplicate enrollment', () => {
  it('valid partition: first-time registration succeeds (201, ENROLLED)', async () => {
    await seedCourse();
    await seedSection();
    await seedStudent();
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS101-A' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ENROLLED');
  });

  it('invalid partition: duplicate registration in the same section is rejected (409)', async () => {
    await seedCourse();
    await seedSection();
    await seedStudent();
    const token = tokenFor({ studentId: 'S1' });
    await request(app).post('/api/enrollments').set('Authorization', `Bearer ${token}`).send({ sectionId: 'CS101-A' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'CS101-A' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DuplicateEnrollmentError');
  });
});

describe('EP - prerequisite validation', () => {
  it('valid partition: prerequisite completed', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'] });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201' });
    await seedStudent({ completedCourses: ['CS101'] });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS201-A' });
    expect(res.status).toBe(201);
  });

  it('invalid partition: prerequisite missing is rejected (422)', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'] });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201' });
    await seedStudent({ completedCourses: [] });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS201-A' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('PrerequisiteNotMetError');
  });
});

describe('EP - maximum credit limits', () => {
  it('valid partition: registering within the standard cap succeeds', async () => {
    await seedCourse({ code: 'CS101', creditHours: 3 });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101' });
    await seedStudent({ standing: 'GOOD_STANDING' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS101-A' });
    expect(res.status).toBe(201);
  });

  it('invalid partition: exceeding the standard cap is rejected (422)', async () => {
    await seedCourse({ code: 'MATH101', creditHours: 4 });
    await seedSection({ sectionId: 'MATH101-A', courseCode: 'MATH101', meetingTimes: [{ day: 'TUE', start: '09:00', end: '10:15' }] });
    await seedStudent({ standing: 'GOOD_STANDING' });

    const Enrollment = require('../../src/models/Enrollment');
    await Enrollment.create({
      studentId: 'S1',
      sectionId: 'FILLER-A',
      courseCode: 'FILLER',
      creditHours: 16,
      status: 'ENROLLED',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'MATH101-A' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('CreditLimitExceededError');
  });

  it('invalid partition: probation students are capped below the standard limit', async () => {
    await seedCourse({ code: 'MATH101', creditHours: 4 });
    await seedSection({ sectionId: 'MATH101-A', courseCode: 'MATH101' });
    await seedStudent({ standing: 'PROBATION' });

    const Enrollment = require('../../src/models/Enrollment');
    await Enrollment.create({
      studentId: 'S1',
      sectionId: 'FILLER-A',
      courseCode: 'FILLER',
      creditHours: 12,
      status: 'ENROLLED',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'MATH101-A' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('CreditLimitExceededError');
  });
});

describe('EP - scheduling consistency', () => {
  it('valid partition: no time conflict succeeds', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'ENG101' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });
    await seedSection({ sectionId: 'ENG101-A', courseCode: 'ENG101', meetingTimes: [{ day: 'TUE', start: '09:00', end: '10:15' }] });
    await seedStudent();
    const token = tokenFor({ studentId: 'S1' });
    await request(app).post('/api/enrollments').set('Authorization', `Bearer ${token}`).send({ sectionId: 'CS101-A' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'ENG101-A' });
    expect(res.status).toBe(201);
  });

  it('invalid partition: an overlapping section is rejected (409)', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'MATH101', creditHours: 4 });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });
    await seedSection({ sectionId: 'MATH101-A', courseCode: 'MATH101', meetingTimes: [{ day: 'MON', start: '09:30', end: '10:45' }] });
    await seedStudent();
    const token = tokenFor({ studentId: 'S1' });
    await request(app).post('/api/enrollments').set('Authorization', `Bearer ${token}`).send({ sectionId: 'CS101-A' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: 'MATH101-A' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ScheduleConflictError');
  });

  it('catalog-wide: flags two sections sharing a room at overlapping times', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'CS201' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', room: 'R100', instructor: 'Dr. Lee', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', room: 'R100', instructor: 'Dr. Kim', meetingTimes: [{ day: 'MON', start: '09:30', end: '10:45' }] });

    const res = await request(app)
      .get('/api/admin/schedule-consistency')
      .set('Authorization', `Bearer ${tokenFor({ role: 'admin' })}`);
    expect(res.status).toBe(200);
    expect(res.body.consistent).toBe(false);
    expect(res.body.issues.some((i) => i.kind === 'room')).toBe(true);
  });

  it('catalog-wide: reports consistent when no sections overlap', async () => {
    await seedCourse({ code: 'CS101' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });

    const res = await request(app)
      .get('/api/admin/schedule-consistency')
      .set('Authorization', `Bearer ${tokenFor({ role: 'admin' })}`);
    expect(res.status).toBe(200);
    expect(res.body.consistent).toBe(true);
    expect(res.body.issues).toHaveLength(0);
  });
});

describe('EP - correctness of enrollment operations (capacity, waitlist, drop, promotion)', () => {
  it('valid partition: registering fills an open seat', async () => {
    await seedCourse({ code: 'CS101' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS101-A' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ENROLLED');
  });

  it('invalid/edge partition: a full section waitlists instead of enrolling', async () => {
    await seedCourse({ code: 'CS101' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', capacity: 1, roster: ['S0'] });
    await seedStudent({ studentId: 'S1' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS101-A' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('WAITLISTED');
  });

  it('invalid partition: a full section with waitlisting declined is rejected (409)', async () => {
    await seedCourse({ code: 'CS101' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', capacity: 1, roster: ['S0'] });
    await seedStudent({ studentId: 'S1' });
    const res = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`)
      .send({ sectionId: 'CS101-A', allowWaitlist: false });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SectionFullError');
  });

  it('dropping an active seat promotes the next waitlisted student', async () => {
    await seedCourse({ code: 'CS101' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });

    const tokenS1 = tokenFor({ studentId: 'S1' });
    const tokenS2 = tokenFor({ studentId: 'S2' });
    await request(app).post('/api/enrollments').set('Authorization', `Bearer ${tokenS1}`).send({ sectionId: 'CS101-A' });
    const waitlistRes = await request(app)
      .post('/api/enrollments')
      .set('Authorization', `Bearer ${tokenS2}`)
      .send({ sectionId: 'CS101-A' });
    expect(waitlistRes.body.status).toBe('WAITLISTED');

    const dropRes = await request(app).delete('/api/enrollments/CS101-A').set('Authorization', `Bearer ${tokenS1}`);
    expect(dropRes.status).toBe(204);

    const meRes = await request(app).get('/api/students/me').set('Authorization', `Bearer ${tokenS2}`);
    const promoted = meRes.body.enrollments.find((e) => e.sectionId === 'CS101-A');
    expect(promoted.status).toBe('ENROLLED');
  });

  it('invalid partition: dropping a section the student is not enrolled in is rejected (404)', async () => {
    await seedCourse({ code: 'CS101' });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101' });
    await seedStudent({ studentId: 'S1' });
    const res = await request(app)
      .delete('/api/enrollments/CS101-A')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotEnrolledError');
  });
});

describe('EP - minimum credit-hour finalization', () => {
  it('valid partition: at or above the full-time minimum passes', async () => {
    await seedStudent({ studentId: 'S1' });
    const Enrollment = require('../../src/models/Enrollment');
    await Enrollment.create({
      studentId: 'S1',
      sectionId: 'FILLER-A',
      courseCode: 'FILLER',
      creditHours: 12,
      status: 'ENROLLED',
      timestamp: new Date().toISOString(),
    });
    const res = await request(app)
      .post('/api/students/me/finalize')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('invalid partition: below the full-time minimum is rejected (422)', async () => {
    await seedStudent({ studentId: 'S1' });
    const Enrollment = require('../../src/models/Enrollment');
    await Enrollment.create({
      studentId: 'S1',
      sectionId: 'FILLER-A',
      courseCode: 'FILLER',
      creditHours: 9,
      status: 'ENROLLED',
      timestamp: new Date().toISOString(),
    });
    const res = await request(app)
      .post('/api/students/me/finalize')
      .set('Authorization', `Bearer ${tokenFor({ studentId: 'S1' })}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('BelowMinimumCreditsError');
  });
});
