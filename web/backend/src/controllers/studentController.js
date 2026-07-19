const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const registrationService = require('../services/registrationService');
const { maxAllowedCredits } = require('../validators/registrationRules');

async function me(req, res) {
  const student = await Student.findOne({ studentId: req.user.studentId });
  const enrollments = await Enrollment.find({
    studentId: req.user.studentId,
    status: { $ne: 'DROPPED' },
  });
  const studentView = await registrationService.buildStudentView(student);
  res.json({
    student,
    enrollments,
    activeCreditHours: studentView.activeCreditHours,
    maxAllowedCredits: maxAllowedCredits(studentView),
  });
}

async function finalize(req, res) {
  await registrationService.validateFinalRegistration(req.user.studentId);
  res.json({ ok: true, message: 'Registration meets the full-time minimum credit requirement.' });
}

module.exports = { me, finalize };
