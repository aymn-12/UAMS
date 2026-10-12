const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate QR Code base64 image data URL with high error correction
 * @param {string} text - Payload to encode
 * @returns {Promise<string>} Base64 image data URL
 */
const generateQRCodeDataURL = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (error) {
    console.error('[QR] Generation Error:', error.message);
    throw new Error('Failed to generate high-resolution QR Code');
  }
};

/**
 * Generate cryptographically signed dynamic session token
 * @param {string} sessionId
 * @param {string} sectionId
 * @param {number} expiresInMinutes - Default 180 mins (3 hours)
 * @returns {string} Signed JWT
 */
const generateDynamicSessionToken = (sessionId, sectionId, expiresInMinutes = 180) => {
  const secret = process.env.QR_TOKEN_SECRET || process.env.JWT_SECRET || 'uams_qr_secure_salt';

  return jwt.sign(
    {
      sessionId,
      sectionId,
      nonce: uuidv4(), // Anti-replay nonce
      type: 'ATTENDANCE_DYNAMIC_TOKEN'
    },
    secret,
    {
      expiresIn: `${Math.max(5, expiresInMinutes)}m`,
      algorithm: 'HS256'
    }
  );
};

/**
 * Verify and decode dynamic session token
 * @param {string} token
 * @returns {Object|null} Decoded payload or null
 */
const verifyDynamicSessionToken = (token) => {
  try {
    const secret = process.env.QR_TOKEN_SECRET || process.env.JWT_SECRET || 'uams_qr_secure_salt';
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateQRCodeDataURL,
  generateDynamicSessionToken,
  verifyDynamicSessionToken
};
