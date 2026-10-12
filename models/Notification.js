const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters']
    },
    type: {
      type: String,
      enum: [
        'ASSIGNMENT',
        'EXAM',
        'GRADE',
        'ATTENDANCE_WARNING',
        'ANNOUNCEMENT',
        'QUESTION_ANSWERED',
        'ENROLLMENT',
        'GENERAL'
      ],
      default: 'GENERAL'
    },
    // Reference to the related resource (e.g. assignment _id, exam _id)
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    link: {
      type: String,
      default: '',
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    // Priority: HIGH notifications show as banners in front-end
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH'],
      default: 'NORMAL'
    }
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Main query index: unread first, newest first
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Type filter index: filter by notification type per user
notificationSchema.index({ recipient: 1, type: 1 });

// TTL index: auto-delete notifications older than 90 days
// Keeps the collection lean without a maintenance cron job
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 } // 90 days
);

module.exports = mongoose.model('Notification', notificationSchema);
