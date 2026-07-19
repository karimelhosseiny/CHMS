const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  creditHours: { type: Number, required: true, min: 1 },
  prerequisites: { type: [String], default: [] },
});

module.exports = mongoose.model('Course', courseSchema);
