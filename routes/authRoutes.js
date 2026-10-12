const express = require('express');
const router = express.Router();
const {
  login,
  refreshTokenHandler,
  getMe,
  changePassword,
  logout
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { loginLimiter, passwordLimiter } = require('../middlewares/rateLimitMiddleware');
const {
  validate,
  loginSchema,
  changePasswordSchema,
  logoutSchema
} = require('../middlewares/validationMiddleware');

// Public route: Authenticate with rate limiting
router.post('/login', loginLimiter, validate(loginSchema), login);

// Refresh Token route: Issues new Access Token via Refresh Token Rotation (RTR)
router.post('/refresh-token', refreshTokenHandler);

// Private routes: Require valid Access Token (Bearer)
router.get('/me', protect, getMe);
router.put('/change-password', protect, passwordLimiter, validate(changePasswordSchema), changePassword);
router.post('/logout', protect, validate(logoutSchema), logout);

module.exports = router;
