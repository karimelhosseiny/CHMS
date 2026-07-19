const { startMemoryServer, stopMemoryServer, clearCollections } = require('../testUtils/setupMemoryServer');
const { seedCourse, seedSection, seedStudent } = require('../testUtils/fixtures');
const catalogService = require('../../src/services/catalogService');
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

describe('catalogService statement coverage', () => {
  it('addCourse / getCourse round-trip', async () => {
    await catalogService.addCourse({ code: 'CS101', title: 'Intro', creditHours: 3 });
    const course = await catalogService.getCourse('CS101');
    expect(course.code).toBe('CS101');
  });

  it('getCourse throws for an unknown code', async () => {
    await expect(catalogService.getCourse('NOPE')).rejects.toThrow('Unknown course code: NOPE');
  });

  it('addSection succeeds when the course exists', async () => {
    await seedCourse();
    const section = await catalogService.addSection({
      sectionId: 'CS101-A',
      courseCode: 'CS101',
      term: 'Fall2026',
      capacity: 2,
      meetingTimes: [],
      instructor: 'Dr. Lee',
      room: 'R100',
    });
    expect(section.sectionId).toBe('CS101-A');
  });

  it('addSection throws when the course does not exist', async () => {
    await expect(
      catalogService.addSection({
        sectionId: 'X-A',
        courseCode: 'NOPE',
        term: 'Fall2026',
        capacity: 1,
        meetingTimes: [],
        instructor: 'Dr. Lee',
        room: 'R100',
      })
    ).rejects.toThrow('Course NOPE not registered in catalog');
  });

  it('getSection throws for an unknown section id', async () => {
    await expect(catalogService.getSection('NOPE')).rejects.toThrow('Unknown section id: NOPE');
  });

  it('sectionsEnrolledBy resolves ids to documents', async () => {
    await seedCourse();
    await seedSection();
    const sections = await catalogService.sectionsEnrolledBy(['CS101-A']);
    expect(sections).toHaveLength(1);
  });

  it('validateScheduleConsistency executes every statement across room+instructor conflicts and clean pairs', async () => {
    await seedCourse({ code: 'CS101' });
    await seedCourse({ code: 'CS201' });
    await seedCourse({ code: 'CS301' });
    await seedSection({ sectionId: 'A', courseCode: 'CS101', room: 'R1', instructor: 'X', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:00' }] });
    await seedSection({ sectionId: 'B', courseCode: 'CS201', room: 'R1', instructor: 'X', meetingTimes: [{ day: 'MON', start: '09:30', end: '10:30' }] });
    await seedSection({ sectionId: 'C', courseCode: 'CS301', room: 'R2', instructor: 'Y', meetingTimes: [{ day: 'TUE', start: '09:00', end: '10:00' }] });

    const issues = await catalogService.validateScheduleConsistency();
    expect(issues.some((i) => i.kind === 'room')).toBe(true);
    expect(issues.some((i) => i.kind === 'instructor')).toBe(true);
  });
});

describe('registrationService statement coverage', () => {
  it('register: happy path enrolls, drop: releases the seat with no one to promote', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent();
    const enrollment = await registrationService.register('S1', 'CS101-A');
    expect(enrollment.status).toBe('ENROLLED');

    await registrationService.drop('S1', 'CS101-A');
    const after = await Enrollment.findOne({ studentId: 'S1', sectionId: 'CS101-A' });
    expect(after.status).toBe('DROPPED');
  });

  it('register: waitlist path executes, drop from waitlist executes the "else" branch', async () => {
    await seedCourse();
    await seedSection({ capacity: 1, roster: ['S0'] });
    await seedStudent();
    const enrollment = await registrationService.register('S1', 'CS101-A');
    expect(enrollment.status).toBe('WAITLISTED');

    await registrationService.drop('S1', 'CS101-A');
    const after = await Enrollment.findOne({ studentId: 'S1', sectionId: 'CS101-A' });
    expect(after.status).toBe('DROPPED');
  });

  it('drop: promotes the next eligible waitlisted student', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');

    await registrationService.drop('S1', 'CS101-A');
    const promoted = await Enrollment.findOne({ studentId: 'S2', sectionId: 'CS101-A' });
    expect(promoted.status).toBe('ENROLLED');
  });

  it('validateFinalRegistration executes both the passing and failing statements', async () => {
    await seedStudent({ studentId: 'S1' });
    await expect(registrationService.validateFinalRegistration('S1')).rejects.toThrow();

    await Enrollment.create({
      studentId: 'S1',
      sectionId: 'FILLER-A',
      courseCode: 'FILLER',
      creditHours: 12,
      status: 'ENROLLED',
      timestamp: new Date().toISOString(),
    });
    await expect(registrationService.validateFinalRegistration('S1')).resolves.toBeUndefined();
  });
});
