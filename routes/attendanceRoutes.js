const express = require('express');
const router = express.Router();
const {
  createSession,
  closeSession,
  getActiveSessionForDoctor,
  getActiveSessionForSection,
  studentCheckIn,
  getLiveSession,
  rotateSessionToken,
  manualUpdateRecord,
  getStudentAttendanceStats,
  getSectionAttendanceOverview,
  getMyOverallAttendanceStats
} = require('../controllers/attendanceController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const {
  createSessionSchema,
  checkInSchema,
  manualUpdateRecordSchema
} = require('../middlewares/attendanceValidation');
const { ROLES } = require('../config/constants');

// All attendance routes require active authentication
router.use(protect);

// ─────────────────────────────────────────────
// Doctor / Faculty Session Management
// ─────────────────────────────────────────────
router.post(
  '/sessions',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(createSessionSchema),
  createSession
);

router.put(
  '/sessions/:id/close',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  closeSession
);

router.get(
  '/sessions/:id/live',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  getLiveSession
);

router.post(
  '/sessions/:id/rotate-token',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  rotateSessionToken
);

router.get(
  '/active-session',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  getActiveSessionForDoctor
);

router.get(
  '/sections/:id/active-session',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  getActiveSessionForSection
);

router.get(
  '/sections/:id/overview',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  getSectionAttendanceOverview
);

// ─────────────────────────────────────────────
// Student Check-In
// ─────────────────────────────────────────────
router.post(
  '/check-in',
  authorize(ROLES.STUDENT),
  validate(checkInSchema),
  studentCheckIn
);

router.get(
  '/student/me',
  authorize(ROLES.STUDENT),
  getMyOverallAttendanceStats
);

router.get(
  '/sections/:id/my-stats',
  authorize(ROLES.STUDENT),
  getStudentAttendanceStats
);

// ─────────────────────────────────────────────
// Doctor Manual Override
// ─────────────────────────────────────────────
router.put(
  '/records/:id',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(manualUpdateRecordSchema),
  manualUpdateRecord
);

module.exports = router;
