const DigitalId = require('../models/DigitalId');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const { generateQRCodeDataURL } = require('../services/qrService');
const { logAction } = require('../services/auditService');

// @desc    Get student's own digital university card
// @route   GET /api/digital-id/my-card
// @access  Private (Student)
const getMyCard = async (req, res) => {
  const [digitalId, profile] = await Promise.all([
    DigitalId.findOne({ student: req.user._id, isActive: true }).lean(),
    StudentProfile.findOne({ user: req.user._id })
      .populate('department', 'name code college')
      .lean()
  ]);

  if (!digitalId) {
    return res.status(404).json({ success: false, message: 'Digital ID has not been issued for this student' });
  }

  // Construct secure verification URL with current qrSecurityToken
  const verificationUrl = `${req.protocol}://${req.get('host')}/api/digital-id/verify/${digitalId.cardUid}?token=${digitalId.qrSecurityToken}`;
  const qrImage = await generateQRCodeDataURL(verificationUrl);

  res.status(200).json({
    success: true,
    data: {
      studentName: req.user.name,
      studentEmail: req.user.email,
      avatar: req.user.avatar,
      studentId: profile ? profile.studentId : null,
      college: profile && profile.department ? profile.department.college : null,
      department: profile && profile.department ? profile.department.name : null,
      stage: profile ? profile.stage : null,
      studyType: profile ? profile.studyType : null,
      admissionYear: profile ? profile.admissionYear : null,
      cardUid: digitalId.cardUid,
      barcodeNumber: digitalId.barcodeNumber,
      issueDate: digitalId.issueDate,
      expiryDate: digitalId.expiryDate,
      tokenRotatedAt: digitalId.tokenRotatedAt,
      qrImage
    }
  });
};

// @desc    Rotate / Renew Student Digital ID QR Security Token
// @route   POST /api/digital-id/rotate-token
// @access  Private (Student)
const rotateMyCardToken = async (req, res) => {
  const digitalId = await DigitalId.findOne({ student: req.user._id, isActive: true }).select('+revokedTokens');

  if (!digitalId) {
    return res.status(404).json({ success: false, message: 'Active digital card not found' });
  }

  // Rotate security token and save audit trail in model
  await digitalId.rotateToken();

  const verificationUrl = `${req.protocol}://${req.get('host')}/api/digital-id/verify/${digitalId.cardUid}?token=${digitalId.qrSecurityToken}`;
  const qrImage = await generateQRCodeDataURL(verificationUrl);

  logAction({
    user: req.user,
    action: 'ROTATE_DIGITAL_ID_TOKEN',
    category: 'SECURITY',
    targetEntity: 'DigitalId',
    targetId: digitalId._id,
    req
  });

  res.status(200).json({
    success: true,
    message: 'Digital ID security token regenerated successfully',
    data: {
      cardUid: digitalId.cardUid,
      tokenRotatedAt: digitalId.tokenRotatedAt,
      qrImage
    }
  });
};

// @desc    Public verification of university ID (minimal safe data)
// @route   GET /api/digital-id/verify/:cardUid
// @access  Public (Rate Limited)
const verifyCard = async (req, res) => {
  const { cardUid } = req.params;
  const { token } = req.query;

  const digitalId = await DigitalId.findOne({ cardUid, isActive: true })
    .populate('student', 'name avatar status isDeleted');

  if (!digitalId || !digitalId.student || digitalId.student.isDeleted) {
    return res.status(404).json({
      success: false,
      isValid: false,
      message: 'Invalid, inactive, or cancelled university card'
    });
  }

  const isExpired = new Date() > digitalId.expiryDate;
  if (isExpired) {
    return res.status(400).json({
      success: false,
      isValid: false,
      message: 'University ID has expired'
    });
  }

  // Token authenticity check if token is supplied
  let isTokenAuthentic = true;
  if (token && typeof digitalId.isTokenValid === 'function') {
    isTokenAuthentic = digitalId.isTokenValid(token);
  }

  // Increment scan count for anomaly detection
  if (typeof digitalId.recordScan === 'function') {
    await digitalId.recordScan();
  }

  const profile = await StudentProfile.findOne({ user: digitalId.student._id })
    .populate('department', 'name college')
    .lean();

  // Return minimal safe data to prevent identity theft
  res.status(200).json({
    success: true,
    isValid: true,
    isTokenAuthentic,
    verifiedAt: new Date().toISOString(),
    data: {
      name: digitalId.student.name,
      avatar: digitalId.student.avatar,
      studentId: profile ? profile.studentId : 'N/A',
      college: profile && profile.department ? profile.department.college : 'N/A',
      department: profile && profile.department ? profile.department.name : 'N/A',
      status: digitalId.student.status,
      cardUid: digitalId.cardUid,
      barcodeNumber: digitalId.barcodeNumber,
      expiryDate: digitalId.expiryDate
    }
  });
};

module.exports = {
  getMyCard,
  rotateMyCardToken,
  verifyCard
};
