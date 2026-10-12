const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. Strict Whitelist of Safe Academic Extensions
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.pptx',
  '.ppt',
  '.xlsx',
  '.xls',
  '.txt',
  '.zip',
  '.rar',
  '.jpg',
  '.jpeg',
  '.png'
]);

// 2. Dangerous Executable & Script Extensions (Disallowed anywhere in filename)
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'php3', 'php4', 'php5', 'phps',
  'jsp', 'asp', 'aspx', 'pl', 'py', 'js', 'vbs', 'scr', 'jar', 'msi', 'com',
  'dll', 'cpl', 'wsf', 'hta', 'ps1', 'cgi', 'html', 'htm', 'xhtml', 'svg'
]);

// 3. Allowed MIME Types
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

// Storage configuration with cryptographically secure random names
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = `secure_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, randomName);
  }
});

const fileFilter = (req, file, cb) => {
  const originalName = file.originalname || '';

  // Security Check 1: Null byte or Path Traversal attempts
  if (originalName.includes('\0') || originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
    return cb(new Error('محاولة رفع غير مصرح بها (Path Traversal Detected).'), false);
  }

  // Security Check 2: Double extension attacks (e.g. exploit.php.pdf)
  const parts = originalName.toLowerCase().split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length; i++) {
      if (DANGEROUS_EXTENSIONS.has(parts[i])) {
        return cb(new Error('الملف يحتوي على امتداد تنفيذي خطير محظور.'), false);
      }
    }
  }

  // Security Check 3: Final extension whitelist
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error('نوع الملف غير مدعوم. المسموح: PDF, Word, PowerPoint, Excel, الصور, ZIP, RAR'), false);
  }

  // Security Check 4: MIME Type whitelist
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('صيغة الملف غير متوافقة مع معايير الأمان.'), false);
  }

  cb(null, true);
};

// 15 MB file size limit with max 5 files
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 Megabytes
    files: 5
  }
});

module.exports = upload;
