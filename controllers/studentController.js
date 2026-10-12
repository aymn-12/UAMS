const Section = require('../models/Section');
const ScheduleSlot = require('../models/ScheduleSlot');
const StudentProfile = require('../models/StudentProfile');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');

// @desc    Get student's full academic profile & record
// @route   GET /api/student/profile
// @access  Private (Student)
const getMyProfile = async (req, res) => {
  const studentId = req.user._id;

  const [profile, sections] = await Promise.all([
    StudentProfile.findOne({ user: studentId })
      .populate('department', 'name code college')
      .lean(),
    Section.find({ students: studentId, isClosed: false })
      .select('sectionNumber course doctor semester academicYear')
      .populate('course', 'name code credits stage')
      .populate('doctor', 'name email')
      .lean()
  ]);

  const sectionIds = sections.map((s) => s._id);

  const [totalSessions, presentCount] = await Promise.all([
    AttendanceSession.countDocuments({ section: { $in: sectionIds } }),
    AttendanceRecord.countDocuments({
      student: studentId,
      section: { $in: sectionIds },
      status: 'PRESENT'
    })
  ]);

  const totalCredits = sections.reduce((sum, s) => sum + (s.course?.credits || 0), 0);
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive
      },
      profile: {
        studentId: profile?.studentId || 'N/A',
        stage: profile?.stage || 1,
        studyType: profile?.studyType || 'MORNING',
        academicStatus: profile?.academicStatus || 'REGULAR',
        admissionYear: profile?.admissionYear || 2024,
        gpa: profile?.gpa || 0,
        college: profile?.department?.college || 'الجامعة المستنصرية',
        department: profile?.department?.name || 'قسم تقنيات الحاسوب'
      },
      stats: {
        enrolledCoursesCount: sections.length,
        totalCredits,
        attendanceRate: `${attendanceRate}%`,
        attendedSessions: presentCount,
        totalSessions
      },
      enrolledSections: sections
    }
  });
};

// @desc    Get all enrolled sections with course and doctor info
// @route   GET /api/student/sections
// @access  Private (Student)
const getMySections = async (req, res) => {
  const sections = await Section.find({ students: req.user._id, isClosed: false })
    .select('sectionNumber course doctor semester academicYear maxAbsenceHours capacity')
    .populate('course', 'name code credits stage department')
    .populate('doctor', 'name email')
    .lean();

  const sectionIds = sections.map((s) => s._id);

  // Fetch timetable slots for all enrolled sections in parallel
  const slots = await ScheduleSlot.find({ section: { $in: sectionIds } })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  // Attach schedule slots to corresponding sections
  const enrichedSections = sections.map((section) => {
    const sectionSlots = slots.filter((slot) => slot.section.toString() === section._id.toString());
    return {
      ...section,
      schedule: sectionSlots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        building: s.building
      }))
    };
  });

  // Calculate total enrolled credits
  const totalCredits = enrichedSections.reduce(
    (sum, sec) => sum + (sec.course?.credits || 0),
    0
  );

  res.status(200).json({
    success: true,
    count: enrichedSections.length,
    totalCredits,
    data: enrichedSections
  });
};

// @desc    Get student's full weekly timetable
// @route   GET /api/student/schedule
// @access  Private (Student)
const getMySchedule = async (req, res) => {
  const { day } = req.query;

  const sections = await Section.find({ students: req.user._id, isClosed: false })
    .select('_id')
    .lean();

  const sectionIds = sections.map((s) => s._id);

  const query = { section: { $in: sectionIds } };
  if (day) query.dayOfWeek = day.toUpperCase();

  const slots = await ScheduleSlot.find(query)
    .populate({
      path: 'section',
      select: 'sectionNumber course doctor',
      populate: [
        { path: 'course', select: 'name code credits' },
        { path: 'doctor', select: 'name email' }
      ]
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
  getMyProfile,
  getMySections,
  getMySchedule
};
