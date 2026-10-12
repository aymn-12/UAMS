const express = require('express');
const router = express.Router();
const {
  createUser,
  getUsers,
  updateUserStatus,
  getAuditLogs
} = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { adminSensitiveLimiter } = require('../middlewares/rateLimitMiddleware');
const {
  validate,
  validateQuery,
  createUserSchema,
  updateUserStatusSchema,
  queryUsersSchema,
  queryAuditLogsSchema
} = require('../middlewares/validationMiddleware');
const { ROLES } = require('../config/constants');

// Apply protection and Admin check to all admin routes
router.use(protect);
router.use(authorize(ROLES.ADMIN));

// User Management
router.post(
  '/users',
  adminSensitiveLimiter,
  validate(createUserSchema),
  createUser
);

router.get(
  '/users',
  validateQuery(queryUsersSchema),
  getUsers
);

router.put(
  '/users/:id/status',
  adminSensitiveLimiter,
  validate(updateUserStatusSchema),
  updateUserStatus
);

// Audit Inspection
router.get(
  '/audit-logs',
  validateQuery(queryAuditLogsSchema),
  getAuditLogs
);

module.exports = router;
