const Section = require('../models/Section');
const ScheduleSlot = require('../models/ScheduleSlot');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceSession = require('../models/AttendanceSession');
const Notification = require('../models/Notification');
const Question = require('../models/Question');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const Department = require('../models/Department');
const Course = require('../models/Course');
const AuditLog = require('../models/AuditLog');
const { ROLES } = require('../config/constants');

const ARABIC_DAYS = {
  SUNDAY:    'الأحد',
  MONDAY:    'الاثنين',
  TUESDAY:   'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY:  'الخميس',
  FRIDAY:    'الجمعة',
  SATURDAY:  'السبت'
};

const ENGLISH_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// ─────────────────────────────────────────────
// 1. Student Dashboard
// ─────────────────────────────────────────────
const getStudentDashboard = async (req, res) => {
  const studentId = req.user._id;
  const todayName = ENGLISH_DAYS[new Date().getDay()];
  const todayArabic = ARABIC_DAYS[todayName];

  // Fetch enrolled sections and student profile in parallel
  const [sections, profile] = await Promise.all([
    Section.find({ students: studentId, isClosed: false })
      .select('course sectionNumber doctor')
      .populate('course', 'name code credits stage')
      .populate('doctor', 'name email')
      .lean(),
    StudentProfile.findOne({ user: studentId })
      .populate('department', 'name code college')
      .lean()
  ]);

  const sectionIds = sections.map((s) => s._id);

  // Parallelize all dashboard metrics
  const [
    todayLectures,
    upcomingAssignments,
    upcomingExams,
    totalSessions,
    presentCount,
    unreadNotifications
  ] = await Promise.all([
    ScheduleSlot.find({ section: { $in: sectionIds }, dayOfWeek: todayName })
      .select('dayOfWeek startTime endTime room building section')
      .populate({
        path: 'section',
        select: 'sectionNumber course doctor',
        populate: [
          { path: 'course', select: 'name code' },
          { path: 'doctor', select: 'name' }
        ]
      })
      .sort({ startTime: 1 })
      .lean(),
    Assignment.find({ section: { $in: sectionIds }, deadline: { $gte: new Date() } })
      .select('title deadline maxScore section')
      .populate('section', 'sectionNumber course')
      .sort({ deadline: 1 })
      .limit(5)
      .lean(),
    Exam.find({ section: { $in: sectionIds }, examDate: { $gte: new Date() } })
      .select('title type examDate location startTime section weightPercentage')
      .populate('section', 'sectionNumber')
      .sort({ examDate: 1 })
      .limit(5)
      .lean(),
    AttendanceSession.countDocuments({ section: { $in: sectionIds } }),
    AttendanceRecord.countDocuments({ student: studentId, section: { $in: sectionIds }, status: 'PRESENT' }),
    Notification.countDocuments({ recipient: studentId, isRead: false })
  ]);

  const overallAttendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;
  const totalEnrolledCredits = sections.reduce((sum, s) => sum + (s.course?.credits || 0), 0);

  res.status(200).json({
    success: true,
    data: {
      studentInfo: {
        name: req.user.name,
        email: req.user.email,
        studentId: profile ? profile.studentId : 'N/A',
        stage: profile ? profile.stage : 1,
        studyType: profile ? profile.studyType : 'MORNING',
        college: profile && profile.department ? profile.department.college : 'N/A',
        department: profile && profile.department ? profile.department.name : 'N/A'
      },
      today: {
        english: todayName,
        arabic: todayArabic
      },
      metrics: {
        enrolledCoursesCount: sections.length,
        totalEnrolledCredits,
        overallAttendanceRate: `${overallAttendanceRate}%`,
        unreadNotificationsCount: unreadNotifications,
        totalAttendanceSessions: totalSessions,
        attendedSessions: presentCount
      },
      enrolledSections: sections,
      todayLectures,
      upcomingAssignments,
      upcomingExams
    }
  });
};

