class RegistrationError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

class CourseNotFoundError extends RegistrationError {
  constructor(message) {
    super(message, 404);
  }
}

class DuplicateEnrollmentError extends RegistrationError {
  constructor(message) {
    super(message, 409);
  }
}

class SectionFullError extends RegistrationError {
  constructor(message) {
    super(message, 409);
  }
}

class PrerequisiteNotMetError extends RegistrationError {
  constructor(message) {
    super(message, 422);
  }
}

class CreditLimitExceededError extends RegistrationError {
  constructor(message) {
    super(message, 422);
  }
}

class ScheduleConflictError extends RegistrationError {
  constructor(message) {
    super(message, 409);
  }
}

class NotEnrolledError extends RegistrationError {
  constructor(message) {
    super(message, 404);
  }
}

class BelowMinimumCreditsError extends RegistrationError {
  constructor(message) {
    super(message, 422);
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

module.exports = {
  RegistrationError,
  CourseNotFoundError,
  DuplicateEnrollmentError,
  SectionFullError,
  PrerequisiteNotMetError,
  CreditLimitExceededError,
  ScheduleConflictError,
  NotEnrolledError,
  BelowMinimumCreditsError,
  NotFoundError,
};
