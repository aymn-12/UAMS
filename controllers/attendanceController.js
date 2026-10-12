const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Section = require('../models/Section');
const StudentProfile = require('../models/StudentProfile');
const { ATTENDANCE_STATUS, ROLES } = require('../config/constants');
const {
  generateQRCodeDataURL,
  generateDynamicSessionToken,
  verifyDynamicSessionToken
} = require('../services/qrService');
const { logAction } = require('../services/auditService');
const { v4: uuidv4 } = require('uuid');

// Utility function: Haversine distance in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────
// 1. Session Creation (Doctor / Admin)
// ─────────────────────────────────────────────
const createSession = async (req, res) => {
  const { sectionId, sessionTitle, durationMinutes = 180, geoFence } = req.body;

  const section = await Section.findById(sectionId);
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({ success: false, message: 'Cannot start attendance in a closed section' });
  }

  // Doctor ownership verification
  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  // Gracefully close any previously open sessions for this section
  await AttendanceSession.updateMany(
    { section: sectionId, status: 'OPEN' },
    { status: 'CLOSED' }
  );

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const tempToken = uuidv4();

  const session = await AttendanceSession.create({
    section: sectionId,
    doctor: req.user._id,
    sessionTitle: sessionTitle || `Lecture ${new Date().toLocaleDateString('ar-IQ')}`,
    dynamicToken: tempToken,
    expiresAt,
    status: 'OPEN',
    geoFence,
    checkInCount: 0
  });

  // Generate signed JWT QR payload
  const dynamicJwt = generateDynamicSessionToken(session._id, sectionId, durationMinutes);
  session.dynamicToken = dynamicJwt;
  await session.save();

  const qrPayload = JSON.stringify({
    sessionId: session._id,
    token: dynamicJwt
  });

  const qrImage = await generateQRCodeDataURL(qrPayload);

  logAction({
    user: req.user,
    action: 'CREATE_ATTENDANCE_SESSION',
    category: 'ATTENDANCE',
    targetEntity: 'AttendanceSession',
    targetId: session._id,
    details: { sectionId, durationMinutes },
    req
  });

  res.status(201).json({
    success: true,
    message: 'Attendance session opened successfully',
    data: {
      _id: session._id,
      session: {
        _id: session._id,
        sessionTitle: session.sessionTitle,
        startTime: session.startTime,
        expiresAt: session.expiresAt,
        status: session.status,
        checkInCount: 0
      },
      qrImage,
      token: dynamicJwt
    }
  });
};

// ─────────────────────────────────────────────
// 2. Close Session Manually (Doctor / Admin)
// ─────────────────────────────────────────────
const closeSession = async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  session.status = 'CLOSED';
  await session.save();

  logAction({
    user: req.user,
    action: 'CLOSE_ATTENDANCE_SESSION',
    category: 'ATTENDANCE',
    targetEntity: 'AttendanceSession',
    targetId: session._id,
    req
  });

  res.status(200).json({
    success: true,
    message: 'Attendance session has been closed successfully',
    data: {
      _id: session._id,
      status: session.status,
      checkInCount: session.checkInCount
    }
  });
};

// ─────────────────────────────────────────────
// 2.5 Get Active/Open Session for Section or Doctor
// ─────────────────────────────────────────────
const getActiveSessionForDoctor = async (req, res) => {
  const session = await AttendanceSession.findOne({ doctor: req.user._id, status: 'OPEN' }).lean();
  if (!session) {
    return res.status(200).json({ success: true, data: null });
  }

  const qrPayload = JSON.stringify({
    sessionId: session._id,
    token: session.dynamicToken
  });

  const qrImage = await generateQRCodeDataURL(qrPayload);

  res.status(200).json({
    success: true,
    data: {
      _id: session._id,
      section: session.section,
      sessionTitle: session.sessionTitle,
      startTime: session.startTime,
      expiresAt: session.expiresAt,
      status: session.status,
      checkInCount: session.checkInCount || 0,
      qrImage,
      token: session.dynamicToken
    }
  });
};

const getActiveSessionForSection = async (req, res) => {
  const { id } = req.params;
  const session = await AttendanceSession.findOne({ section: id, status: 'OPEN' }).lean();
  if (!session) {
    return res.status(200).json({ success: true, data: null });
  }

  const qrPayload = JSON.stringify({
    sessionId: session._id,
    token: session.dynamicToken
  });

  const qrImage = await generateQRCodeDataURL(qrPayload);

  res.status(200).json({
    success: true,
    data: {
      _id: session._id,
      sessionTitle: session.sessionTitle,
      startTime: session.startTime,
      expiresAt: session.expiresAt,
      status: session.status,
      checkInCount: session.checkInCount || 0,
      qrImage,
      token: session.dynamicToken
    }
  });
};

