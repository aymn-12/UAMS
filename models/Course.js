const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true
    },
    stage: {
      type: Number,
      required: true
    },
    credits: {
      type: Number,
      required: true,
      default: 3
    },
    description: {
      type: String,
      default: ''
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

courseSchema.index({ department: 1, stage: 1, isDeleted: 1 });

module.exports = mongoose.model('Course', courseSchema);
