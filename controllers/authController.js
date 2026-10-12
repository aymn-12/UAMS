const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DoctorProfile = require('../models/DoctorProfile');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const { logAction } = require('../services/auditService');
const { ACCOUNT_STATUS, ROLES } = require('../config/constants');

// Cookie options for secure httpOnly refreshToken storage
const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// ─────────────────────────────────────────────
// @desc    Auth user & issue Access + Refresh Tokens
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password, deviceId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  // Fetch user with sensitive fields needed for auth
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password +failedLoginAttempts +lockUntil +refreshTokens');

  // User not found — return generic message to prevent user enumeration
  if (!user || user.isDeleted) {
    logAction({
      action: 'LOGIN_ATTEMPT_UNKNOWN_EMAIL',
      category: 'AUTH',
      targetEntity: 'User',
      details: { email },
      req,
      status: 'FAILURE',
    });
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Account suspended
  if (user.status === ACCOUNT_STATUS.SUSPENDED) {
    logAction({ user, action: 'LOGIN_SUSPENDED_ACCOUNT', category: 'SECURITY', targetEntity: 'User', targetId: user._id, req, status: 'FAILURE' });
    return res.status(403).json({ success: false, message: 'Account is suspended. Contact administration.' });
  }

  // Account locked (brute-force protection)
  if (user.isLocked) {
    const remainingMs = user.lockUntil - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    logAction({ user, action: 'LOGIN_ACCOUNT_LOCKED', category: 'SECURITY', targetEntity: 'User', targetId: user._id, req, status: 'FAILURE' });
    return res.status(423).json({
      success: false,
      message: `Account is temporarily locked. Try again in ${remainingMins} minute(s).`
    });
  }

  // Verify password
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    await user.incLoginAttempts();
    logAction({ user, action: 'LOGIN_FAILED', category: 'AUTH', targetEntity: 'User', targetId: user._id, req, status: 'FAILURE' });
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // ── Login Successful ──

  // Reset lockout counter
  await user.resetLoginAttempts();

  // 1. Generate short-lived Access Token (15 mins)
  const accessToken = generateAccessToken(user._id, user.role);

  // 2. Generate long-lived Refresh Token (7 days)
  const refreshTokenData = generateRefreshToken(user._id);

  // 3. Manage active sessions
  if (deviceId) {
    user.activeSessions = user.activeSessions.filter((s) => s.deviceId !== deviceId);
  }

  user.activeSessions.push({
    deviceId:  deviceId || 'unknown',
    token:     accessToken,
    userAgent: req.get('user-agent') || '',
    ipAddress: req.ip || '',
    createdAt: new Date()
  });

  if (user.activeSessions.length > 5) {
    user.activeSessions = user.activeSessions.slice(-5);
  }

  // 4. Store Refresh Token for rotation
  if (!user.refreshTokens) user.refreshTokens = [];
  user.refreshTokens.push({
    token:       refreshTokenData.token,
    tokenFamily: refreshTokenData.tokenFamily,
    deviceId:    deviceId || '',
    expiresAt:   refreshTokenData.expiresAt,
    createdAt:   new Date()
  });

  // Keep at most 5 active refresh tokens per user
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  await user.save();

  // Set secure httpOnly cookie for web clients
  res.cookie('refreshToken', refreshTokenData.token, getRefreshTokenCookieOptions());

  logAction({ user, action: 'LOGIN_SUCCESS', category: 'AUTH', targetEntity: 'User', targetId: user._id, req });

  res.status(200).json({
    success: true,
    data: {
      _id:          user._id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      status:       user.status,
      token:        accessToken, // Access Token for Authorization: Bearer
      refreshToken: refreshTokenData.token // Also provided in body for mobile clients
    },
  });
};

