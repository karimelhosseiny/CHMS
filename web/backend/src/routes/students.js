const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

const router = express.Router();

router.use(requireAuth, requireRole('student'));
router.get('/me', asyncHandler(studentController.me));
router.post('/me/finalize', asyncHandler(studentController.finalize));

module.exports = router;
