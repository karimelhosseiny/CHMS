const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const { NotFoundError, NotEnrolledError, RegistrationError, SectionFullError } = require('../errors');
const {
  checkCreditLimit,
  checkDuplicateEnrollment,
  checkMinimumCredits,
  checkPrerequisites,
  checkScheduleConflict,
} = require('../validators/registrationRules');
const catalogService = require('./catalogService');

async function getStudent(studentId) {
  const student = await Student.findOne({ studentId });
  if (!student) throw new NotFoundError(`Unknown student id: ${studentId}`);
  return student;
}

async function buildStudentView(studentDoc, sectionId = null) {
  const enrollments = await Enrollment.find({ studentId: studentDoc.studentId });
  const active = enrollments.filter((e) => e.status === 'ENROLLED');
  return {
    studentId: studentDoc.studentId,
    standing: studentDoc.standing,
    overloadApproved: studentDoc.overloadApproved,
    completedCourses: new Set(studentDoc.completedCourses),
    activeCreditHours: active.reduce((sum, e) => sum + e.creditHours, 0),
    activeCourseCodes: new Set(active.map((e) => e.courseCode)),
    activeSectionIds: active.map((e) => e.sectionId),
    existingStatus: sectionId
      ? (enrollments.find((e) => e.sectionId === sectionId) || {}).status || null
      : null,
    isEnrolledInCourse: false,
  };
}

function nowIso() {
  return new Date().toISOString();
}

async function register(studentId, sectionId, allowWaitlist = true) {
  const studentDoc = await getStudent(studentId);
  const section = await catalogService.getSection(sectionId);
  const course = await catalogService.getCourse(section.courseCode);

  const studentView = await buildStudentView(studentDoc, sectionId);
  studentView.isEnrolledInCourse = studentView.activeCourseCodes.has(course.code);

  checkDuplicateEnrollment(studentView, { sectionId, courseCode: course.code });

  let status;
  if (section.roster.length >= section.capacity) {
    if (!allowWaitlist) {
      throw new SectionFullError(`Section ${sectionId} is full and waitlisting was declined`);
    }
    checkPrerequisites(studentView, course);
    section.waitlist.push(studentId);
    status = 'WAITLISTED';
  } else {
    checkPrerequisites(studentView, course);
    checkCreditLimit(studentView, course.creditHours);
    const enrolledSections = await catalogService.sectionsEnrolledBy(studentView.activeSectionIds);
    checkScheduleConflict(section, enrolledSections);
    section.roster.push(studentId);
    status = 'ENROLLED';
  }

  await section.save();

  const enrollment = await Enrollment.findOneAndUpdate(
    { studentId, sectionId },
    {
      studentId,
      sectionId,
      courseCode: course.code,
      creditHours: course.creditHours,
      status,
      timestamp: nowIso(),
    },
    { upsert: true, new: true }
  );

  return enrollment;
}

async function drop(studentId, sectionId) {
  await getStudent(studentId);
  const enrollment = await Enrollment.findOne({ studentId, sectionId });
  if (!enrollment || enrollment.status === 'DROPPED') {
    throw new NotEnrolledError(`Student ${studentId} is not enrolled in section ${sectionId}`);
  }

  const section = await catalogService.getSection(sectionId);
  const wasActiveSeat = enrollment.status === 'ENROLLED';
  enrollment.status = 'DROPPED';
  await enrollment.save();

  if (wasActiveSeat) {
    section.roster = section.roster.filter((id) => id !== studentId);
  } else {
    section.waitlist = section.waitlist.filter((id) => id !== studentId);
  }
  await section.save();

  if (wasActiveSeat) {
    await promoteFromWaitlist(section);
  }
}

async function promoteFromWaitlist(section) {
  const course = await catalogService.getCourse(section.courseCode);

  while (section.waitlist.length > 0 && section.roster.length < section.capacity) {
    const candidateId = section.waitlist[0];
    const candidateDoc = await Student.findOne({ studentId: candidateId });
    if (!candidateDoc) {
      section.waitlist.shift();
      await section.save();
      continue;
    }

    const candidateView = await buildStudentView(candidateDoc);
    try {
      checkCreditLimit(candidateView, course.creditHours);
      const enrolledSections = await catalogService.sectionsEnrolledBy(candidateView.activeSectionIds);
      checkScheduleConflict(section, enrolledSections);
    } catch (err) {
      if (!(err instanceof RegistrationError)) throw err;
      section.waitlist.shift();
      await section.save();
      await Enrollment.deleteOne({ studentId: candidateId, sectionId: section.sectionId });
      continue;
    }

    section.waitlist.shift();
    section.roster.push(candidateId);
    await section.save();
    await Enrollment.findOneAndUpdate(
      { studentId: candidateId, sectionId: section.sectionId },
      {
        studentId: candidateId,
        sectionId: section.sectionId,
        courseCode: course.code,
        creditHours: course.creditHours,
        status: 'ENROLLED',
        timestamp: nowIso(),
      },
      { upsert: true, new: true }
    );
    break;
  }
}

async function validateFinalRegistration(studentId) {
  const studentDoc = await getStudent(studentId);
  const studentView = await buildStudentView(studentDoc);
  checkMinimumCredits(studentView);
}

module.exports = {
  getStudent,
  register,
  drop,
  validateFinalRegistration,
  buildStudentView,
};