// ─────────────────────────────────────────────
// 3. Student Check-in (Anti-Proxy & Geofence)
// ─────────────────────────────────────────────
const studentCheckIn = async (req, res) => {
  const { token, deviceId, isBiometricVerified = false, coordinates } = req.body;
  const clientIp = req.ip || req.connection?.remoteAddress || '';

  const decoded = verifyDynamicSessionToken(token);
  if (!decoded) {
    return res.status(400).json({ success: false, message: 'QR Code is expired or invalid' });
  }

  const session = await AttendanceSession.findById(decoded.sessionId)
    .select('section status expiresAt geoFence checkInCount')
    .lean();

  if (!session) {
    return res.status(404).json({ success: false, message: 'Attendance session not found' });
  }

  if (session.status !== 'OPEN') {
    return res.status(400).json({ success: false, message: 'Attendance session has been closed by the professor' });
  }

  if (session.expiresAt && new Date() > session.expiresAt) {
    return res.status(400).json({ success: false, message: 'Attendance session time has expired' });
  }

  // Parallelize enrollment verification, duplicate check, and device anti-proxy check
  const [section, alreadyChecked, deviceUsedByOther] = await Promise.all([
    Section.findById(session.section).select('students isClosed').lean(),
    AttendanceRecord.findOne({ session: session._id, student: req.user._id }).select('_id').lean(),
    deviceId
      ? AttendanceRecord.findOne({
          session: session._id,
          deviceId: deviceId.trim(),
          student: { $ne: req.user._id }
        }).select('_id').lean()
      : Promise.resolve(null)
  ]);

  if (!section) {
    return res.status(404).json({ success: false, message: 'Associated section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({ success: false, message: 'Section is marked as closed' });
  }

  const isEnrolled = section.students.some((s) => s.toString() === req.user._id.toString());
  if (!isEnrolled) {
    return res.status(403).json({ success: false, message: 'You are not enrolled in this section' });
  }

  if (alreadyChecked) {
    return res.status(400).json({ success: false, message: 'Attendance already recorded for this lecture' });
  }

  // Anti-proxy check: Block if this device was already used by another student in this session
  if (deviceUsedByOther) {
    logAction({
      user: req.user,
      action: 'PROXY_ATTENDANCE_ATTEMPT_BLOCKED',
      category: 'SECURITY',
      targetEntity: 'AttendanceSession',
      targetId: session._id,
      details: { deviceId, clientIp },
      req,
      status: 'FAILURE'
    });

    return res.status(403).json({
      success: false,
      message: 'Security Alert: This device was already used to register attendance for another student in this lecture.'
    });
  }

  // Geofence verification
  let geoVerified = false;
  let distanceFromRoom = null;

  if (session.geoFence && session.geoFence.latitude && coordinates) {
    const { lat, lng } = coordinates;
    distanceFromRoom = calculateDistance(session.geoFence.latitude, session.geoFence.longitude, lat, lng);
    const maxRadius = session.geoFence.radiusMeters || Number(process.env.DEFAULT_GEOFENCE_RADIUS_METERS) || 150;

    if (distanceFromRoom > maxRadius) {
      return res.status(403).json({
        success: false,
        message: `You are outside the required lecture boundary (${Math.round(distanceFromRoom)}m away, allowed: ${maxRadius}m)`
      });
    }
    geoVerified = true;
  }

  // Create attendance record
  const record = await AttendanceRecord.create({
    session: session._id,
    student: req.user._id,
    section: section._id,
    status: ATTENDANCE_STATUS.PRESENT,
    markedMethod: isBiometricVerified ? 'BIOMETRIC_QR' : 'QR',
    deviceId: deviceId.trim(),
    clientIp,
    geoVerified,
    distanceFromRoom: distanceFromRoom ? Math.round(distanceFromRoom) : null
  });

  // Increment session counter atomically
  await AttendanceSession.findByIdAndUpdate(session._id, { $inc: { checkInCount: 1 } });

  logAction({
    user: req.user,
    action: 'STUDENT_CHECK_IN',
    category: 'ATTENDANCE',
    targetEntity: 'AttendanceRecord',
    targetId: record._id,
    details: { method: record.markedMethod, geoVerified },
    req
  });

  res.status(201).json({
    success: true,
    message: 'Attendance recorded successfully',
    data: {
      _id: record._id,
      markedAt: record.markedAt,
      status: record.status,
      markedMethod: record.markedMethod,
      geoVerified: record.geoVerified
    }
  });
};

// ─────────────────────────────────────────────
// 4. Live Session Monitor (Doctor / Admin)
// ─────────────────────────────────────────────
const getLiveSession = async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id)
    .populate('section', 'sectionNumber course students')
    .lean();

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const [records, section] = await Promise.all([
    AttendanceRecord.find({ session: session._id })
      .populate('student', 'name email avatar')
      .sort({ markedAt: -1 })
      .lean(),
    Section.findById(session.section)
      .populate('students', 'name email avatar')
      .lean()
  ]);

  const presentStudentIds = new Set(records.map((r) => r.student?._id.toString()));

  const absentStudents = (section.students || []).filter(
    (student) => !presentStudentIds.has(student._id.toString())
  );

  res.status(200).json({
    success: true,
    session: {
      _id: session._id,
      sessionTitle: session.sessionTitle,
      status: session.status,
      startTime: session.startTime,
      expiresAt: session.expiresAt,
      checkInCount: records.length,
      totalEnrolled: (section.students || []).length
    },
    attendeesCount: records.length,
    absenteesCount: absentStudents.length,
    attendees: records,
    absentees: absentStudents
  });
};

