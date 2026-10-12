/**
 * Cross-Site Request Forgery (CSRF) Protection Middleware
 *
 * Enforces strict Origin / Referer validation and custom request header checks
 * on state-changing methods (POST, PUT, DELETE, PATCH).
 */

const verifyCsrf = (req, res, next) => {
  // Safe methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 1. Origin / Referer Header Validation
  const origin = req.headers.origin || req.headers.referer;

  if (origin) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:5173'];

    // In development, also accept localhost on any port or same host
    const originHost = new URL(origin).host;
    const currentHost = req.get('host');

    const isSameHost = originHost === currentHost;
    const isWhitelisted = allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).host === originHost;
      } catch (e) {
        return false;
      }
    });

    if (!isSameHost && !isWhitelisted) {
      console.warn(`[CSRF] Blocked cross-origin request from origin: ${origin} to path: ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        message: 'CSRF Protection: Request origin not allowed.'
      });
    }
  }

  // 2. Custom Header Verification for Cookie-dependent API requests
  // Browsers cannot send custom headers from simple cross-site HTML forms / image tags
  const hasCustomHeader =
    req.headers['x-requested-with'] ||
    req.headers['x-csrf-protection'] ||
    req.headers['authorization'];

  // If a request relies on cookies without an Authorization header, require custom header
  if (req.cookies && req.cookies.refreshToken && !hasCustomHeader && !origin) {
    return res.status(403).json({
      success: false,
      message: 'CSRF Protection: Missing required verification header.'
    });
  }

  next();
};

module.exports = { verifyCsrf };
