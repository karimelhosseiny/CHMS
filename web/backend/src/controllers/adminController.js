const Student = require('../models/Student');
const catalogService = require('../services/catalogService');

async function createCourse(req, res) {
  const course = await catalogService.addCourse(req.body);
  res.status(201).json(course);
}

async function createSection(req, res) {
  const section = await catalogService.addSection(req.body);
  res.status(201).json(section);
}

async function scheduleConsistency(req, res) {
  const issues = await catalogService.validateScheduleConsistency();
  res.json({ consistent: issues.length === 0, issues });
}

async function listStudents(req, res) {
  const students = await Student.find({});
  res.json(students);
}

async function updateStudent(req, res) {
  const { standing, overloadApproved, completedCourses } = req.body;
  const update = {};
  if (standing !== undefined) update.standing = standing;
  if (overloadApproved !== undefined) update.overloadApproved = overloadApproved;
  if (completedCourses !== undefined) update.completedCourses = completedCourses;

  const student = await Student.findOneAndUpdate({ studentId: req.params.id }, update, { new: true });
  if (!student) {
    res.status(404).json({ error: 'NotFoundError', message: `Unknown student id: ${req.params.id}` });
    return;
  }
  res.json(student);
}

module.exports = { createCourse, createSection, scheduleConsistency, listStudents, updateStudent };
