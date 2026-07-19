const { startMemoryServer, stopMemoryServer, clearCollections } = require('../testUtils/setupMemoryServer');
const { seedCourse, seedSection, seedStudent } = require('../testUtils/fixtures');
const registrationService = require('../../src/services/registrationService');
const Enrollment = require('../../src/models/Enrollment');

beforeAll(async () => {
  await startMemoryServer();
});

afterAll(async () => {
  await stopMemoryServer();
});

afterEach(async () => {
  await clearCollections();
});

async function primeCredits(studentId, creditHours) {
  await Enrollment.create({
    studentId,
    sectionId: 'FILLER-A',
    courseCode: 'FILLER',
    creditHours,
    status: 'ENROLLED',
    timestamp: new Date().toISOString(),
  });
}

describe('register(): basis paths', () => {
  it('Path 1: not full, all rules pass -> ENROLLED', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2 });
    await seedStudent({ completedCourses: ['CS101'] });
    const enrollment = await registrationService.register('S1', 'CS201-A');
    expect(enrollment.status).toBe('ENROLLED');
  });

  it('Path 2: not full, prerequisites fail', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2 });
    await seedStudent({ completedCourses: [] });
    await expect(registrationService.register('S1', 'CS201-A')).rejects.toThrow('Missing prerequisite');
  });

  it('Path 3: not full, prerequisites pass, credit limit fails', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2 });
    await seedStudent({ completedCourses: ['CS101'] });
    await primeCredits('S1', 16);
    await expect(registrationService.register('S1', 'CS201-A')).rejects.toThrow('exceeding the maximum');
  });

  it('Path 4: not full, prerequisites + credit pass, schedule conflict fails', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS101-A', courseCode: 'CS101', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 2, meetingTimes: [{ day: 'MON', start: '09:30', end: '10:45' }] });
    await seedStudent({ completedCourses: ['CS101'] });
    await registrationService.register('S1', 'CS101-A');
    await expect(registrationService.register('S1', 'CS201-A')).rejects.toThrow('conflicts with enrolled section');
  });

  it('Path 5: full, waitlist allowed, prerequisites pass -> WAITLISTED', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 1, roster: ['S0'] });
    await seedStudent({ completedCourses: ['CS101'] });
    const enrollment = await registrationService.register('S1', 'CS201-A', true);
    expect(enrollment.status).toBe('WAITLISTED');
  });

  it('Path 6: full, waitlist allowed, prerequisites fail', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 1, roster: ['S0'] });
    await seedStudent({ completedCourses: [] });
    await expect(registrationService.register('S1', 'CS201-A', true)).rejects.toThrow('Missing prerequisite');
  });

  it('Path 7: full, waitlist declined -> SectionFullError (short-circuits before prerequisites)', async () => {
    await seedCourse({ code: 'CS201', prerequisites: ['CS101'], creditHours: 3 });
    await seedSection({ sectionId: 'CS201-A', courseCode: 'CS201', capacity: 1, roster: ['S0'] });
    await seedStudent({ completedCourses: [] });
    await expect(registrationService.register('S1', 'CS201-A', false)).rejects.toThrow('waitlisting was declined');
  });

  it('Path 0: duplicate-enrollment exit taken before the full/not-full split is even reached', async () => {
    await seedCourse();
    await seedSection({ capacity: 2 });
    await seedStudent();
    await registrationService.register('S1', 'CS101-A');
    await expect(registrationService.register('S1', 'CS101-A')).rejects.toThrow('already has a seat');
  });
});

describe('promoteFromWaitlist(): basis paths (invoked indirectly via drop())', () => {
  it('0 iterations: empty waitlist, loop body never runs', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent();
    await registrationService.register('S1', 'CS101-A');
    await expect(registrationService.drop('S1', 'CS101-A')).resolves.toBeUndefined();
  });

  it('1 iteration, promote: the sole waitlisted candidate is eligible', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');
    await registrationService.drop('S1', 'CS101-A');
    const s2 = await Enrollment.findOne({ studentId: 'S2', sectionId: 'CS101-A' });
    expect(s2.status).toBe('ENROLLED');
  });

  it('1 iteration, skip then empty: the sole waitlisted candidate is ineligible and no one remains after', async () => {
    await seedCourse({ code: 'CS101', creditHours: 3 });
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');
    await primeCredits('S2', 20);

    await registrationService.drop('S1', 'CS101-A');
    const s2 = await Enrollment.findOne({ studentId: 'S2', sectionId: 'CS101-A' });
    expect(s2).toBeNull();
  });

  it('2+ iterations: two ineligible candidates are skipped before a third is promoted', async () => {
    await seedCourse({ code: 'CS101', creditHours: 3 });
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await seedStudent({ studentId: 'S3', name: 'Cara' });
    await seedStudent({ studentId: 'S4', name: 'Dee' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');
    await registrationService.register('S3', 'CS101-A');
    await registrationService.register('S4', 'CS101-A');
    await primeCredits('S2', 20);
    await primeCredits('S3', 20);

    await registrationService.drop('S1', 'CS101-A');

    const s2 = await Enrollment.findOne({ studentId: 'S2', sectionId: 'CS101-A' });
    const s3 = await Enrollment.findOne({ studentId: 'S3', sectionId: 'CS101-A' });
    const s4 = await Enrollment.findOne({ studentId: 'S4', sectionId: 'CS101-A' });
    expect(s2).toBeNull();
    expect(s3).toBeNull();
    expect(s4.status).toBe('ENROLLED');
  });
});
