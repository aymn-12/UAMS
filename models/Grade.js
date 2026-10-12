const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: [0, 'Score cannot be negative']
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    isApproved: {
      type: Boolean,
      default: true
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
gradeSchema.index({ student: 1, exam: 1 }, { unique: true });
gradeSchema.index({ section: 1, exam: 1 });
gradeSchema.index({ student: 1, section: 1 });

module.exports = mongoose.model('Grade', gradeSchema);
