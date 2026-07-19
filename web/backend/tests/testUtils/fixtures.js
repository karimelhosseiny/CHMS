const jwt = require('jsonwebtoken');
const Course = require('../../src/models/Course');
const Section = require('../../src/models/Section');
const Student = require('../../src/models/Student');

function tokenFor({ studentId = null, role = 'student', email = 'user@example.com' } = {}) {
  return jwt.sign({ sub: 'test-user', email, role, studentId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedCourse(overrides = {}) {
  return Course.create({
    code: 'CS101',
    title: 'Intro to Programming',
    creditHours: 3,
    prerequisites: [],
    ...overrides,
  });
}

async function seedSection(overrides = {}) {
  return Section.create({
    sectionId: 'CS101-A',
    courseCode: 'CS101',
    term: 'Fall2026',
    capacity: 2,
    meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }],
    instructor: 'Dr. Lee',
    room: 'R100',
    roster: [],
    waitlist: [],
    ...overrides,
  });
}

async function seedStudent(overrides = {}) {
  return Student.create({
    studentId: 'S1',
    name: 'Alice',
    standing: 'GOOD_STANDING',
    overloadApproved: false,
    completedCourses: [],
    ...overrides,
  });
}

module.exports = { tokenFor, seedCourse, seedSection, seedStudent };
