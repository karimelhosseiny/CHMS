const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const courseController = require('../controllers/courseController');

const router = express.Router();

router.get('/', asyncHandler(courseController.list));
router.get('/:code', asyncHandler(courseController.get));

module.exports = router;
