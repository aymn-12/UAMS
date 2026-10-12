const Section = require('../models/Section');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Exam = require('../models/Exam');
const Grade = require('../models/Grade');
const StudentProfile = require('../models/StudentProfile');
const { ROLES } = require('../config/constants');
const { generateAttendanceExcel, generateGradesExcel } = require('../services/exportService');
const { calculateLetterGrade } = require('../services/gpaService');

// ─────────────────────────────────────────────
// 1. Export Section Attendance to Excel (RTL Arabic)
// ─────────────────────────────────────────────
const exportAttendanceExcel = async (req, res) => {
  const { sectionId } = req.params;

  const section = await Section.findById(sectionId)
    .select('sectionNumber course doctor students maxAbsenceHours semester academicYear')
    .populate('course', 'name code')
    .populate('students', 'name email')
    .lean();

  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const studentUserIds = (section.students || []).map((s) => s._id);

  // Parallelize session count, records retrieval, and student profiles
  const [totalSessions, allRecords, profiles] = await Promise.all([
    AttendanceSession.countDocuments({ section: sectionId }),
    AttendanceRecord.find({ section: sectionId }).select('student status').lean(),
    StudentProfile.find({ user: { $in: studentUserIds } }).select('user studentId').lean()
  ]);

  const profileMap = new Map();
  profiles.forEach((p) => profileMap.set(p.user.toString(), p.studentId));

  const maxAbsences = section.maxAbsenceHours || 6;

  const stats = (section.students || []).map((student) => {
    const sIdStr = student._id.toString();
    const studentRecords = allRecords.filter((r) => r.student.toString() === sIdStr);
    const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
    const absentCount = Math.max(0, totalSessions - presentCount);
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    let warningLevel = 'منتظم';
    if (absentCount >= maxAbsences) {
      warningLevel = 'تجاوز حد الحرمان';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.75)) {
      warningLevel = 'إنذار نهائي';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.5)) {
      warningLevel = 'إنذار أول';
    } else if (absentCount >= Math.ceil(maxAbsences * 0.25)) {
      warningLevel = 'تنبيه غياب';
    }

    return {
      studentId: profileMap.get(sIdStr) || 'N/A',
      studentName: student.name,
      studentEmail: student.email,
      totalSessions,
      presentCount,
      absentCount,
      attendanceRate,
      warningLevel
    };
  });

  const workbook = await generateAttendanceExcel(section, stats);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=attendance_section_${section.sectionNumber}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
};

// ─────────────────────────────────────────────
// 2. Export Section Grades to Excel (RTL Arabic)
// ─────────────────────────────────────────────
const exportGradesExcel = async (req, res) => {
  const { sectionId } = req.params;

  const section = await Section.findById(sectionId)
    .select('sectionNumber course doctor students semester academicYear')
    .populate('course', 'name code')
    .populate('doctor', 'name email')
    .populate('students', 'name email')
    .lean();

  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const studentUserIds = (section.students || []).map((s) => s._id);

  // Parallelize exams, grades, and student profiles
  const [exams, allGrades, profiles] = await Promise.all([
    Exam.find({ section: sectionId })
      .select('title weightPercentage maxScore examDate')
      .sort({ examDate: 1 })
      .lean(),
    Grade.find({ section: sectionId }).select('student exam score').lean(),
    StudentProfile.find({ user: { $in: studentUserIds } }).select('user studentId').lean()
  ]);

  const profileMap = new Map();
  profiles.forEach((p) => profileMap.set(p.user.toString(), p.studentId));

  const examIds = exams.map((e) => e._id);
  const examHeaders = exams.map((e) => `${e.title} (${e.weightPercentage}%)`);
  const totalWeight = exams.reduce((sum, e) => sum + (e.weightPercentage || 0), 0);

  // Grade lookup map: "studentId:examId" -> score
  const gradeLookup = new Map();
  allGrades.forEach((g) => {
    gradeLookup.set(`${g.student.toString()}:${g.exam.toString()}`, g.score);
  });

  const rows = (section.students || []).map((student) => {
    const sIdStr = student._id.toString();
    let studentWeightedTotal = 0;

    const scores = exams.map((exam) => {
      const score = gradeLookup.get(`${sIdStr}:${exam._id.toString()}`);
      if (score !== undefined) {
        const weighted = (score / exam.maxScore) * exam.weightPercentage;
        studentWeightedTotal += weighted;
        return score;
      }
      return 0;
    });

    const finalPct = totalWeight > 0 ? (studentWeightedTotal / totalWeight) * 100 : 0;
    const { letter, description } = calculateLetterGrade(finalPct);

    return [
      profileMap.get(sIdStr) || 'N/A',
      student.name,
      student.email,
      ...scores,
      Number(studentWeightedTotal.toFixed(1)),
      `${letter} (${description})`
    ];
  });

  const workbook = await generateGradesExcel(section, rows, examHeaders);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=grades_section_${section.sectionNumber}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
  exportAttendanceExcel,
  exportGradesExcel
};
