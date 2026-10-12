/**
 * Terminal DevLogger for UAMS (University Academic Management System)
 * Strictly NO EMOJIS — Uses clean ANSI styling, high-contrast badges, and structured formatting.
 */

const path = require('path');
const { decodeTechnicalError, decompileHtmlError } = require('./errorTranslator');

// ANSI Escape Codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',

  // Foreground Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright Foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background Colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  bgGray: '\x1b[100m',
};

/**
 * Format current timestamp in HH:mm:ss format
 */
const getTimestamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

/**
 * Return a styled badge for HTTP Methods
 */
const formatMethod = (method) => {
  const m = (method || 'GET').toUpperCase().padEnd(7, ' ');
  switch (method.toUpperCase()) {
    case 'GET':
      return `${ANSI.bold}${ANSI.cyan}${m}${ANSI.reset}`;
    case 'POST':
      return `${ANSI.bold}${ANSI.green}${m}${ANSI.reset}`;
    case 'PUT':
      return `${ANSI.bold}${ANSI.yellow}${m}${ANSI.reset}`;
    case 'PATCH':
      return `${ANSI.bold}${ANSI.magenta}${m}${ANSI.reset}`;
    case 'DELETE':
      return `${ANSI.bold}${ANSI.red}${m}${ANSI.reset}`;
    default:
      return `${ANSI.bold}${ANSI.white}${m}${ANSI.reset}`;
  }
};

/**
 * Return a styled badge for HTTP Status Codes
 */
const formatStatusCode = (statusCode) => {
  const code = Number(statusCode) || 200;
  if (code >= 200 && code < 300) {
    return `${ANSI.bold}${ANSI.brightGreen}[${code} OK]${ANSI.reset}`;
  }
  if (code >= 300 && code < 400) {
    return `${ANSI.bold}${ANSI.cyan}[${code} REDIR]${ANSI.reset}`;
  }
  if (code >= 400 && code < 500) {
    return `${ANSI.bold}${ANSI.brightYellow}[${code} CLIENT ERR]${ANSI.reset}`;
  }
  return `${ANSI.bold}${ANSI.bgRed}${ANSI.brightWhite}[${code} SERVER ERR]${ANSI.reset}`;
};

/**
 * Return styled response duration badge
 */
const formatDuration = (ms) => {
  const val = Number(ms) || 0;
  if (val < 100) {
    return `${ANSI.green}${val}ms${ANSI.reset}`.padEnd(14, ' ');
  }
  if (val < 500) {
    return `${ANSI.yellow}${val}ms${ANSI.reset}`.padEnd(14, ' ');
  }
  return `${ANSI.brightRed}${ANSI.bold}${val}ms (SLOW)${ANSI.reset}`.padEnd(20, ' ');
};

/**
 * Sanitize sensitive fields from body or query before displaying to developer
 */
const sanitizePayload = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  const sensitiveKeys = ['password', 'passwordConfirm', 'refreshToken', 'token', 'accessToken', 'secret'];
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key)) {
      clone[key] = '***HIDDEN***';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = sanitizePayload(clone[key]);
    }
  }
  return clone;
};

/**
 * Log incoming API request in real-time
 */
const logIncomingRequest = (req) => {
  const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
  const tag = `${ANSI.bold}${ANSI.blue}[--> REQ]${ANSI.reset}`;
  const method = formatMethod(req.method);
  const url = `${ANSI.brightWhite}${req.originalUrl || req.url}${ANSI.reset}`;
  const ip = `${ANSI.dim}(IP: ${req.ip || req.socket.remoteAddress || '127.0.0.1'})${ANSI.reset}`;

  console.log(`${time} ${tag} ${method} ${url} ${ip}`);
};

/**
 * Log completed API response
 */
const logCompletedResponse = (req, res, durationMs) => {
  const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
  const tag = `${ANSI.bold}${ANSI.brightGreen}[<-- RES]${ANSI.reset}`;
  const method = formatMethod(req.method);
  const status = formatStatusCode(res.statusCode);
  const duration = formatDuration(durationMs);
  const url = `${ANSI.brightWhite}${req.originalUrl || req.url}${ANSI.reset}`;

  let authInfo = '';
  if (req.user) {
    const roleColor = req.user.role === 'ADMIN' ? ANSI.brightMagenta : req.user.role === 'DOCTOR' ? ANSI.brightCyan : ANSI.brightGreen;
    authInfo = ` ${ANSI.gray}[User: ${ANSI.white}${req.user.email || req.user.id}${ANSI.gray} | ${roleColor}${req.user.role}${ANSI.gray}]${ANSI.reset}`;
  }

  console.log(`${time} ${tag} ${method} ${status} ${duration} ${url}${authInfo}`);
};

