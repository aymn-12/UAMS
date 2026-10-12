const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  getMyCard,
  rotateMyCardToken,
  verifyCard
} = require('../controllers/digitalIdController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { ROLES } = require('../config/constants');

// Anti-scraping rate limiter for public verification: max 30 scans per 10 minutes per IP
const verifyCardLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      isValid: false,
      message: 'Too many verification attempts from this IP address. Please try again after 10 minutes.'
    });
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

// Public verification (Anti-scraping rate limited, returns minimal safe data)
router.get('/verify/:cardUid', verifyCardLimiter, verifyCard);

// Student digital card view
router.get('/my-card', protect, authorize(ROLES.STUDENT), getMyCard);

// Student token rotation (regenerates QR code security token)
router.post('/rotate-token', protect, authorize(ROLES.STUDENT), rotateMyCardToken);

module.exports = router;
