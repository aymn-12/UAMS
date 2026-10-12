const mongoose = require('mongoose');
const { ASSIGNMENT_STATUS } = require('../config/constants');

const submissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    submittedFiles: [
      {
        fileName: { type: String, required: true },
        fileUrl:  { type: String, required: true },
        fileSize: { type: Number, default: 0 }
      }
    ],
    studentNotes: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Student notes cannot exceed 1000 characters']
    },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.SUBMITTED
    },
    isLate: {
      type: Boolean,
      default: false
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    submissionCount: {
      type: Number,
      default: 1
    },
    score: {
      type: Number,
      min: [0, 'Score cannot be negative']
    },
    doctorFeedback: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Doctor feedback cannot exceed 2000 characters']
    },
    gradedAt: {
      type: Date,
      default: null
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ assignment: 1, status: 1 });
submissionSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