/**
 * Developer Error Inspector for HTTP 4xx Client Errors
 */
const logClientError = (err, req, statusCode) => {
  const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
  const tag = `${ANSI.bold}${ANSI.yellow}[WARN ${statusCode}]${ANSI.reset}`;
  const method = formatMethod(req.method);
  const url = `${ANSI.brightWhite}${req.originalUrl || req.url}${ANSI.reset}`;
  const cleanMsg = decompileHtmlError(err.message || 'Client Request Error').cleanMessage;

  console.log(`${time} ${tag} ${method} ${url}`);
  console.log(`               ${ANSI.dim}Reason :${ANSI.reset} ${ANSI.yellow}${cleanMsg}${ANSI.reset}`);
};

/**
 * Developer Error Inspector for HTTP 500 / Fatal Server Errors
 * Decompiles raw HTML error pages and pinpoints the EXACT root source (file, line, function, layer).
 */
const logServerError = (err, req) => {
  const sep = '='.repeat(82);
  const subSep = '-'.repeat(82);
  const time = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Decode error into clean technical terms and pinpoint root source
  const decoded = decodeTechnicalError(err, req);

  console.log('');
  console.log(`${ANSI.brightRed}${ANSI.bold}${sep}${ANSI.reset}`);
  console.log(`${ANSI.bgRed}${ANSI.brightWhite}${ANSI.bold} [ERROR 500 DECODED] TECHNICAL BREAKDOWN & ROOT SOURCE PINPOINT           ${ANSI.reset}`);
  console.log(`${ANSI.brightRed}${ANSI.bold}${sep}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Timestamp       :${ANSI.reset} ${ANSI.white}${time}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Endpoint        :${ANSI.reset} ${formatMethod(req.method)} ${ANSI.brightWhite}${req.originalUrl || req.url}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Client IP       :${ANSI.reset} ${ANSI.white}${req.ip || req.socket.remoteAddress || '127.0.0.1'}${ANSI.reset}`);

  if (req.user) {
    console.log(`  ${ANSI.gray}Auth User       :${ANSI.reset} ${ANSI.white}${req.user.email || req.user._id} (${req.user.role})${ANSI.reset}`);
  } else {
    console.log(`  ${ANSI.gray}Auth User       :${ANSI.reset} ${ANSI.dim}Unauthenticated / Public Client${ANSI.reset}`);
  }

  console.log(`${ANSI.cyan}${subSep}${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.brightCyan}[TECHNICAL SPECIFICATION]${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Error Type      :${ANSI.reset} ${ANSI.bold}${ANSI.brightRed}${decoded.errorType}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Technical Code  :${ANSI.reset} ${ANSI.yellow}${decoded.technicalCode}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Decoded Message :${ANSI.reset} ${ANSI.brightWhite}${decoded.cleanMessage}${ANSI.reset}`);
  if (decoded.isHtmlDecoded) {
    console.log(`  ${ANSI.gray}HTML Intercept  :${ANSI.reset} ${ANSI.magenta}[YES] Raw HTML 500 was intercepted & decompiled${ANSI.reset}`);
  }

  console.log(`${ANSI.cyan}${subSep}${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.brightCyan}[EXACT ERROR SOURCE & ROOT CAUSE]${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Root Source File:${ANSI.reset} ${ANSI.bold}${ANSI.brightYellow}${decoded.source.file}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Exact Position  :${ANSI.reset} ${ANSI.bold}${ANSI.brightWhite}Line ${decoded.source.line}, Column ${decoded.source.column}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Function / Scope:${ANSI.reset} ${ANSI.brightCyan}${decoded.source.functionName}()${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Layer Category  :${ANSI.reset} ${ANSI.green}[${decoded.source.layer}]${ANSI.reset} (${decoded.source.sourceType})`);
  console.log(`  ${ANSI.gray}Location Link   :${ANSI.reset} ${ANSI.dim}${decoded.source.location}${ANSI.reset}`);

  // Display request payload if available (safe sanitized)
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`${ANSI.gray}${subSep}${ANSI.reset}`);
    console.log(`  ${ANSI.gray}Request Body (Sanitized):${ANSI.reset}`);
    console.log(`${ANSI.dim}${JSON.stringify(sanitizePayload(req.body), null, 2)}${ANSI.reset}`);
  }

  if (req.query && Object.keys(req.query).length > 0) {
    console.log(`  ${ANSI.gray}Query Parameters:${ANSI.reset} ${ANSI.dim}${JSON.stringify(req.query)}${ANSI.reset}`);
  }

  // Application Call Stack Breakdown
  if (decoded.allFrames && decoded.allFrames.length > 0) {
    console.log(`${ANSI.gray}${subSep}${ANSI.reset}`);
    console.log(`  ${ANSI.gray}Application Call Stack Breakdown:${ANSI.reset}`);
    for (const frame of decoded.allFrames) {
      if (frame.isProjectCode) {
        console.log(`    ${ANSI.bold}${ANSI.brightRed}>> ${frame.relativePath}:${frame.line}:${frame.column} in ${frame.functionName}()${ANSI.reset}`);
      } else {
        console.log(`    ${ANSI.dim}   ${frame.relativePath || frame.fileName}:${frame.line || 0} in ${frame.functionName}()${ANSI.reset}`);
      }
    }
  }

  console.log(`${ANSI.brightRed}${ANSI.bold}${sep}${ANSI.reset}`);
  console.log('');
};

