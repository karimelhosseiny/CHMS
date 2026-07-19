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

function register(studentId, sectionId, allowWaitlist) {
  const body = allowWaitlist === undefined ? { sectionId } : { sectionId, allowWaitlist };
  return request(app)
    .post('/api/enrollments')
    .set('Authorization', `Bearer ${tokenFor({ studentId })}`)
    .send(body);
}

describe('Decision table: register()', () => {
  it('Row 1 - Full=N, Prereq=Y, Credit=Y, Schedule=Y => ENROLLED', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2 });
    await seedStudent({ completedCourses: ['CS101'] });
    const res = await register('S1', 'CS201-A');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ENROLLED');
  });

  it('Row 2 - Full=N, Prereq=N => PrerequisiteNotMetError (short-circuits credit/schedule)', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2 });
    await seedStudent({ completedCourses: [] });
    const res = await register('S1', 'CS201-A');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('PrerequisiteNotMetError');
  });

  it('Row 3 - Full=N, Prereq=Y, Credit=N => CreditLimitExceededError (short-circuits schedule)', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2 });
    await seedStudent({ completedCourses: ['CS101'] });
    await primeActiveCredits('S1', 16);
    const res = await register('S1', 'CS201-A');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('CreditLimitExceededError');
  });

  it('Row 4 - Full=N, Prereq=Y, Credit=Y, Schedule=N => ScheduleConflictError', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2, meetingTimes: [{ day: 'MON', start: '09:30', end: '10:45' }] });
    await seedStudent({ completedCourses: ['CS101'] });
    await register('S1', 'CS101-A');
    const res = await register('S1', 'CS201-A');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ScheduleConflictError');
  });

  it('Row 5 - Full=Y, Waitlist=Y, Prereq=Y => WAITLISTED (credit/schedule not consulted)', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 1, roster: ['S0'] });
    await seedStudent({ completedCourses: ['CS101'] });
    await primeActiveCredits('S1', 20);
    const res = await register('S1', 'CS201-A', true);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('WAITLISTED');
  });

  it('Row 6 - Full=Y, Waitlist=Y, Prereq=N => PrerequisiteNotMetError (prereqs still enforced while waitlisting)', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 1, roster: ['S0'] });
    await seedStudent({ completedCourses: [] });
    const res = await register('S1', 'CS201-A', true);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('PrerequisiteNotMetError');
  });

  it('Row 7 - Full=Y, Waitlist=N => SectionFullError (prereqs not even consulted)', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 1, roster: ['S0'] });
    await seedStudent({ completedCourses: [] });
    const res = await register('S1', 'CS201-A', false);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SectionFullError');
  });
});
