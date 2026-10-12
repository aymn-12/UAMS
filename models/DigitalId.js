const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const digitalIdSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    cardUid: {
      type: String,
      required: true,
      unique: true
    },
    barcodeNumber: {
      type: String,
      required: true,
      unique: true
    },
    issueDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // QR security token — rotated on every card re-issue/scan
    qrSecurityToken: {
      type: String,
      required: true,
      default: () => uuidv4()
    },
    // Track last token rotation time — helps detect scraping patterns
    tokenRotatedAt: {
      type: Date,
      default: Date.now
    },
    // Revocation history: keeps a log of all past tokens (last 10)
    revokedTokens: {
      type: [String],
      default: [],
      select: false // Never returned in queries by default
    },
    // Track scan count — anomaly detection (too many scans in short time)
    scanCount: {
      type: Number,
      default: 0
    },
    lastScannedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
digitalIdSchema.index({ cardUid: 1, isActive: 1 });

// ─────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────

// Rotate the QR security token — call on re-issue or suspicious activity
digitalIdSchema.methods.rotateToken = async function () {
  const oldToken = this.qrSecurityToken;

  // Keep last 10 revoked tokens for audit trail
  const currentRevoked = Array.isArray(this.revokedTokens) ? this.revokedTokens : [];
  this.revokedTokens = [oldToken, ...currentRevoked].filter(Boolean).slice(0, 10);
  this.qrSecurityToken = uuidv4();
  this.tokenRotatedAt = new Date();

  return this.save();
};

// Record a scan — track frequency for anomaly detection
digitalIdSchema.methods.recordScan = async function () {
  this.scanCount += 1;
  this.lastScannedAt = new Date();
  return this.save();
};

// Check if token is still valid (not expired, not revoked)
digitalIdSchema.methods.isTokenValid = function (token) {
  if (this.qrSecurityToken !== token) return false;
  if (new Date() > this.expiryDate) return false;
  return true;
};

module.exports = mongoose.model('DigitalId', digitalIdSchema);
