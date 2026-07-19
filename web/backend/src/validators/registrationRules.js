const {
  MAX_CREDITS_OVERLOAD_CAP,
  MAX_CREDITS_PROBATION,
  MAX_CREDITS_STANDARD,
  MIN_CREDITS_FULL_TIME,
} = require('../constants/creditPolicy');
const {
  BelowMinimumCreditsError,
  CreditLimitExceededError,
  DuplicateEnrollmentError,
  PrerequisiteNotMetError,
  ScheduleConflictError,
} = require('../errors');
const { sectionsConflict } = require('./schedule');

function checkDuplicateEnrollment(student, section) {
  if (student.existingStatus === 'ENROLLED' || student.existingStatus === 'WAITLISTED') {
    throw new DuplicateEnrollmentError(
      `Student ${student.studentId} already has a seat in section ${section.sectionId}`
    );
  }
  if (student.isEnrolledInCourse) {
    throw new DuplicateEnrollmentError(
      `Student ${student.studentId} is already enrolled in course ${section.courseCode}`
    );
  }
}

function checkPrerequisites(student, course) {
  const missing = course.prerequisites.filter((p) => !student.completedCourses.has(p));
  if (missing.length > 0) {
    throw new PrerequisiteNotMetError(
      `Missing prerequisite(s) for ${course.code}: ${[...missing].sort().join(', ')}`
    );
  }
}

function maxAllowedCredits(student) {
  if (student.standing === 'PROBATION') return MAX_CREDITS_PROBATION;
  if (student.overloadApproved) return MAX_CREDITS_OVERLOAD_CAP;
  return MAX_CREDITS_STANDARD;
}

function checkCreditLimit(student, additionalCredits) {
  const maxAllowed = maxAllowedCredits(student);
  const projected = student.activeCreditHours + additionalCredits;
  if (projected > maxAllowed) {
    throw new CreditLimitExceededError(
      `Registering for ${additionalCredits} credit(s) would bring student ` +
        `${student.studentId} to ${projected}, exceeding the maximum of ${maxAllowed}`
    );
  }
}

function checkScheduleConflict(newSection, enrolledSections) {
  for (const section of enrolledSections) {
    if (sectionsConflict(newSection, section)) {
      throw new ScheduleConflictError(
        `Section ${newSection.sectionId} conflicts with enrolled section ${section.sectionId}`
      );
    }
  }
}

function checkMinimumCredits(student) {
  if (student.activeCreditHours < MIN_CREDITS_FULL_TIME) {
    throw new BelowMinimumCreditsError(
      `Student ${student.studentId} has only ${student.activeCreditHours} active credit(s), ` +
        `below the minimum of ${MIN_CREDITS_FULL_TIME}`
    );
  }
}

module.exports = {
  checkDuplicateEnrollment,
  checkPrerequisites,
  maxAllowedCredits,
  checkCreditLimit,
  checkScheduleConflict,
  checkMinimumCredits,
};
