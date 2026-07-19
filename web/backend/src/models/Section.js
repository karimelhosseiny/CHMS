const mongoose = require('mongoose');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeSlotSchema = new mongoose.Schema(
  {
    day: { type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], required: true },
    start: { type: String, required: true, match: HHMM },
    end: { type: String, required: true, match: HHMM },
  },
  { _id: false }
);

timeSlotSchema.pre('validate', function timeSlotOrderCheck(next) {
  if (this.start >= this.end) {
    next(new Error('TimeSlot start must be before end'));
    return;
  }
  next();
});

const sectionSchema = new mongoose.Schema({
  sectionId: { type: String, required: true, unique: true },
  courseCode: { type: String, required: true },
  term: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1 },
  meetingTimes: { type: [timeSlotSchema], default: [] },
  instructor: { type: String, required: true },
  room: { type: String, required: true },
  roster: { type: [String], default: [] },
  waitlist: { type: [String], default: [] },
});

module.exports = mongoose.model('Section', sectionSchema);
