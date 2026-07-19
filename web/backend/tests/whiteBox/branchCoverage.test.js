const { startMemoryServer, stopMemoryServer, clearCollections } = require('../testUtils/setupMemoryServer');
const { seedCourse, seedSection, seedStudent } = require('../testUtils/fixtures');
const registrationService = require('../../src/services/registrationService');
const catalogService = require('../../src/services/catalogService');
const Student = require('../../src/models/Student');
const Section = require('../../src/models/Section');
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

describe('register(): branch `section full?`', () => {
  it('TRUE branch: capacity reached routes into the waitlist/full-error arm', async () => {
    await seedCourse();
    await seedSection({ capacity: 1, roster: ['S0'] });
    await seedStudent();
    const enrollment = await registrationService.register('S1', 'CS101-A');
    expect(enrollment.status).toBe('WAITLISTED');
  });

  it('FALSE branch: an open seat routes into the enroll arm', async () => {
    await seedCourse();
    await seedSection({ capacity: 1, roster: [] });
    await seedStudent();
    const enrollment = await registrationService.register('S1', 'CS101-A');
    expect(enrollment.status).toBe('ENROLLED');
  });
});

describe('register(): branch `allowWaitlist` (only reached when full)', () => {
  it('TRUE branch: waitlisting proceeds', async () => {
    await seedCourse();
    await seedSection({ capacity: 1, roster: ['S0'] });
    await seedStudent();
    const enrollment = await registrationService.register('S1', 'CS101-A', true);
    expect(enrollment.status).toBe('WAITLISTED');
  });

  it('FALSE branch: SectionFullError is thrown instead', async () => {
    await seedCourse();
    await seedSection({ capacity: 1, roster: ['S0'] });
    await seedStudent();
    await expect(registrationService.register('S1', 'CS101-A', false)).rejects.toThrow('is full and waitlisting was declined');
  });
});

describe('drop(): branch `enrollment missing or already dropped`', () => {
  it('TRUE branch: dropping an unknown enrollment throws NotEnrolledError', async () => {
    await seedStudent();
    await expect(registrationService.drop('S1', 'CS101-A')).rejects.toThrow('is not enrolled in section');
  });

  it('FALSE branch: an active enrollment can be dropped', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent();
    await registrationService.register('S1', 'CS101-A');
    await expect(registrationService.drop('S1', 'CS101-A')).resolves.toBeUndefined();
  });
});

describe('drop(): branch `wasActiveSeat`', () => {
  it('TRUE branch: dropping an ENROLLED seat removes from roster and attempts promotion', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent();
    await registrationService.register('S1', 'CS101-A');
    await registrationService.drop('S1', 'CS101-A');
    const section = await Section.findOne({ sectionId: 'CS101-A' });
    expect(section.roster).not.toContain('S1');
  });

  it('FALSE branch: dropping a WAITLISTED spot removes from waitlist, no promotion attempted', async () => {
    await seedCourse();
    await seedSection({ capacity: 1, roster: ['S0'] });
    await seedStudent();
    await registrationService.register('S1', 'CS101-A');
    await registrationService.drop('S1', 'CS101-A');
    const section = await Section.findOne({ sectionId: 'CS101-A' });
    expect(section.waitlist).not.toContain('S1');
    expect(section.roster).toEqual(['S0']);
  });
});

describe('promoteFromWaitlist(): branch `candidate document missing`', () => {
  it('TRUE branch: a waitlisted id with no matching Student is skipped', async () => {
    await seedCourse();
    await seedSection({ capacity: 1, roster: ['S0'], waitlist: ['GHOST'] });
    await seedStudent({ studentId: 'S0' });
    await Enrollment.create({
      studentId: 'S0',
      sectionId: 'CS101-A',
      courseCode: 'CS101',
      creditHours: 3,
      status: 'ENROLLED',
      timestamp: new Date().toISOString(),
    });
    await registrationService.drop('S0', 'CS101-A');
    const section = await Section.findOne({ sectionId: 'CS101-A' });
    expect(section.waitlist).toEqual([]);
    expect(section.roster).toEqual([]);
  });

  it('FALSE branch: a waitlisted id with a matching Student is evaluated for promotion', async () => {
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
});

describe('promoteFromWaitlist(): branch `candidate ineligible (RegistrationError)`', () => {
  it('TRUE branch: an over-limit candidate is skipped and the next candidate is promoted', async () => {
    await seedCourse({ code: 'CS101', creditHours: 3 });
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await seedStudent({ studentId: 'S3', name: 'Cara' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');
    await registrationService.register('S3', 'CS101-A');
    await primeCredits('S2', 16);

    await registrationService.drop('S1', 'CS101-A');

    const s2Enrollment = await Enrollment.findOne({ studentId: 'S2', sectionId: 'CS101-A' });
    const s3Enrollment = await Enrollment.findOne({ studentId: 'S3', sectionId: 'CS101-A' });
    expect(s2Enrollment).toBeNull();
    expect(s3Enrollment.status).toBe('ENROLLED');
  });

  it('FALSE branch: an eligible candidate is promoted directly', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');
    await registrationService.drop('S1', 'CS101-A');
    const s2Enrollment = await Enrollment.findOne({ studentId: 'S2', sectionId: 'CS101-A' });
    expect(s2Enrollment.status).toBe('ENROLLED');
  });
});

describe('checkMinimumCredits via validateFinalRegistration: branch `below minimum`', () => {
  it('TRUE branch: below 12 active credits throws', async () => {
    await seedStudent();
    await expect(registrationService.validateFinalRegistration('S1')).rejects.toThrow('below the minimum');
  });

  it('FALSE branch: at/above 12 active credits resolves', async () => {
    await seedStudent();
    await primeCredits('S1', 12);
    await expect(registrationService.validateFinalRegistration('S1')).resolves.toBeUndefined();
  });
});

describe('getStudent(): branch `student not found`', () => {
  it('TRUE branch: an unknown student id throws NotFoundError', async () => {
    await expect(registrationService.validateFinalRegistration('GHOST')).rejects.toThrow('Unknown student id: GHOST');
  });

  it('FALSE branch: a known student id resolves to a document', async () => {
    await seedStudent();
    await expect(registrationService.getStudent('S1')).resolves.toMatchObject({ studentId: 'S1' });
  });
});

describe('promoteFromWaitlist(): branch `err instanceof RegistrationError`', () => {
  it('TRUE branch (non-RegistrationError): an unexpected error propagates instead of being swallowed as a skip', async () => {
    await seedCourse();
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');

    const boom = new Error('unexpected infrastructure failure');
    const spy = jest.spyOn(catalogService, 'sectionsEnrolledBy').mockRejectedValueOnce(boom);
    await expect(registrationService.drop('S1', 'CS101-A')).rejects.toThrow('unexpected infrastructure failure');
    spy.mockRestore();
  });

  it('FALSE branch (RegistrationError): a rule violation is caught and treated as a skip', async () => {
    await seedCourse({ code: 'CS101', creditHours: 3 });
    await seedSection({ capacity: 1 });
    await seedStudent({ studentId: 'S1' });
    await seedStudent({ studentId: 'S2', name: 'Bob' });
    await registrationService.register('S1', 'CS101-A');
    await registrationService.register('S2', 'CS101-A');
    await primeCredits('S2', 20);

    await expect(registrationService.drop('S1', 'CS101-A')).resolves.toBeUndefined();
    const s2 = await Enrollment.findOne({ studentId: 'S2', sectionId: 'CS101-A' });
    expect(s2).toBeNull();
  });
});