// ─────────────────────────────────────────────
// 5. Manual Attendance Override with Audit History
// ─────────────────────────────────────────────
const manualUpdateRecord = async (req, res) => {
  const { status, modificationReason } = req.body;

  const record = await AttendanceRecord.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Attendance record not found' });
  }

  const section = await Section.findById(record.section).select('doctor isClosed').lean();
  if (!section) {
    return res.status(404).json({ success: false, message: 'Associated section not found' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized to modify records for this section' });
  }

  const oldStatus = record.status;
  record.status = status;
  record.modifiedBy = req.user._id;
  record.modificationReason = modificationReason.trim();
  record.markedMethod = 'MANUAL_DOCTOR';

  // Push to tamper-proof modification history array
  record.modificationHistory.push({
    modifiedBy: req.user._id,
    previousStatus: oldStatus,
    newStatus: status,
    reason: modificationReason.trim(),
    modifiedAt: new Date()
  });

  await record.save();

  logAction({
    user: req.user,
    action: 'MANUAL_ATTENDANCE_OVERRIDE',
    category: 'ATTENDANCE',
    targetEntity: 'AttendanceRecord',
    targetId: record._id,
    details: { oldStatus, newStatus: status, reason: modificationReason },
    req
  });

  res.status(200).json({
    success: true,
    message: `Attendance status updated from ${oldStatus} to ${status}`,
    data: record
  });
};

// ─────────────────────────────────────────────
// 6. Student Attendance Analytics
// ─────────────────────────────────────────────
const getStudentAttendanceStats = async (req, res) => {
  const sectionId = req.params.id;
  const studentId = req.user._id;

  const [section, totalSessions, records] = await Promise.all([
    Section.findById(sectionId).select('maxAbsenceHours course sectionNumber').populate('course', 'name code').lean(),
    AttendanceSession.countDocuments({ section: sectionId }),
    AttendanceRecord.find({ section: sectionId, student: studentId })
      .select('status markedAt markedMethod geoVerified')
      .sort({ markedAt: -1 })
      .lean()
  ]);

  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  const presentCount = records.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
  const lateCount = records.filter((r) => r.status === ATTENDANCE_STATUS.LATE).length;
  const excusedCount = records.filter((r) => r.status === ATTENDANCE_STATUS.EXCUSED).length;
  const absentCount = Math.max(0, totalSessions - (presentCount + excusedCount));

  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;
  const maxAbsences = section.maxAbsenceHours || 6;

  let warningLevel = 'SAFE';
  if (absentCount >= maxAbsences) {
    warningLevel = 'DISMISSAL_THRESHOLD_REACHED';
  } else if (absentCount >= Math.ceil(maxAbsences * 0.75)) {
    warningLevel = 'FINAL_WARNING';
  } else if (absentCount >= Math.ceil(maxAbsences * 0.5)) {
    warningLevel = 'FIRST_WARNING';
  } else if (absentCount >= Math.ceil(maxAbsences * 0.25)) {
    warningLevel = 'EARLY_WARNING';
  }

  res.status(200).json({
    success: true,
    stats: {
      section: {
        _id: section._id,
        sectionNumber: section.sectionNumber,
        course: section.course
      },
      totalSessions,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      attendanceRate: `${attendanceRate}%`,
      maxAllowedAbsences: maxAbsences,
      remainingAbsences: Math.max(0, maxAbsences - absentCount),
      warningLevel,
      records
    }
  });
};

// ─────────────────────────────────────────────
// 7. Doctor Section Attendance Overview (Full Roster Matrix)
// ─────────────────────────────────────────────
const getSectionAttendanceOverview = async (req, res) => {
  const sectionId = req.params.id;

  const section = await Section.findById(sectionId)
    .populate('students', 'name email avatar')
    .populate('course', 'name code')
    .lean();

  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const [totalSessions, allRecords, profiles] = await Promise.all([
    AttendanceSession.countDocuments({ section: sectionId }),
    AttendanceRecord.find({ section: sectionId }).select('student status markedAt').lean(),
    StudentProfile.find({ user: { $in: section.students.map((s) => s._id) } })
      .select('user studentId')
      .lean()
  ]);

  const profileMap = new Map();
  profiles.forEach((p) => profileMap.set(p.user.toString(), p.studentId));

  const maxAbsences = section.maxAbsenceHours || 6;

  // Group records by student
  const studentRecordsMap = new Map();
  allRecords.forEach((r) => {
    const sId = r.student.toString();
    if (!studentRecordsMap.has(sId)) {
      studentRecordsMap.set(sId, []);
    }
    studentRecordsMap.get(sId).push(r);
  });

  const rosterOverview = section.students.map((student) => {
    const studentIdStr = student._id.toString();
    const records = studentRecordsMap.get(studentIdStr) || [];
    const presentCount = records.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
    const excusedCount = records.filter((r) => r.status === ATTENDANCE_STATUS.EXCUSED).length;
    const absentCount = Math.max(0, totalSessions - (presentCount + excusedCount));
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    let warningLevel = 'SAFE';
    if (absentCount >= maxAbsences) {
      warningLevel = 'DISMISSAL_THRESHOLD_REACHED';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.75)) {
      warningLevel = 'FINAL_WARNING';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.5)) {
      warningLevel = 'FIRST_WARNING';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.25)) {
      warningLevel = 'EARLY_WARNING';
    }

    return {
      _id: student._id,
      name: student.name,
      email: student.email,
      studentId: profileMap.get(studentIdStr) || 'N/A',
      presentCount,
      absentCount,
      attendanceRate: `${attendanceRate}%`,
      warningLevel
    };
  });

  res.status(200).json({
    success: true,
    section: {
      _id: section._id,
      sectionNumber: section.sectionNumber,
      course: section.course,
      totalSessions,
      maxAllowedAbsences: maxAbsences,
      totalStudents: rosterOverview.length
    },
    data: rosterOverview
  });
};