/**
 * Print System Startup Banner on CMD
 */
const printStartupBanner = ({ port, env, dbUri, connectedHost, dbName }) => {
  const line = '='.repeat(82);
  const subLine = '-'.repeat(82);

  console.log('');
  console.log(`${ANSI.cyan}${ANSI.bold}${line}${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.brightCyan} [UAMS BACKEND ENGINE] UNIVERSITY ACADEMIC MANAGEMENT SYSTEM${ANSI.reset}`);
  console.log(`${ANSI.cyan} AL-MUSTANSIRIYAH UNIVERSITY | DEVELOPER ENVIRONMENT${ANSI.reset}`);
  console.log(`${ANSI.cyan}${ANSI.bold}${line}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}System Status :${ANSI.reset} ${ANSI.bold}${ANSI.brightGreen}[ONLINE] Ready to receive API requests${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Server URL    :${ANSI.reset} ${ANSI.bold}${ANSI.brightWhite}http://localhost:${port}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Environment   :${ANSI.reset} ${ANSI.yellow}${env}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Runtime Engine:${ANSI.reset} ${ANSI.white}Node.js ${process.version} (PID: ${process.pid})${ANSI.reset}`);
  console.log(`${ANSI.cyan}${subLine}${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Database Host :${ANSI.reset} ${ANSI.green}${connectedHost || '127.0.0.1'}${ANSI.reset} | ${ANSI.gray}Database:${ANSI.reset} ${ANSI.green}${dbName || 'uams_db'}${ANSI.reset} ${ANSI.brightGreen}[CONNECTED]${ANSI.reset}`);
  console.log(`  ${ANSI.gray}Security Core :${ANSI.reset} ${ANSI.white}Dual Tokens (RTR) | CSRF Protection | NoSQL Sanitizer${ANSI.reset}`);
  console.log(`  ${ANSI.gray}File Storage  :${ANSI.reset} ${ANSI.white}Unlimited Size Enabled | Strict MIME Validation${ANSI.reset}`);
  console.log(`${ANSI.cyan}${subLine}${ANSI.reset}`);
  console.log(`  ${ANSI.bold}${ANSI.white}Active Core Route Modules:${ANSI.reset}`);
  console.log(`  ${ANSI.dim}[+] /api/auth          [+] /api/academic      [+] /api/attendance    [+] /api/digital-id${ANSI.reset}`);
  console.log(`  ${ANSI.dim}[+] /api/student       [+] /api/doctor        [+] /api/admin         [+] /api/assignments${ANSI.reset}`);
  console.log(`  ${ANSI.dim}[+] /api/exams         [+] /api/materials     [+] /api/questions     [+] /api/dashboards${ANSI.reset}`);
  console.log(`  ${ANSI.dim}[+] /api/reports       [+] /api/notifications [+] /api/announcements [+] /api/files${ANSI.reset}`);
  console.log(`${ANSI.cyan}${ANSI.bold}${line}${ANSI.reset}`);
  console.log(`  ${ANSI.brightGreen}[DEV CONSOLE ACTIVE]${ANSI.reset} ${ANSI.dim}Real-time API requests, technical error decoders, and source locators active:${ANSI.reset}`);
  console.log(`${ANSI.cyan}${ANSI.bold}${line}${ANSI.reset}`);
  console.log('');
};

module.exports = {
  ANSI,
  getTimestamp,
  formatMethod,
  formatStatusCode,
  formatDuration,
  logIncomingRequest,
  logCompletedResponse,
  logClientError,
  logServerError,
  printStartupBanner,
};
