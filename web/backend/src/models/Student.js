const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  standing: { type: String, enum: ['GOOD_STANDING', 'PROBATION'], default: 'GOOD_STANDING' },
  overloadApproved: { type: Boolean, default: false },
  completedCourses: { type: [String], default: [] },
});

module.exports = mongoose.model('Student', studentSchema);