// ─────────────────────────────────────────────
// 8. Overall Student Attendance Stats (Student)
// ─────────────────────────────────────────────
const getMyOverallAttendanceStats = async (req, res) => {
  const studentId = req.user._id;

  const sections = await Section.find({ students: studentId, isClosed: false })
    .select('course sectionNumber maxAbsenceHours')
    .populate('course', 'name code')
    .lean();

  const sectionIds = sections.map((s) => s._id);

  const [totalSessions, myRecords] = await Promise.all([
    AttendanceSession.countDocuments({ section: { $in: sectionIds } }),
    AttendanceRecord.find({ student: studentId, section: { $in: sectionIds } })
      .populate({
        path: 'session',
        select: 'sessionType createdAt',
        populate: { path: 'section', select: 'sectionNumber course', populate: { path: 'course', select: 'name code' } }
      })
      .sort({ markedAt: -1 })
      .lean()
  ]);

  const presentCount = myRecords.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
  const lateCount = myRecords.filter((r) => r.status === ATTENDANCE_STATUS.LATE).length;
  const excusedCount = myRecords.filter((r) => r.status === ATTENDANCE_STATUS.EXCUSED).length;
  const absentCount = Math.max(0, totalSessions - (presentCount + excusedCount));

  const overallRate = totalSessions > 0 ? `${Math.round((presentCount / totalSessions) * 100)}%` : '100%';

  let warningLevel = 'SAFE';
  if (absentCount >= 6) {
    warningLevel = 'DISMISSAL_THRESHOLD_REACHED';
  } else if (absentCount >= 4) {
    warningLevel = 'FIRST_WARNING';
  }

  res.status(200).json({
    success: true,
    data: {
      overallRate,
      totalSessions,
      totalAttended: presentCount,
      lateCount,
      excusedCount,
      absentCount,
      warningLevel,
      records: myRecords
    }
  });
};

module.exports = {
  createSession,
  closeSession,
  getActiveSessionForDoctor,
  getActiveSessionForSection,
  studentCheckIn,
  getLiveSession,
  manualUpdateRecord,
  getStudentAttendanceStats,
  getSectionAttendanceOverview,
  getMyOverallAttendanceStats
};
