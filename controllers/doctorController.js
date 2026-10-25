const Section = require('../models/Section');
const ScheduleSlot = require('../models/ScheduleSlot');
const StudentProfile = require('../models/StudentProfile');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');

// @desc    Get all sections assigned to the logged-in doctor
// @route   GET /api/doctor/sections
// @access  Private (Doctor)
const getMySections = async (req, res) => {
  const sections = await Section.find({ doctor: req.user._id, isClosed: false })
    .select('sectionNumber course students semester academicYear maxAbsenceHours capacity isClosed')
    .populate('course', 'name code credits stage department')
    .lean();

  const sectionIds = sections.map((s) => s._id);

  // Fetch schedule slots for all doctor's sections
  const slots = await ScheduleSlot.find({ section: { $in: sectionIds } })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  const enrichedSections = sections.map((section) => {
    const sectionSlots = slots.filter((slot) => slot.section.toString() === section._id.toString());
    const studentCount = section.students ? section.students.length : 0;
    return {
      _id: section._id,
      sectionNumber: section.sectionNumber,
      course: section.course,
      semester: section.semester,
      academicYear: section.academicYear,
      maxAbsenceHours: section.maxAbsenceHours,
      capacity: section.capacity || 60,
      enrolledCount: studentCount,
      availableSeats: Math.max(0, (section.capacity || 60) - studentCount),
      isClosed: section.isClosed,
      schedule: sectionSlots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        building: s.building
      }))
    };
  });

  res.status(200).json({
    success: true,
    count: enrichedSections.length,
    data: enrichedSections
  });
};

// @desc    Get detailed student roster for a specific section
// @route   GET /api/doctor/sections/:id/students
// @access  Private (Doctor)
const getSectionRoster = async (req, res) => {
  const section = await Section.findOne({ _id: req.params.id, doctor: req.user._id })
    .select('students sectionNumber course capacity maxAbsenceHours')
    .populate('students', 'name email status lastLogin avatar')
    .populate('course', 'name code')
    .lean();

  if (!section) {
    return res.status(404).json({
      success: false,
      message: 'Section not found or you are not authorized to view its roster'
    });
  }

  const studentUserIds = section.students.map((s) => s._id);

  // Fetch academic profiles, total sessions, and records in parallel
  const [profiles, totalSessions, allRecords] = await Promise.all([
    StudentProfile.find({ user: { $in: studentUserIds } })
      .select('user studentId stage studyType admissionYear')
      .lean(),
    AttendanceSession.countDocuments({ section: req.params.id }),
    AttendanceRecord.find({ section: req.params.id }).select('student status').lean()
  ]);

  const profileMap = new Map();
  profiles.forEach((p) => {
    profileMap.set(p.user.toString(), p);
  });

  const maxAbsences = section.maxAbsenceHours || 6;

  const roster = section.students.map((student) => {
    const prof = profileMap.get(student._id.toString()) || {};
    const studentRecords = allRecords.filter((r) => r.student.toString() === student._id.toString());
    const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
    const absentCount = Math.max(0, totalSessions - presentCount);

    let warningLevel = 'SAFE'; // 'SAFE' | 'ALERT' | 'WARNING' | 'DEPRIVED'
    if (absentCount >= maxAbsences) {
      warningLevel = 'DEPRIVED';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.75)) {
      warningLevel = 'WARNING';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.5)) {
      warningLevel = 'ALERT';
    }

    return {
      _id: student._id,
      name: student.name,
      email: student.email,
      studentId: prof.studentId || 'N/A',
      stage: prof.stage || 1,
      studyType: prof.studyType || 'MORNING',
      admissionYear: prof.admissionYear || 'N/A',
      status: student.status,
      avatar: student.avatar,
      presentCount,
      absentCount,
      totalSessions,
      warningLevel,
      maxAbsences
    };
  });

  res.status(200).json({
    success: true,
    section: {
      _id: section._id,
      sectionNumber: section.sectionNumber,
      course: section.course,
      totalEnrolled: roster.length,
      capacity: section.capacity || 60,
      maxAbsenceHours: maxAbsences,
      totalSessions
    },
    data: roster
  });
};

// @desc    Get doctor's weekly teaching timetable
// @route   GET /api/doctor/schedule
// @access  Private (Doctor)
const getMySchedule = async (req, res) => {
  const { day } = req.query;

  const sections = await Section.find({ doctor: req.user._id, isClosed: false })
    .select('_id')
    .lean();

  const sectionIds = sections.map((s) => s._id);

  const query = { section: { $in: sectionIds } };
  if (day) query.dayOfWeek = day.toUpperCase();

  const slots = await ScheduleSlot.find(query)
    .populate({
      path: 'section',
      select: 'sectionNumber course',
      populate: { path: 'course', select: 'name code credits' }
    })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: slots.length,
    data: slots
  });
};

module.exports = {
  getMySections,
  getSectionRoster,
  getMySchedule
};
