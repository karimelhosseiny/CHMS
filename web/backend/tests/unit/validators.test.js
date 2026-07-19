const {
  checkCreditLimit,
  checkDuplicateEnrollment,
  checkMinimumCredits,
  checkPrerequisites,
  checkScheduleConflict,
  maxAllowedCredits,
} = require('../../src/validators/registrationRules');
const {
  BelowMinimumCreditsError,
  CreditLimitExceededError,
  DuplicateEnrollmentError,
  PrerequisiteNotMetError,
  ScheduleConflictError,
} = require('../../src/errors');

describe('checkDuplicateEnrollment', () => {
  it('allows a first-time registration', () => {
    expect(() =>
      checkDuplicateEnrollment(
        { studentId: 'S1', existingStatus: null, isEnrolledInCourse: false },
        { sectionId: 'CS101-A', courseCode: 'CS101' }
      )
    ).not.toThrow();
  });

  it('rejects a duplicate seat in the same section (ENROLLED)', () => {
    expect(() =>
      checkDuplicateEnrollment(
        { studentId: 'S1', existingStatus: 'ENROLLED', isEnrolledInCourse: true },
        { sectionId: 'CS101-A', courseCode: 'CS101' }
      )
    ).toThrow(DuplicateEnrollmentError);
  });

  it('rejects a duplicate seat in the same section (WAITLISTED)', () => {
    expect(() =>
      checkDuplicateEnrollment(
        { studentId: 'S1', existingStatus: 'WAITLISTED', isEnrolledInCourse: false },
        { sectionId: 'CS101-A', courseCode: 'CS101' }
      )
    ).toThrow(DuplicateEnrollmentError);
  });

  it('allows re-registering a section the student previously dropped', () => {
    expect(() =>
      checkDuplicateEnrollment(
        { studentId: 'S1', existingStatus: 'DROPPED', isEnrolledInCourse: false },
        { sectionId: 'CS101-A', courseCode: 'CS101' }
      )
    ).not.toThrow();
  });

  it('rejects enrolling in a different section of a course already active', () => {
    expect(() =>
      checkDuplicateEnrollment(
        { studentId: 'S1', existingStatus: null, isEnrolledInCourse: true },
        { sectionId: 'CS101-B', courseCode: 'CS101' }
      )
    ).toThrow(DuplicateEnrollmentError);
  });
});

describe('checkPrerequisites', () => {
  it('passes when all prerequisites are completed', () => {
    expect(() =>
      checkPrerequisites({ completedCourses: new Set(['CS101']) }, { code: 'CS201', prerequisites: ['CS101'] })
    ).not.toThrow();
  });

  it('passes for a course with no prerequisites', () => {
    expect(() =>
      checkPrerequisites({ completedCourses: new Set() }, { code: 'CS101', prerequisites: [] })
    ).not.toThrow();
  });

  it('rejects when a prerequisite is missing', () => {
    expect(() =>
      checkPrerequisites({ completedCourses: new Set() }, { code: 'CS201', prerequisites: ['CS101'] })
    ).toThrow(PrerequisiteNotMetError);
  });

  it('rejects when only some prerequisites are met', () => {
    expect(() =>
      checkPrerequisites(
        { completedCourses: new Set(['CS101']) },
        { code: 'CS301', prerequisites: ['CS101', 'CS201'] }
      )
    ).toThrow(PrerequisiteNotMetError);
  });
});

describe('maxAllowedCredits', () => {
  it('returns the standard cap for a student in good standing', () => {
    expect(maxAllowedCredits({ standing: 'GOOD_STANDING', overloadApproved: false })).toBe(18);
  });

  it('returns the probation cap regardless of overload approval', () => {
    expect(maxAllowedCredits({ standing: 'PROBATION', overloadApproved: true })).toBe(14);
  });

  it('returns the overload cap when approved and not on probation', () => {
    expect(maxAllowedCredits({ standing: 'GOOD_STANDING', overloadApproved: true })).toBe(21);
  });
});

describe('checkCreditLimit', () => {
  it('allows registering exactly up to the max', () => {
    expect(() =>
      checkCreditLimit({ studentId: 'S1', standing: 'GOOD_STANDING', overloadApproved: false, activeCreditHours: 15 }, 3)
    ).not.toThrow();
  });

  it('rejects registering one credit over the max', () => {
    expect(() =>
      checkCreditLimit({ studentId: 'S1', standing: 'GOOD_STANDING', overloadApproved: false, activeCreditHours: 16 }, 3)
    ).toThrow(CreditLimitExceededError);
  });

  it('applies the probation cap', () => {
    expect(() =>
      checkCreditLimit({ studentId: 'S3', standing: 'PROBATION', overloadApproved: false, activeCreditHours: 12 }, 3)
    ).toThrow(CreditLimitExceededError);
  });

  it('applies the overload cap when approved', () => {
    expect(() =>
      checkCreditLimit({ studentId: 'S1', standing: 'GOOD_STANDING', overloadApproved: true, activeCreditHours: 18 }, 3)
    ).not.toThrow();
  });
});

describe('checkScheduleConflict', () => {
  const monMorning = { sectionId: 'A', meetingTimes: [{ day: 'MON', start: '09:00', end: '10:15' }] };
  const monOverlap = { sectionId: 'B', meetingTimes: [{ day: 'MON', start: '10:00', end: '11:00' }] };
  const monAdjacent = { sectionId: 'C', meetingTimes: [{ day: 'MON', start: '10:15', end: '11:30' }] };
  const tuesSameTime = { sectionId: 'D', meetingTimes: [{ day: 'TUE', start: '09:00', end: '10:15' }] };

  it('allows non-overlapping sections on different days', () => {
    expect(() => checkScheduleConflict(tuesSameTime, [monMorning])).not.toThrow();
  });

  it('allows back-to-back sections that touch but do not overlap', () => {
    expect(() => checkScheduleConflict(monAdjacent, [monMorning])).not.toThrow();
  });

  it('rejects overlapping sections on the same day', () => {
    expect(() => checkScheduleConflict(monOverlap, [monMorning])).toThrow(ScheduleConflictError);
  });
});

describe('checkMinimumCredits', () => {
  it('passes at exactly the full-time minimum', () => {
    expect(() => checkMinimumCredits({ studentId: 'S1', activeCreditHours: 12 })).not.toThrow();
  });

  it('rejects one credit below the minimum', () => {
    expect(() => checkMinimumCredits({ studentId: 'S1', activeCreditHours: 11 })).toThrow(BelowMinimumCreditsError);
  });
});
