const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema(
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
    sessionTitle: {
      type: String,
      default: 'Lecture',
      trim: true,
      maxlength: [100, 'Session title cannot exceed 100 characters']
    },
    dynamicToken: {
      type: String,
      required: true,
      unique: true
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN'
    },
    room: {
      type: String,
      trim: true,
      maxlength: [50, 'Room name cannot exceed 50 characters']
    },
    geoFence: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90,  'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180,  'Longitude must be between -180 and 180']
      },
      radiusMeters: { type: Number, default: 50, min: [1, 'Radius must be at least 1 meter'] }
    },
    // Total check-ins for quick stat access (no extra query)
    checkInCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Query index: find open sessions for a section
attendanceSessionSchema.index({ section: 1, status: 1, expiresAt: -1 });

// TTL index: MongoDB auto-deletes sessions 30 days after they expire
// This keeps the collection lean without a cron job
attendanceSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 } // 30 days retention after expiry
);

// Doctor sessions index: fast lookup for doctor's session list
attendanceSessionSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