// ─────────────────────────────────────────────
// @desc    Refresh Access Token via Refresh Token Rotation (RTR)
// @route   POST /api/auth/refresh-token
// @access  Public (Protected via Refresh Token + CSRF validation)
// ─────────────────────────────────────────────
const refreshTokenHandler = async (req, res) => {
  const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  const secret = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh');

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, secret, {
      algorithms: ['HS256'],
      issuer:     'uams-api',
      audience:   'uams-client'
    });
  } catch (err) {
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
    return res.status(401).json({
      success: false,
      message: 'Refresh token is invalid or expired. Please log in again.'
    });
  }

  const user = await User.findById(decoded.id).select('+refreshTokens +activeSessions');

  if (!user || user.isDeleted || user.status === ACCOUNT_STATUS.SUSPENDED) {
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
    return res.status(401).json({ success: false, message: 'User account inactive or deleted' });
  }

  // ── Reuse Detection (Replay Attack Defense) ──
  const tokenRecord = (user.refreshTokens || []).find((rt) => rt.token === incomingToken);

  if (!tokenRecord) {
    // Check if this token was just rotated within a 15-second grace window by a concurrent request
    const recentSession = (user.activeSessions || []).slice(-1)[0];
    const isGraceWindow = recentSession && (new Date() - new Date(recentSession.createdAt) < 15000);

    if (isGraceWindow) {
      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully (concurrent request reconciled)',
        accessToken: recentSession.token,
        data: {
          token: recentSession.token
        }
      });
    }

    // REUSE DETECTED: Someone presented an already-consumed refresh token!
    // Invalidate ALL refresh tokens and sessions for this user family to protect account
    user.refreshTokens = [];
    user.activeSessions = [];
    try {
      await user.save();
    } catch (_) {}

    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

    logAction({
      user,
      action: 'REFRESH_TOKEN_REUSE_DETECTED',
      category: 'SECURITY',
      targetEntity: 'User',
      targetId: user._id,
      req,
      status: 'FAILURE'
    });

    return res.status(403).json({
      success: false,
      message: 'Security Alert: Suspected token theft. All active sessions have been terminated for your safety. Please log in again.'
    });
  }

  // ── Token Rotation (RTR) ──
  // 1. Remove used refresh token
  user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== incomingToken);

  // 2. Issue NEW Access Token (15 mins)
  const newAccessToken = generateAccessToken(user._id, user.role);

  // 3. Issue NEW Refresh Token in the same token family (7 days)
  const newRefreshTokenData = generateRefreshToken(user._id, decoded.tokenFamily);

  // 4. Save new refresh token & prune expired tokens
  const now = new Date();
  user.refreshTokens.push({
    token:       newRefreshTokenData.token,
    tokenFamily: decoded.tokenFamily,
    deviceId:    tokenRecord.deviceId || '',
    expiresAt:   newRefreshTokenData.expiresAt,
    createdAt:   now
  });

  user.refreshTokens = user.refreshTokens.filter((rt) => rt.expiresAt > now);

  // 5. Update current session in activeSessions
  user.activeSessions.push({
    deviceId:  tokenRecord.deviceId || 'refreshed_session',
    token:     newAccessToken,
    userAgent: req.get('user-agent') || '',
    ipAddress: req.ip || '',
    createdAt: now
  });

  if (user.activeSessions.length > 5) {
    user.activeSessions = user.activeSessions.slice(-5);
  }

  try {
    await user.save();
  } catch (saveErr) {
    if (saveErr.name === 'VersionError') {
      // Concurrency collision: re-fetch latest user document to reconcile
      const freshUser = await User.findById(user._id).select('+refreshTokens +activeSessions');
      const latestSession = freshUser?.activeSessions?.slice(-1)[0];
      if (latestSession) {
        res.cookie('refreshToken', newRefreshTokenData.token, getRefreshTokenCookieOptions());
        return res.status(200).json({
          success: true,
          message: 'Token refreshed successfully',
          accessToken: latestSession.token,
          data: {
            token:        latestSession.token,
            refreshToken: newRefreshTokenData.token
          }
        });
      }
    }
    throw saveErr;
  }

  // 6. Set rotated httpOnly cookie
  res.cookie('refreshToken', newRefreshTokenData.token, getRefreshTokenCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    accessToken: newAccessToken,
    data: {
      token:        newAccessToken,
      refreshToken: newRefreshTokenData.token
    }
  });
};

// ─────────────────────────────────────────────
// @desc    Get current logged in user + profile
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  const [user, profile] = await Promise.all([
    User.findById(req.user._id)
      .select('-activeSessions -tokenBlacklist -refreshTokens')
      .populate('department', 'name code')
      .lean(),
    req.user.role === ROLES.STUDENT
      ? StudentProfile.findOne({ user: req.user._id })
          .populate('department', 'name code')
          .lean()
      : req.user.role === ROLES.DOCTOR
        ? DoctorProfile.findOne({ user: req.user._id })
            .populate('department', 'name code')
            .lean()
        : Promise.resolve(null),
  ]);

  res.status(200).json({
    success: true,
    data: { user, profile },
  });
};

// ─────────────────────────────────────────────
// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
// ─────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
  }

  if (newPassword.length < 8) {
    return res.status(422).json({ success: false, message: 'New password must be at least 8 characters' });
  }

  if (currentPassword === newPassword) {
    return res.status(422).json({ success: false, message: 'New password must differ from the current password' });
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    logAction({ user, action: 'CHANGE_PASSWORD_FAILED', category: 'AUTH', targetEntity: 'User', targetId: user._id, req, status: 'FAILURE' });
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  // Invalidate all active sessions & refresh tokens on password change
  user.activeSessions = [];
  user.refreshTokens = [];
  await user.save();

  res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

  logAction({ user, action: 'CHANGE_PASSWORD', category: 'AUTH', targetEntity: 'User', targetId: user._id, req });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully. Please log in again on all devices.',
  });
};

// ─────────────────────────────────────────────
// @desc    Logout user & invalidate tokens
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────────
const logout = async (req, res) => {
  const { deviceId, allDevices } = req.body || {};

  let updateQuery;
  let message;

  if (allDevices) {
    updateQuery = { $set: { activeSessions: [], refreshTokens: [] } };
    message = 'Logged out from all devices successfully.';
  } else if (deviceId) {
    updateQuery = {
      $pull: {
        activeSessions: { deviceId },
        refreshTokens:  { deviceId }
      }
    };
    message = 'Logged out from this device successfully.';
  } else if (req.token) {
    updateQuery = { $pull: { activeSessions: { token: req.token } } };
    message = 'Logged out successfully.';
  } else {
    updateQuery = { $set: { activeSessions: [], refreshTokens: [] } };
    message = 'Logged out from all devices.';
  }

  await User.findByIdAndUpdate(req.user._id, updateQuery, { new: false });

  // Clear httpOnly cookie on logout
  res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

  logAction({ user: req.user, action: 'LOGOUT', category: 'AUTH', targetEntity: 'User', targetId: req.user._id, req });

  res.status(200).json({
    success: true,
    message,
  });
};

module.exports = {
  login,
  refreshTokenHandler,
  getMe,
  changePassword,
  logout
};
