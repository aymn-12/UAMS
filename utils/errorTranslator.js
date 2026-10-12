/**
 * Technical Error Decoder & Source Pinpointer for UAMS
 * 
 * Translates opaque/raw HTML 500 errors and unhandled exceptions into:
 * 1. A clean, normalized technical error (Code, Type, Clean Message).
 * 2. The exact root-cause SOURCE: File path, line number, column, function, and architectural layer.
 * Strictly NO EMOJIS — Pure high-precision developer diagnostics.
 */

const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Check if a string contains HTML markup
 */
const isHtml = (str) => {
  if (typeof str !== 'string') return false;
  const s = str.trim().toLowerCase();
  return (
    s.startsWith('<!doctype html') ||
    s.startsWith('<html') ||
    s.includes('<pre>') ||
    s.includes('<h1>') ||
    s.includes('<title>') ||
    /<[a-z][\s\S]*>/i.test(str)
  );
};

/**
 * Decompile raw HTML error content into clean technical strings
 *
 * @param {string} htmlContent
 * @returns {Object} { title, heading, details, embeddedStack, cleanMessage }
 */
const decompileHtmlError = (htmlContent) => {
  if (!isHtml(htmlContent)) {
    return {
      title: '',
      heading: '',
      details: String(htmlContent || ''),
      embeddedStack: '',
      cleanMessage: String(htmlContent || ''),
    };
  }

  const raw = String(htmlContent);

  // 1. Extract <title>
  const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // 2. Extract Headings (<h1> - <h3>)
  const headingMatch = raw.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
  const heading = headingMatch ? headingMatch[1].trim() : '';

  // 3. Extract <pre> or <code> block (often contains stack trace or crash detail)
  const preMatch = raw.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  let preContent = '';
  let embeddedStack = '';

  if (preMatch) {
    preContent = preMatch[1]
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/<[^>]+>/g, '')
      .trim();

    // Check if pre contains stack trace lines
    if (preContent.includes('    at ') || preContent.includes('\nat ')) {
      embeddedStack = preContent;
    }
  }

  // 4. Extract first paragraph (<p>) if no pre
  let pContent = '';
  const pMatch = raw.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pMatch) {
    pContent = pMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  const detail = preContent || pContent;

  // Build clean message without any HTML tags
  const parts = [];
  if (title) parts.push(title);
  if (heading && heading !== title) parts.push(heading);
  if (detail && detail !== heading) {
    // If detail has stack, take only the first error line
    const firstLine = detail.split('\n')[0].trim();
    parts.push(firstLine);
  }

  const cleanMessage = parts.length > 0 ? parts.join(' - ') : 'Raw HTML 500 Server Error Page';

  return {
    title,
    heading,
    details: detail,
    embeddedStack,
    cleanMessage,
  };
};

/**
 * Parse standard V8 / Node.js stack trace lines into structured frames
 *
 * @param {string} stackStr
 * @returns {Array<Object>} Array of stack frame objects
 */
