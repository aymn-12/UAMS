const rateLimit = require('express-rate-limit');

// Helper to generate standardized error response
const createLimiterResponse = (message) => ({
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      success: false,
      message,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000)
    });
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

// Rate limiter for login: configurable attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: (Number(process.env.ACCOUNT_LOCKOUT_MINUTES) || 15) * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  ...createLimiterResponse('Too many login attempts. Please try again later.')
});

// Rate limiter for password changes: 5 attempts per 15 minutes per IP
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  ...createLimiterResponse('Too many password change attempts. Please try again after 15 minutes.')
});

// Rate limiter for sensitive admin actions (creating users, mass status changes): 50 per 15 min
const adminSensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  ...createLimiterResponse('Too many administrative requests. Please slow down.')
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 300,
  ...createLimiterResponse('Too many requests from this IP. Please try again later.')
});

module.exports = {
  loginLimiter,
  passwordLimiter,
  adminSensitiveLimiter,
  apiLimiter
};
