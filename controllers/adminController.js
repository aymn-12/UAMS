const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DoctorProfile = require('../models/DoctorProfile');
const DigitalId = require('../models/DigitalId');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const { logAction } = require('../services/auditService');
const { v4: uuidv4 } = require('uuid');

// Helper to escape regex special characters for safe search
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─────────────────────────────────────────────
// @desc    Create a university user (Admin only)
// @route   POST /api/admin/users
// @access  Private (Admin)
// ─────────────────────────────────────────────
const createUser = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    department,
    // Student specific
    studentId,
    stage,
    studyType,
    admissionYear,
    // Doctor specific
    employeeId,
    academicTitle,
    officeLocation
  } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check for duplicate email
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'A user with this university email already exists'
    });
  }

  // 2. Validate department if provided
  if (department) {
    const deptExists = await Department.findOne({ _id: department, isDeleted: false }).lean();
    if (!deptExists) {
      return res.status(404).json({
        success: false,
        message: 'Specified academic department not found or is inactive'
      });
    }
  }

  // 3. Check role-specific uniqueness
  if (role === ROLES.STUDENT && studentId) {
    const existingStudent = await StudentProfile.findOne({ studentId }).lean();
    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: `Student ID "${studentId}" is already assigned to another student`
      });
    }
  }

  if (role === ROLES.DOCTOR && employeeId) {
    const existingDoctor = await DoctorProfile.findOne({ employeeId }).lean();
    if (existingDoctor) {
      return res.status(409).json({
        success: false,
        message: `Employee ID "${employeeId}" is already assigned to another faculty member`
      });
    }
  }

  let createdUser = null;
  let createdProfile = null;
  let createdCard = null;

  try {
    // Step A: Create User
    createdUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      department: department || null,
      status: ACCOUNT_STATUS.ACTIVE
    });

    // Step B: Role-specific profile & credentials
    if (role === ROLES.STUDENT) {
      const generatedStudentId = studentId || `STD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      createdProfile = await StudentProfile.create({
        user: createdUser._id,
        studentId: generatedStudentId,
        department: department || null,
        stage: stage || 1,
        studyType: studyType || 'MORNING',
        admissionYear: admissionYear || new Date().getFullYear()
      });

      // Step C: Auto-generate Digital ID Card for student
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 4);

      createdCard = await DigitalId.create({
        student: createdUser._id,
        cardUid: `CARD_${uuidv4().substring(0, 8).toUpperCase()}`,
        barcodeNumber: `BC_${createdProfile.studentId}`,
        expiryDate: expiry,
        qrSecurityToken: uuidv4()
      });
    } else if (role === ROLES.DOCTOR) {
      const generatedEmpId = employeeId || `DOC_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      createdProfile = await DoctorProfile.create({
        user: createdUser._id,
        employeeId: generatedEmpId,
        department: department || null,
        academicTitle: academicTitle || 'LECTURER',
        officeLocation: officeLocation ? officeLocation.trim() : ''
      });
    }

    // Step D: Audit log creation
    logAction({
      user: req.user,
      action: 'CREATE_USER',
      category: 'USER_MGMT',
      targetEntity: 'User',
      targetId: createdUser._id,
      details: {
        email: createdUser.email,
        role: createdUser.role,
        hasProfile: !!createdProfile,
        hasCard: !!createdCard
      },
      req
    });

    res.status(201).json({
      success: true,
      message: 'User account created successfully',
      data: {
        _id: createdUser._id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        department: createdUser.department,
        status: createdUser.status,
        createdAt: createdUser.createdAt
      }
    });
  } catch (error) {
    // Rollback / clean up in case of failure during secondary creation
    if (createdCard) await DigitalId.findByIdAndDelete(createdCard._id);
    if (createdProfile && role === ROLES.STUDENT) await StudentProfile.findByIdAndDelete(createdProfile._id);
    if (createdProfile && role === ROLES.DOCTOR) await DoctorProfile.findByIdAndDelete(createdProfile._id);
    if (createdUser) await User.findByIdAndDelete(createdUser._id);

    throw error;
  }
};

// ─────────────────────────────────────────────
// @desc    Get all users with filter & search
// @route   GET /api/admin/users
// @access  Private (Admin)
// ─────────────────────────────────────────────
const getUsers = async (req, res) => {
  const { role, status, department, search, page = 1, limit = 20 } = req.query;

  const query = { isDeleted: false };

  if (role) query.role = role;
  if (status) query.status = status;
  if (department) query.department = department;

  if (search) {
    const escaped = escapeRegex(search.trim());
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } }
    ];
  }

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  // Execute data query and count concurrently
  const [users, total] = await Promise.all([
    User.find(query)
      .select('name email role status department createdAt lastLogin')
      .populate('department', 'name code college')
      .skip(skip)
      .limit(parsedLimit)
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parsedLimit);

  res.status(200).json({
    success: true,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
    hasPrevPage: parsedPage > 1,
    hasNextPage: parsedPage < totalPages,
    data: users
  });
};

// ─────────────────────────────────────────────
// @desc    Update user status (Active, Suspended, etc.)
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
// ─────────────────────────────────────────────
const updateUserStatus = async (req, res) => {
  const { status } = req.body;
  const targetUserId = req.params.id;

  // Prevent admin self-modification
  if (req.user._id.toString() === targetUserId) {
    return res.status(400).json({
      success: false,
      message: 'You cannot change your own account status'
    });
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const previousStatus = user.status;
  user.status = status;

  // If suspended or soft-deleted, immediately invalidate all active sessions
  if (
    status === ACCOUNT_STATUS.SUSPENDED ||
    status === ACCOUNT_STATUS.INACTIVE ||
    status === ACCOUNT_STATUS.SOFT_DELETED
  ) {
    user.activeSessions = [];
  }

  if (status === ACCOUNT_STATUS.SOFT_DELETED) {
    user.isDeleted = true;
  } else {
    user.isDeleted = false;
  }

  await user.save();

  logAction({
    user: req.user,
    action: 'UPDATE_USER_STATUS',
    category: 'USER_MGMT',
    targetEntity: 'User',
    targetId: user._id,
    details: {
      targetEmail: user.email,
      previousStatus,
      newStatus: status
    },
    req
  });

  res.status(200).json({
    success: true,
    message: `User status successfully updated to ${status}`,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isDeleted: user.isDeleted
    }
  });
};

// ─────────────────────────────────────────────
// @desc    Get audit logs with comprehensive filters
// @route   GET /api/admin/audit-logs
// @access  Private (Admin)
// ─────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  const {
    category,
    status,
    userId,
    startDate,
    endDate,
    page = 1,
    limit = 50
  } = req.query;

  const query = {};

  if (category) query.category = category;
  if (status) query.status = status;
  if (userId) query.user = userId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  // Execute concurrently
  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('user', 'name email role')
      .skip(skip)
      .limit(parsedLimit)
      .sort({ createdAt: -1 })
      .lean(),
    AuditLog.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parsedLimit);

  res.status(200).json({
    success: true,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
    hasPrevPage: parsedPage > 1,
    hasNextPage: parsedPage < totalPages,
    data: logs
  });
};

module.exports = {
  createUser,
  getUsers,
  updateUserStatus,
  getAuditLogs
};
