require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, redactCredentials } = require('../config/db');
const Course = require('../models/Course');
const Section = require('../models/Section');
const Student = require('../models/Student');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chms';

const COURSES = [
  { code: 'CS101', title: 'Intro to Programming', creditHours: 3, prerequisites: [] },
  { code: 'CS201', title: 'Data Structures', creditHours: 3, prerequisites: ['CS101'] },
  { code: 'CS301', title: 'Algorithms', creditHours: 3, prerequisites: ['CS201'] },
  { code: 'MATH101', title: 'Calculus I', creditHours: 4, prerequisites: [] },
  { code: 'ENG101', title: 'English Composition', creditHours: 3, prerequisites: [] },
];

const SECTIONS = [
  {
    sectionId: 'CS101-A',
    courseCode: 'CS101',
    term: 'Fall2026',
    capacity: 2,
    meetingTimes: [
      { day: 'MON', start: '09:00', end: '10:15' },
      { day: 'WED', start: '09:00', end: '10:15' },
    ],
    instructor: 'Dr. Lee',
    room: 'R100',
  },
  {
    sectionId: 'CS201-A',
    courseCode: 'CS201',
    term: 'Fall2026',
    capacity: 2,
    meetingTimes: [
      { day: 'MON', start: '10:30', end: '11:45' },
      { day: 'WED', start: '10:30', end: '11:45' },
    ],
    instructor: 'Dr. Kim',
    room: 'R101',
  },
  {
    sectionId: 'CS301-A',
    courseCode: 'CS301',
    term: 'Fall2026',
    capacity: 1,
    meetingTimes: [
      { day: 'TUE', start: '09:00', end: '10:15' },
      { day: 'THU', start: '09:00', end: '10:15' },
    ],
    instructor: 'Dr. Lee',
    room: 'R100',
  },
  {
    sectionId: 'MATH101-A',
    courseCode: 'MATH101',
    term: 'Fall2026',
    capacity: 2,
    meetingTimes: [
      { day: 'MON', start: '09:00', end: '10:15' },
      { day: 'WED', start: '09:00', end: '10:15' },
    ],
    instructor: 'Dr. Patel',
    room: 'R200',
  },
  {
    sectionId: 'ENG101-A',
    courseCode: 'ENG101',
    term: 'Fall2026',
    capacity: 2,
    meetingTimes: [
      { day: 'TUE', start: '09:00', end: '10:15' },
      { day: 'THU', start: '09:00', end: '10:15' },
    ],
    instructor: 'Dr. Otto',
    room: 'R201',
  },
];

const STUDENTS = [
  { studentId: 'S1', name: 'Alice', standing: 'GOOD_STANDING', completedCourses: [] },
  { studentId: 'S2', name: 'Bob', standing: 'GOOD_STANDING', completedCourses: ['CS101'] },
  { studentId: 'S3', name: 'Cara', standing: 'PROBATION', completedCourses: [] },
];

const DEMO_PASSWORD = 'password123';

async function seed() {
  await connectDB(MONGODB_URI);
  console.log(`Connected to MongoDB at ${redactCredentials(MONGODB_URI)}`);

  await Promise.all([Course.deleteMany({}), Section.deleteMany({}), Student.deleteMany({}), User.deleteMany({})]);

  await Course.insertMany(COURSES);
  await Section.insertMany(SECTIONS);
  await Student.insertMany(STUDENTS);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = STUDENTS.map((s) => ({
    email: `${s.studentId.toLowerCase()}@example.com`,
    passwordHash,
    role: 'student',
    studentId: s.studentId,
  }));
  users.push({ email: 'admin@example.com', passwordHash, role: 'admin', studentId: null });
  await User.insertMany(users);

  console.log('Seeded 5 courses, 5 sections, 3 students, 1 admin.');
  console.log(`Demo login password for every account: "${DEMO_PASSWORD}"`);
  console.log('Student logins: s1@example.com, s2@example.com, s3@example.com');
  console.log('Admin login: admin@example.com');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
