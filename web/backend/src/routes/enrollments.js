const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const enrollmentController = require('../controllers/enrollmentController');

const router = express.Router();

router.use(requireAuth, requireRole('student'));
router.post('/', asyncHandler(enrollmentController.create));
router.delete('/:sectionId', asyncHandler(enrollmentController.remove));

module.exports = router;
