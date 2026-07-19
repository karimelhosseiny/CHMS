const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  sectionId: { type: String, required: true },
  courseCode: { type: String, required: true },
  creditHours: { type: Number, required: true },
  status: { type: String, enum: ['ENROLLED', 'WAITLISTED', 'DROPPED'], required: true },
  timestamp: { type: String, required: true },
});

enrollmentSchema.index({ studentId: 1, sectionId: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
