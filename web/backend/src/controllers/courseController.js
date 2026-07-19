const Course = require('../models/Course');
const catalogService = require('../services/catalogService');

async function list(req, res) {
  const courses = await Course.find({});
  res.json(courses);
}

async function get(req, res) {
  const course = await catalogService.getCourse(req.params.code);
  res.json(course);
}

module.exports = { list, get };
