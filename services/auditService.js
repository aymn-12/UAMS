const AuditLog = require('../models/AuditLog');

/**
 * Log an action to the audit log — non-blocking (setImmediate).
 *
 * @param {Object} opts
 * @param {Object|string}  opts.user          - Full user object or userId
 * @param {string}         opts.action        - Action name (e.g. 'USER_LOGIN')
 * @param {string}         opts.category      - One of: AUTH | GRADE | ATTENDANCE | USER_MGMT | FILE | ACADEMIC | SECURITY | SYSTEM
 * @param {string}         opts.targetEntity  - Name of the affected model/entity (e.g. 'User', 'Section')
 * @param {string}         [opts.targetId]    - ID of the affected document
 * @param {Object}         [opts.details]     - Any extra metadata (non-sensitive only)
 * @param {Request}        [opts.req]         - Express request (for IP + userAgent)
 * @param {string}         [opts.status]      - 'SUCCESS' | 'FAILURE'
 * @param {number}         [opts.durationMs]  - Time taken for the action (ms)
 */
const logAction = ({
  user,
  action,
  category,
  targetEntity,
  targetId,
  details,
  req,
  status = 'SUCCESS',
  durationMs = null,
}) => {
  // Fire-and-forget: doesn't block the HTTP response
  setImmediate(async () => {
    try {
      // Build user snapshot from the user object (preserves info if user is later deleted)
      const userSnapshot = user && typeof user === 'object' && user._id
        ? { name: user.name, email: user.email, role: user.role }
        : undefined;

      await AuditLog.create({
        user:         user ? (user._id || user) : null,
        userSnapshot: userSnapshot || undefined,
        action,
        category,
        targetEntity,
        targetId:     targetId ? targetId.toString() : null,
        details,
        ipAddress:    req ? (req.ip || req.connection?.remoteAddress || '') : null,
        userAgent:    req ? req.get('user-agent') : null,
        status,
        durationMs,
      });
    } catch (error) {
      // Silent fail — audit logging must never crash the application
      console.error('[AuditLog] Write error:', error.message);
    }
  });
};

module.exports = { logAction };