// ─────────────────────────────────────────────
// 2. Doctor Dashboard
// ─────────────────────────────────────────────
const getDoctorDashboard = async (req, res) => {
  const doctorId = req.user._id;
  const todayName = ENGLISH_DAYS[new Date().getDay()];
  const todayArabic = ARABIC_DAYS[todayName];

  const sections = await Section.find({ doctor: doctorId, isClosed: false })
    .select('students course sectionNumber capacity')
    .populate('course', 'name code')
    .lean();

  const sectionIds = sections.map((s) => s._id);

  // Parallelize all doctor dashboard queries
  const [todayLectures, assignments, unansweredQuestionsCount, unreadNotifications] = await Promise.all([
    ScheduleSlot.find({ section: { $in: sectionIds }, dayOfWeek: todayName })
      .select('dayOfWeek startTime endTime room building section')
      .populate({
        path: 'section',
        select: 'sectionNumber course',
        populate: { path: 'course', select: 'name code' }
      })
      .sort({ startTime: 1 })
      .lean(),
    Assignment.find({ section: { $in: sectionIds } }).select('_id').lean(),
    Question.countDocuments({ section: { $in: sectionIds }, isAnswered: false }),
    Notification.countDocuments({ recipient: doctorId, isRead: false })
  ]);

  const assignmentIds = assignments.map((a) => a._id);
  const pendingGradingCount = await Submission.countDocuments({
    assignment: { $in: assignmentIds },
    status: { $in: ['SUBMITTED', 'LATE'] }
  });

  // Calculate unique student count across all sections
  const uniqueStudents = new Set();
  sections.forEach((sec) => (sec.students || []).forEach((std) => uniqueStudents.add(std.toString())));

  res.status(200).json({
    success: true,
    data: {
      today: {
        english: todayName,
        arabic: todayArabic
      },
      metrics: {
        activeSectionsCount: sections.length,
        totalStudentsTaught: uniqueStudents.size,
        pendingGradingCount,
        unansweredQuestionsCount,
        unreadNotificationsCount: unreadNotifications
      },
      sections: sections.map((s) => ({
        _id: s._id,
        sectionNumber: s.sectionNumber,
        courseName: s.course ? s.course.name : 'N/A',
        courseCode: s.course ? s.course.code : 'N/A',
        enrolledCount: (s.students || []).length,
        capacity: s.capacity || 60
      })),
      sectionsSummary: sections.map((s) => ({
        _id: s._id,
        sectionNumber: s.sectionNumber,
        courseName: s.course ? s.course.name : 'N/A',
        courseCode: s.course ? s.course.code : 'N/A',
        enrolledCount: (s.students || []).length,
        capacity: s.capacity || 60
      })),
      todayLectures
    }
  });
};

// ─────────────────────────────────────────────
// 3. Admin Central Dashboard
// ─────────────────────────────────────────────
const getAdminDashboard = async (req, res) => {
  const [
    studentsCount,
    doctorsCount,
    adminsCount,
    departmentsCount,
    coursesCount,
    activeSectionsCount,
    totalAttendanceSessions,
    todayAuditLogsCount,
    recentAuditLogs
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT, isDeleted: false }),
    User.countDocuments({ role: ROLES.DOCTOR, isDeleted: false }),
    User.countDocuments({ role: ROLES.ADMIN, isDeleted: false }),
    Department.countDocuments({ isDeleted: false }),
    Course.countDocuments({ isDeleted: false }),
    Section.countDocuments({ isClosed: false }),
    AttendanceSession.countDocuments(),
    AuditLog.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    }),
    AuditLog.find()
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
  ]);

  res.status(200).json({
    success: true,
    data: {
      counts: {
        students: studentsCount,
        doctors: doctorsCount,
        admins: adminsCount,
        departments: departmentsCount,
        courses: coursesCount,
        sections: activeSectionsCount
      },
      users: {
        students: studentsCount,
        doctors: doctorsCount,
        admins: adminsCount,
        totalActive: studentsCount + doctorsCount + adminsCount
      },
      academic: {
        departmentsCount,
        coursesCount,
        activeSectionsCount
      },
      operations: {
        totalAttendanceSessions,
        todayAuditLogsCount
      },
      recentAuditLogs
    }
  });
};

module.exports = {
  getStudentDashboard,
  getDoctorDashboard,
  getAdminDashboard
};
