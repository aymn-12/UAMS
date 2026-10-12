const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: true
    },
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
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
      default: 'PRESENT'
    },
    markedAt: {
      type: Date,
      default: Date.now
    },
    markedMethod: {
      type: String,
      enum: ['QR', 'MANUAL_DOCTOR', 'BIOMETRIC_QR'],
      default: 'QR'
    },
    deviceId: {
      type: String,
      default: '',
      trim: true
    },
    // Store hashed IP instead of raw for privacy compliance
    clientIp: {
      type: String,
      default: ''
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modificationReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Modification reason cannot exceed 300 characters']
    },
    // Track modifications for full audit trail
    modificationHistory: {
      type: [
        {
          modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          previousStatus: String,
          newStatus: String,
          reason: String,
          modifiedAt: { type: Date, default: Date.now }
        }
      ],
      default: [],
      select: false // Hidden by default — only fetched when explicitly needed
    },
    // Geo-verification: was student within allowed radius?
    geoVerified: {
      type: Boolean,
      default: false
    },
    distanceFromRoom: {
      type: Number, // metres
      default: null
    }
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Prevent double check-in (unique per student per session)
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });

// Anti-proxy: detect one device used by multiple students in same session
attendanceRecordSchema.index({ session: 1, deviceId: 1 });

// Student attendance history (most common query)
attendanceRecordSchema.index({ student: 1, section: 1, createdAt: -1 });

// Section attendance report queries
attendanceRecordSchema.index({ section: 1, status: 1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
