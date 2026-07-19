const Course = require('../models/Course');
const Section = require('../models/Section');
const { CourseNotFoundError } = require('../errors');
const { sectionsConflict } = require('../validators/schedule');

async function addCourse({ code, title, creditHours, prerequisites = [] }) {
  return Course.create({ code, title, creditHours, prerequisites });
}

async function getCourse(code) {
  const course = await Course.findOne({ code });
  if (!course) throw new CourseNotFoundError(`Unknown course code: ${code}`);
  return course;
}

async function addSection({ sectionId, courseCode, term, capacity, meetingTimes, instructor, room }) {
  const course = await Course.findOne({ code: courseCode });
  if (!course) throw new CourseNotFoundError(`Course ${courseCode} not registered in catalog`);
  return Section.create({ sectionId, courseCode, term, capacity, meetingTimes, instructor, room });
}

async function getSection(sectionId) {
  const section = await Section.findOne({ sectionId });
  if (!section) throw new CourseNotFoundError(`Unknown section id: ${sectionId}`);
  return section;
}

async function sectionsEnrolledBy(activeSectionIds) {
  return Section.find({ sectionId: { $in: activeSectionIds } });
}

async function validateScheduleConsistency() {
  const sections = await Section.find({});
  const issues = [];
  for (let i = 0; i < sections.length; i += 1) {
    for (let j = i + 1; j < sections.length; j += 1) {
      const sectionA = sections[i];
      const sectionB = sections[j];
      if (!sectionsConflict(sectionA, sectionB)) continue;
      if (sectionA.room === sectionB.room) {
        issues.push({
          kind: 'room',
          resource: sectionA.room,
          sectionA: sectionA.sectionId,
          sectionB: sectionB.sectionId,
        });
      }
      if (sectionA.instructor === sectionB.instructor) {
        issues.push({
          kind: 'instructor',
          resource: sectionA.instructor,
          sectionA: sectionA.sectionId,
          sectionB: sectionB.sectionId,
        });
      }
    }
  }
  return issues;
}

module.exports = {
  addCourse,
  getCourse,
  addSection,
  getSection,
  sectionsEnrolledBy,
  validateScheduleConsistency,
};
