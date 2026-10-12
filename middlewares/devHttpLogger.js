const { logIncomingRequest, logCompletedResponse } = require('../utils/devLogger');

/**
 * Developer Real-time HTTP Request & Response Logger Middleware
 * Provides instant real-time feedback in CMD when an API is called.
 */
const devHttpLogger = (req, res, next) => {
  // Only log API routes or ignore raw static requests if needed
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  // 1. Immediately log incoming API call
  logIncomingRequest(req);

  // 2. Measure execution duration
  const startTime = process.hrtime();

  // 3. Log on response completion
  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(1);
    logCompletedResponse(req, res, durationMs);
  });

  next();
};

module.exports = devHttpLogger;