const parseStackTrace = (stackStr) => {
  if (!stackStr || typeof stackStr !== 'string') return [];

  const lines = stackStr.split('\n');
  const frames = [];

  // Match: "at functionName (filePath:line:col)" OR "at filePath:line:col"
  const frameRegex = /^\s*at (?:([^\s(]+)\s+\((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))/;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(frameRegex);
    if (!match) continue;

    const fnName = match[1] || '<anonymous>';
    const rawPath = match[2] || match[5];
    const lineNum = parseInt(match[3] || match[6], 10);
    const colNum = parseInt(match[4] || match[7], 10);

    if (!rawPath) continue;

    const normalizedPath = rawPath.replace(/\\/g, '/');
    const projectRootNormalized = PROJECT_ROOT.replace(/\\/g, '/');

    const isProjectCode =
      normalizedPath.startsWith(projectRootNormalized) &&
      !normalizedPath.includes('/node_modules/');

    let relativePath = normalizedPath;
    if (normalizedPath.startsWith(projectRootNormalized)) {
      relativePath = normalizedPath.substring(projectRootNormalized.length + 1);
    }

    frames.push({
      functionName: fnName,
      fullPath: rawPath,
      relativePath,
      fileName: path.basename(rawPath),
      line: lineNum,
      column: colNum,
      isProjectCode,
      raw: trimmed,
    });
  }

  return frames;
};

/**
 * Detect the architectural layer from a relative file path
 */
const detectLayer = (relPath) => {
  if (!relPath) return 'UNKNOWN_LAYER';
  const p = relPath.toLowerCase();

  if (p.startsWith('controllers/'))   return 'APPLICATION_CONTROLLER';
  if (p.startsWith('services/'))      return 'APPLICATION_SERVICE';
  if (p.startsWith('middlewares/'))   return 'APPLICATION_MIDDLEWARE';
  if (p.startsWith('models/'))        return 'APPLICATION_MODEL';
  if (p.startsWith('routes/'))        return 'APPLICATION_ROUTE';
  if (p.startsWith('config/'))        return 'APPLICATION_CONFIG';
  if (p.startsWith('utils/'))         return 'APPLICATION_UTILITY';
  if (p.startsWith('scripts/'))       return 'APPLICATION_SCRIPT';

  if (p.includes('node_modules/mongoose')) return 'DATABASE_DRIVER_MONGOOSE';
  if (p.includes('node_modules/express'))  return 'HTTP_FRAMEWORK_EXPRESS';
  if (p.includes('node_modules/'))        return 'THIRD_PARTY_PACKAGE';
  if (p.startsWith('node:'))              return 'NODEJS_CORE_RUNTIME';

  return 'EXTERNAL_OR_CUSTOM_MODULE';
};

/**
 * Locate the primary root cause source frame of an error
 */
const locateErrorSource = (err, decompiled = null) => {
  const stackToUse =
    (decompiled && decompiled.embeddedStack) ||
    err.stack ||
    '';

  const frames = parseStackTrace(stackToUse);

  // 1. First priority: First project file in the stack trace
  const projectFrame = frames.find((f) => f.isProjectCode);
  if (projectFrame) {
    const layer = detectLayer(projectFrame.relativePath);
    return {
      type: 'PROJECT_APPLICATION_CODE',
      layer,
      file: projectFrame.relativePath,
      fullPath: projectFrame.fullPath,
      line: projectFrame.line,
      column: projectFrame.column,
      functionName: projectFrame.functionName,
      location: `${projectFrame.relativePath}:${projectFrame.line}:${projectFrame.column}`,
      signature: `${projectFrame.relativePath}:${projectFrame.line} in ${projectFrame.functionName}()`,
      frames,
    };
  }

  // 2. Second priority: If error is an HTML 500 error from upstream service or network proxy
  if (decompiled && isHtml(err.message)) {
    return {
      type: 'UPSTREAM_NETWORK_SERVICE',
      layer: 'GATEWAY_OR_EXTERNAL_API',
      file: 'External Upstream Service (text/html)',
      fullPath: 'External Upstream Gateway / Reverse Proxy',
      line: 0,
      column: 0,
      functionName: '<remote-gateway>',
      location: 'Upstream Service (HTTP 500 Returned)',
      signature: 'External Network Endpoint returned HTML 500 response',
      frames,
    };
  }

  // 3. Third priority: First non-internal frame
  const firstFrame = frames[0];
  if (firstFrame) {
    const layer = detectLayer(firstFrame.relativePath);
    return {
      type: 'EXTERNAL_DEPENDENCY',
      layer,
      file: firstFrame.relativePath,
      fullPath: firstFrame.fullPath,
      line: firstFrame.line,
      column: firstFrame.column,
      functionName: firstFrame.functionName,
      location: `${firstFrame.relativePath}:${firstFrame.line}:${firstFrame.column}`,
      signature: `${firstFrame.relativePath}:${firstFrame.line} in ${firstFrame.functionName}()`,
      frames,
    };
  }

  // Fallback if no stack is available
  return {
    type: 'RUNTIME_EXECUTION_CONTEXT',
    layer: 'UNKNOWN_SOURCE',
    file: 'Unknown source file',
    fullPath: 'Unknown',
    line: 0,
    column: 0,
    functionName: '<unknown>',
    location: 'Unknown',
    signature: 'No stack trace available',
    frames: [],
  };
};

/**
 * Classify technical error code
 */
const classifyTechnicalCode = (err, cleanMessage) => {
  const msg = String(cleanMessage || err.message || '').toLowerCase();
  const name = String(err.name || '').toLowerCase();

  if (isHtml(err.message))                                return 'ERR_UPSTREAM_HTML_500_PAGE';
  if (msg.includes('cannot read properties of undefined') || msg.includes('cannot read property')) return 'ERR_NULL_PROPERTY_ACCESS';
  if (name === 'syntaxerror' && msg.includes('json'))     return 'ERR_MALFORMED_JSON_PAYLOAD';
  if (name === 'casterror' || msg.includes('cast to objectid')) return 'ERR_INVALID_OBJECT_ID_CAST';
  if (msg.includes('econnrefused'))                        return 'ERR_DATABASE_CONNECTION_REFUSED';
  if (err.code === 11000 || msg.includes('e11000'))       return 'ERR_DUPLICATE_KEY_COLLISION';
  if (msg.includes('jwt') || msg.includes('token'))       return 'ERR_JWT_AUTHENTICATION_FAILURE';
  if (msg.includes('which has only a getter'))            return 'ERR_EXPRESS5_GETTER_MUTATION';
  if (msg.includes('headers after they are sent'))        return 'ERR_DUPLICATE_HEADER_DISPATCH';

  return `ERR_${(err.name || 'INTERNAL_SERVER_ERROR').toUpperCase()}`;
};

/**
 * Main Technical Error Decoder
 * Decodes any error (including raw HTML 500) into clean technical specifications and pinpointed source.
 *
 * @param {Error|Object|string} err
 * @param {Object} req
 * @returns {Object} Full technical breakdown
 */
const decodeTechnicalError = (err, req) => {
  const rawMessage = typeof err === 'string' ? err : err.message || '';
  const decompiled = isHtml(rawMessage) ? decompileHtmlError(rawMessage) : null;

  const cleanMessage = decompiled ? decompiled.cleanMessage : rawMessage;
  const source = locateErrorSource(err, decompiled);
  const technicalCode = classifyTechnicalCode(err, cleanMessage);

  return {
    isHtmlDecoded: Boolean(decompiled),
    technicalCode,
    errorType: err.name || (decompiled ? 'UpstreamHtmlError' : 'Error'),
    cleanMessage,
    source: {
      sourceType: source.type,
      layer: source.layer,
      file: source.file,
      line: source.line,
      column: source.column,
      functionName: source.functionName,
      location: source.location,
      signature: source.signature,
    },
    appFrames: source.frames.filter((f) => f.isProjectCode),
    allFrames: source.frames,
  };
};

module.exports = {
  isHtml,
  decompileHtmlError,
  parseStackTrace,
  detectLayer,
  locateErrorSource,
  classifyTechnicalCode,
  decodeTechnicalError,
};
