const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true
    },
    stage: {
      type: Number,
      required: true,
      min: 1,
      max: 6
    },
    studyType: {
      type: String,
      enum: ['MORNING', 'EVENING'],
      default: 'MORNING'
    },
    admissionYear: {
      type: Number,
      required: true
    },
    academicStatus: {
      type: String,
      enum: ['REGULAR', 'WARNING', 'SUSPENDED', 'GRADUATED'],
      default: 'REGULAR'
    },
    gpa: {
      type: Number,
      default: 0.0,
      min: 0,
      max: 100
    },
    totalCredits: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

studentProfileSchema.index({ department: 1, stage: 1 });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
