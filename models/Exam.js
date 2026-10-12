const mongoose = require('mongoose');
const { EXAM_TYPES } = require('../config/constants');

const examSchema = new mongoose.Schema(
  {
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: Object.values(EXAM_TYPES),
      required: true
    },
    examDate: {
      type: Date,
      required: true
    },
    startTime: String,
    durationMinutes: Number,
    location: String,
    maxScore: {
      type: Number,
      required: true,
      default: 100
    },
    weightPercentage: {
      type: Number,
      default: 20
    },
    instructions: String,
    isPublished: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

examSchema.index({ section: 1, examDate: 1 });

module.exports = mongoose.model('Exam', examSchema);
