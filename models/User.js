const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@uomustansiriyah\.edu\.iq$/,
        'Email must belong to @uomustansiriyah.edu.iq domain'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: [true, 'Role is required']
    },
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.ACTIVE
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    avatar: {
      type: String,
      default: ''
    },
    biometricEnabled: {
      type: Boolean,
      default: false
    },
    // Active sessions — capped at 5 per user
    activeSessions: [
      {
        deviceId:  { type: String, required: true },
        token:     { type: String, required: true },
        userAgent: { type: String, default: '' },
        ipAddress: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    // Invalidated tokens (for immediate JWT revocation without Redis)
    // Kept slim — only last 20 tokens, auto-pruned in logout
    tokenBlacklist: {
      type: [{ token: String, expiresAt: Date }],
      default: [],
      select: false
    },
    // Refresh Tokens with family tracking for Refresh Token Rotation (RTR)
    refreshTokens: {
      type: [
        {
          token: { type: String, required: true },
          tokenFamily: { type: String, required: true },
          deviceId: { type: String, default: '' },
          createdAt: { type: Date, default: Date.now },
          expiresAt: { type: Date, required: true }
        }
      ],
      default: [],
      select: false
    },
    lastLogin: {
      type: Date
    },
    // Track failed login attempts for lockout
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false
    },
    lockUntil: {
      type: Date,
      default: null,
      select: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    // Virtual for checking if account is locked
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ department: 1, isDeleted: 1 });
userSchema.index({ status: 1, isDeleted: 1 });

// ─────────────────────────────────────────────
// Virtual: is the account currently locked?
// ─────────────────────────────────────────────
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// ─────────────────────────────────────────────
// Pre-save Hook: hash password on change
// ─────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12); // 12 rounds: security vs performance balance
  this.password = await bcrypt.hash(this.password, salt);
  // Reset failed login counter on password change
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
});

// ─────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────

// Compare entered password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Increment failed login counter; lock after 5 attempts for 15 minutes
userSchema.methods.incLoginAttempts = async function () {
  const LOCK_TIME = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 5;

  // If a previous lock has expired, reset counter
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $set:   { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };

  // Lock account if max attempts reached
  if (this.failedLoginAttempts + 1 >= MAX_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_TIME) };
  }

  return this.updateOne(updates);
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { failedLoginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 }
  });
};

module.exports = mongoose.model('User', userSchema);
