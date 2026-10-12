const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a short-lived signed JWT access token (15 minutes).
 *
 * @param {string|ObjectId} userId
 * @param {string}          role
 * @returns {string} signed JWT access token
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    {
      id:  userId,
      role,
      jti: uuidv4(), // Unique token ID for revocation tracking
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    {
      expiresIn:  process.env.JWT_ACCESS_EXPIRE || '15m',
      algorithm:  'HS256',
      issuer:     'uams-api',
      audience:   'uams-client',
    }
  );
};

/**
 * Generate a long-lived signed JWT refresh token (7 days).
 *
 * @param {string|ObjectId} userId
 * @param {string}          tokenFamily - UUID identifying the token family for rotation
 * @returns {Object} { token: string, tokenFamily: string, jti: string, expiresAt: Date }
 */
const generateRefreshToken = (userId, tokenFamily = uuidv4()) => {
  const secret = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh');
  const jti = uuidv4();
  const expireDays = 7;
  const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);

  const token = jwt.sign(
    {
      id:          userId,
      tokenFamily,
      jti,
      type:        'REFRESH_TOKEN',
      iat:         Math.floor(Date.now() / 1000)
    },
    secret,
    {
      expiresIn:  `${expireDays}d`,
      algorithm:  'HS256',
      issuer:     'uams-api',
      audience:   'uams-client',
    }
  );

  return { token, tokenFamily, jti, expiresAt };
};

// Backwards compatibility default
const generateToken = generateAccessToken;

module.exports = generateToken;
module.exports.generateAccessToken = generateAccessToken;
module.exports.generateRefreshToken = generateRefreshToken;
