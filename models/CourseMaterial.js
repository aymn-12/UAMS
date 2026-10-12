const mongoose = require('mongoose');

const studentAnnotationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pageNumber: Number,
    noteText: String,
    highlights: [String],
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const courseMaterialSchema = new mongoose.Schema(
  {
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true
    },
    uploadedBy: {
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
    fileUrl: {
      type: String,
      required: true
    },
    fileName: String,
    fileSize: Number,
    fileType: {
      type: String,
      default: 'application/pdf'
    },
    isLecture: {
      type: Boolean,
      default: true
    },
    lectureDate: Date,
    studentAnnotations: [studentAnnotationSchema]
  },
  { timestamps: true }
);

courseMaterialSchema.index({ section: 1, isLecture: 1, lectureDate: -1 });

module.exports = mongoose.model('CourseMaterial', courseMaterialSchema);
