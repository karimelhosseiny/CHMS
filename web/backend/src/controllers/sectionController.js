const Section = require('../models/Section');
const catalogService = require('../services/catalogService');

async function list(req, res) {
  const filter = req.query.courseCode ? { courseCode: req.query.courseCode } : {};
  const sections = await Section.find(filter);
  res.json(sections);
}

async function get(req, res) {
  const section = await catalogService.getSection(req.params.sectionId);
  res.json(section);
}

module.exports = { list, get };
