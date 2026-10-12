const mongoose = require('mongoose');
const { ANSI } = require('../utils/devLogger');

// ─────────────────────────────────────────────
// MongoDB Connection Options
// ─────────────────────────────────────────────
const MONGO_OPTIONS = {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 50,                  // Max concurrent connections in pool
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 10,                  // Keep at least 10 connections warm
  serverSelectionTimeoutMS: Number(process.env.MONGO_TIMEOUT_MS) || 5000,   // Fail fast if server unreachable
  socketTimeoutMS: 45000,           // Close idle sockets after 45s
  heartbeatFrequencyMS: 10000,      // Check server health every 10s
  family: 4,                        // Force IPv4 to prevent IPv6 loopback issues
};

// ─────────────────────────────────────────────
// Connection Event Listeners
// ─────────────────────────────────────────────
mongoose.connection.on('connected', () => {
  // Silent or minimal during initial connection since banner handles it
});

mongoose.connection.on('disconnected', () => {
  console.warn(`${ANSI.yellow}[DATABASE WARNING] MongoDB disconnected. Attempting automatic reconnection...${ANSI.reset}`);
});

mongoose.connection.on('reconnected', () => {
  console.log(`${ANSI.green}[DATABASE SUCCESS] MongoDB reconnected successfully.${ANSI.reset}`);
});

mongoose.connection.on('error', (err) => {
  console.error(`${ANSI.brightRed}[DATABASE ERROR] MongoDB connection failure: ${err.message}${ANSI.reset}`);
});

// ─────────────────────────────────────────────
// Connect Function
// ─────────────────────────────────────────────
const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/uams_db';

  try {
    await mongoose.connect(uri, MONGO_OPTIONS);
  } catch (error) {
    console.error(`${ANSI.bgRed}${ANSI.brightWhite}[DATABASE FATAL] Initial MongoDB connection failed: ${error.message}${ANSI.reset}`);
    process.exit(1);
  }
};

module.exports = connectDB;
