const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Snapshot of user info at log time (in case user is deleted later)
    userSnapshot: {
      name: String,
      email: String,
      role: String
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['AUTH', 'GRADE', 'ATTENDANCE', 'USER_MGMT', 'FILE', 'ACADEMIC', 'SECURITY', 'SYSTEM'],
      required: true
    },
    targetEntity: {
      type: String,
      required: true,
      trim: true
    },
    targetId: {
      type: String,
      trim: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS'
    },
    // Duration in ms: how long the action took (useful for perf auditing)
    durationMs: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true,
    // Disable _id on sub-documents for lean storage
    versionKey: false
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Admin audit log browsing (user-specific timeline)
auditLogSchema.index({ user: 1, createdAt: -1 });

// Category-based security filtering
auditLogSchema.index({ category: 1, createdAt: -1 });

// Security audit: all failures, newest first
auditLogSchema.index({ status: 1, createdAt: -1 });

// IP-based investigation
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });

// TTL index: auto-purge audit logs older than 1 year (365 days)
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
