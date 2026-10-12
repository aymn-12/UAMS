const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ACCOUNT_STATUS } = require('../config/constants');

// ─────────────────────────────────────────────
// protect — Authenticate JWT and attach req.user
// ─────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token || token.trim() === '') {
    return res.status(401).json({ success: false, message: 'Not authorized. No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer:     'uams-api',
      audience:   'uams-client',
    });
  } catch (err) {
    // Pass to global error handler for consistent JWT error messages
    return next(err);
  }

  // Fetch user — include lockUntil to enforce lockouts on every request
  const user = await User.findById(decoded.id)
    .select('name email role status isDeleted department lockUntil activeSessions')
    .lean();

  if (!user) {
    return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists.' });
  }

  if (user.isDeleted) {
    return res.status(401).json({ success: false, message: 'This account has been deleted.' });
  }

  if (user.status === ACCOUNT_STATUS.SUSPENDED) {
    return res.status(403).json({ success: false, message: 'Account is suspended. Contact administration.' });
  }

  // Enforce lockout — even for already-authenticated users
  if (user.lockUntil && user.lockUntil > new Date()) {
    const remainingMins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return res.status(423).json({
      success: false,
      message: `Account is temporarily locked. Try again in ${remainingMins} minute(s).`
    });
  }

  // Check if the token's session is still active (not been logged out)
  // Only enforce if user has an activeSessions array with content
  if (user.activeSessions && user.activeSessions.length > 0) {
    const isSessionActive = user.activeSessions.some(s => s.token === token);
    if (!isSessionActive) {
      return res.status(401).json({
        success: false,
        message: 'Session has been terminated. Please log in again.'
      });
    }
  }

  // Attach plain user object — controllers use req.user.role, req.user._id etc.
  req.user = user;

  // Expose the raw token (needed for logout to remove from activeSessions)
  req.token = token;

  next();
};

module.exports = { protect };
