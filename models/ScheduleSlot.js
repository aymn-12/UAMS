const mongoose = require('mongoose');

const scheduleSlotSchema = new mongoose.Schema(
  {
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true
    },
    dayOfWeek: {
      type: String,
      enum: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      required: true
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format']
    },
    // Optional endTime — lectures in Classroom are asynchronous/portal-based, not real-time video meetings
    endTime: {
      type: String,
      default: '',
      match: [/^$|^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format if provided']
    },
    room: {
      type: String,
      default: 'ONLINE',
      trim: true
    },
    building: {
      type: String,
      default: 'GENERAL',
      trim: true
    }
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
scheduleSlotSchema.index({ section: 1, dayOfWeek: 1, startTime: 1 });

module.exports = mongoose.model('ScheduleSlot', scheduleSlotSchema);
