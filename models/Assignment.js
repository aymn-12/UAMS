const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
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
    description: String,
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileSize: Number
      }
    ],
    deadline: {
      type: Date,
      required: true
    },
    maxScore: {
      type: Number,
      required: true,
      default: 10
    },
    allowLate: {
      type: Boolean,
      default: false
    },
    isClosed: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

assignmentSchema.index({ section: 1, deadline: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
