const registrationService = require('../services/registrationService');

async function create(req, res) {
  const { sectionId, allowWaitlist = true } = req.body;
  if (!sectionId) {
    res.status(400).json({ error: 'BadRequest', message: 'sectionId is required' });
    return;
  }
  const enrollment = await registrationService.register(req.user.studentId, sectionId, allowWaitlist);
  res.status(201).json(enrollment);
}

async function remove(req, res) {
  await registrationService.drop(req.user.studentId, req.params.sectionId);
  res.status(204).send();
}

module.exports = { create, remove };
