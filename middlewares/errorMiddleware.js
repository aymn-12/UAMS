const { logServerError, logClientError } = require('../utils/devLogger');
const { decodeTechnicalError } = require('../utils/errorTranslator');

// ─────────────────────────────────────────────
// 404 Not Found Handler
// ─────────────────────────────────────────────
const notFound = (req, res, next) => {
  const error = new Error(`Resource Not Found - ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  // If response headers have already been sent, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  // Determine HTTP status code
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // ── Mongoose: CastError (invalid ObjectId) ──
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
  }

  // ── Mongoose: Duplicate key error ──
  if (err.code === 11000) {
    statusCode = 409;
  }

  // ── Mongoose: Validation error ──
  if (err.name === 'ValidationError') {
    statusCode = 422;
  }

  // ── JWT: Token errors ──
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
  }

  // ── CORS error ──
  if (err.message && err.message.startsWith('CORS:')) {
    statusCode = 403;
  }

  // ── Multer errors ──
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
  }

  // ── SyntaxError (Malformed JSON in Body) ──
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
  }

  // Decode technical error into normalized error + exact root source
  const decoded = decodeTechnicalError(err, req);

  // Terminal logging with full source pinpointing
  if (statusCode >= 500) {
    logServerError(err, req);
  } else if (process.env.NODE_ENV === 'development') {
    logClientError(err, req, statusCode);
  }

  // Return clean technical JSON payload (Zero HTML tags)
  res.status(statusCode).json({
    success: false,
    statusCode,
    error: {
      type: decoded.errorType,
      code: decoded.technicalCode,
      message: decoded.cleanMessage,
      source: {
        file: decoded.source.file,
        line: decoded.source.line,
        column: decoded.source.column,
        function: decoded.source.functionName,
        layer: decoded.source.layer,
        sourceType: decoded.source.sourceType,
        location: decoded.source.location,
      },
      isHtmlDecoded: decoded.isHtmlDecoded,
    },
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
};

module.exports = { notFound, errorHandler };
