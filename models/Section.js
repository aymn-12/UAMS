const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    sectionNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    semester: {
      type: String,
      required: true,
      enum: ['FIRST', 'SECOND', 'SUMMER'],
      uppercase: true
    },
    academicYear: {
      type: String,
      required: true,
      trim: true // e.g. "2025-2026"
    },
    capacity: {
      type: Number,
      default: 60,
      min: [1, 'Capacity must be at least 1 student']
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    maxAbsenceHours: {
      type: Number,
      default: 6,
      min: [1, 'Max absence hours must be at least 1']
    },
    isClosed: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for enrolled student count
sectionSchema.virtual('enrolledCount').get(function () {
  return this.students ? this.students.length : 0;
});

// Virtual for remaining seats
sectionSchema.virtual('availableSeats').get(function () {
  return Math.max(0, this.capacity - (this.students ? this.students.length : 0));
});

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Unique section code per course, academic year, and semester
sectionSchema.index(
  { course: 1, sectionNumber: 1, academicYear: 1, semester: 1 },
  { unique: true }
);

// Fast lookups for doctor and enrolled students
sectionSchema.index({ doctor: 1, isClosed: 1 });
sectionSchema.index({ students: 1, isClosed: 1 });
sectionSchema.index({ academicYear: 1, semester: 1, isClosed: 1 });

module.exports = mongoose.model('Section', sectionSchema);
