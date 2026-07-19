const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));
router.post('/courses', asyncHandler(adminController.createCourse));
router.post('/sections', asyncHandler(adminController.createSection));
router.get('/schedule-consistency', asyncHandler(adminController.scheduleConsistency));
router.get('/students', asyncHandler(adminController.listStudents));
router.patch('/students/:id', asyncHandler(adminController.updateStudent));

module.exports = router;
