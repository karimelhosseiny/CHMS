const mongoose = require('mongoose');
const { startMemoryServer, stopMemoryServer, clearCollections } = require('../testUtils/setupMemoryServer');
const Course = require('../../src/models/Course');
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

describe('Course model', () => {
  it('rejects non-positive credit hours', async () => {
    const course = new Course({ code: 'CS999', title: 'Broken', creditHours: 0 });
    await expect(course.validate()).rejects.toThrow();
  });

  it('requires a unique course code', async () => {
    await Course.create({ code: 'CS101', title: 'Intro', creditHours: 3 });
    await expect(Course.create({ code: 'CS101', title: 'Duplicate', creditHours: 3 })).rejects.toThrow();
  });
});

describe('Section model', () => {
  it('rejects non-positive capacity', async () => {
    const section = new Section({
      sectionId: 'X-A',
      courseCode: 'CS101',
      term: 'Fall2026',
      capacity: 0,
      meetingTimes: [],
      instructor: 'Dr. Lee',
      room: 'R100',
    });
    await expect(section.validate()).rejects.toThrow();
  });

  it('rejects a time slot where start is not before end', async () => {
    const section = new Section({
      sectionId: 'X-A',
      courseCode: 'CS101',
      term: 'Fall2026',
      capacity: 2,
      meetingTimes: [{ day: 'MON', start: '10:00', end: '09:00' }],
      instructor: 'Dr. Lee',
      room: 'R100',
    });
    await expect(section.validate()).rejects.toThrow();
  });

  it('rejects a malformed time string', async () => {
    const section = new Section({
      sectionId: 'X-A',
      courseCode: 'CS101',
      term: 'Fall2026',
      capacity: 2,
      meetingTimes: [{ day: 'MON', start: '9:00', end: '10:00' }],
      instructor: 'Dr. Lee',
      room: 'R100',
    });
    await expect(section.validate()).rejects.toThrow();
  });
});

describe('Enrollment model', () => {
  it('enforces one enrollment document per (studentId, sectionId) pair', async () => {
    await Enrollment.create({
      studentId: 'S1',
      sectionId: 'CS101-A',
      courseCode: 'CS101',
      creditHours: 3,
      status: 'ENROLLED',
      timestamp: new Date().toISOString(),
    });
    await expect(
      Enrollment.create({
        studentId: 'S1',
        sectionId: 'CS101-A',
        courseCode: 'CS101',
        creditHours: 3,
        status: 'WAITLISTED',
        timestamp: new Date().toISOString(),
      })
    ).rejects.toThrow();
  });
});

describe('mongoose connection (sanity)', () => {
  it('is connected to the in-memory server', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });
});
