require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
const { apiLimiter } = require('./middlewares/rateLimitMiddleware');
const { verifyCsrf } = require('./middlewares/csrfMiddleware');
const devHttpLogger = require('./middlewares/devHttpLogger');
const { printStartupBanner, ANSI } = require('./utils/devLogger');

const app = express();

// Connect Database
connectDB();

// ─────────────────────────────────────────────
// Security & Performance Middleware (ordered)
// ─────────────────────────────────────────────

// 1. Compress all responses (gzip) — before routes
app.use(compression());

// 2. Set secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

// 3. CORS — allow configured origins only, with credentials for cookies
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin "${origin}" not allowed`));
    }
  },
  credentials: true,
}));

// 4. Body parsers & Cookie Parser
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// 5. CSRF Protection Middleware
app.use(verifyCsrf);

// 6. NoSQL injection sanitizer (Express 5 compatible in-place) — strips $ and . from user input
app.use((req, res, next) => {
  if (req.body)   mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  if (req.params) mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  if (req.query)  mongoSanitize.sanitize(req.query, { replaceWith: '_' });
  next();
});

// 7. HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'department', 'stage']
}));

// 8. Global API rate limiter
app.use('/api', apiLimiter);

// 9. Real-time Developer HTTP Logger (Zero emojis, high contrast, clean feedback)
if (process.env.NODE_ENV === 'development') {
  app.use(devHttpLogger);
}

// 10. Serve uploaded files (with safe directory options)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'ignore',
  index: false,
  maxAge: '1d'
}));

// ─────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/admin',         require('./routes/adminRoutes'));
app.use('/api/academic',      require('./routes/academicRoutes'));
app.use('/api/student',       require('./routes/studentRoutes'));
app.use('/api/doctor',        require('./routes/doctorRoutes'));
app.use('/api/files',         require('./routes/fileRoutes'));
app.use('/api/attendance',    require('./routes/attendanceRoutes'));
app.use('/api/digital-id',    require('./routes/digitalIdRoutes'));
app.use('/api/assignments',   require('./routes/assignmentRoutes'));
app.use('/api/exams',         require('./routes/examRoutes'));
app.use('/api/materials',     require('./routes/materialRoutes'));
app.use('/api/questions',     require('./routes/questionRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/dashboards',    require('./routes/dashboardRoutes'));
app.use('/api/dashboard',     require('./routes/dashboardRoutes'));
app.use('/api/reports',       require('./routes/reportRoutes'));

// ─────────────────────────────────────────────
// Health Check & Dev Diagnostics
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'UAMS API is running smoothly',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});
// ─────────────────────────────────────────────
// Error Handling (must be LAST)
// ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────
// Server Bootstrap
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  const triggerBanner = () => {
    printStartupBanner({
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      connectedHost: mongoose.connection.host || 'localhost',
      dbName: mongoose.connection.name || 'uams_db',
    });
  };

  if (mongoose.connection.readyState === 1) {
    triggerBanner();
  } else {
    mongoose.connection.once('connected', triggerBanner);
  }
});

// Graceful shutdown — close DB connections on SIGTERM/SIGINT
const gracefulShutdown = (signal) => {
  console.log(`\n${ANSI.yellow}[${signal}] Graceful shutdown initiated...${ANSI.reset}`);
  server.close(async () => {
    await mongoose.connection.close();
    console.log(`${ANSI.green}[SYSTEM] MongoDB connection closed. Server exited safely.${ANSI.reset}`);
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections & exceptions globally
process.on('unhandledRejection', (reason) => {
  console.error(`\n${ANSI.bgRed}${ANSI.brightWhite}[CRITICAL UNHANDLED REJECTION]${ANSI.reset}`, reason);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error(`\n${ANSI.bgRed}${ANSI.brightWhite}[CRITICAL UNCAUGHT EXCEPTION]${ANSI.reset}`, err);
  server.close(() => process.exit(1));
});
