const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    employeeId: {
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
    academicTitle: {
      type: String,
      default: 'LECTURER',
      trim: true
    },
    officeLocation: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

doctorProfileSchema.index({ department: 1 });

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);
