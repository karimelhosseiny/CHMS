const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const sectionController = require('../controllers/sectionController');

const router = express.Router();

router.get('/', asyncHandler(sectionController.list));
router.get('/:sectionId', asyncHandler(sectionController.get));

module.exports = router;
