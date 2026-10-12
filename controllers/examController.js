const Exam = require('../models/Exam');
const Grade = require('../models/Grade');
const Section = require('../models/Section');
const Notification = require('../models/Notification');
const StudentProfile = require('../models/StudentProfile');
const { ROLES } = require('../config/constants');
const { calculateLetterGrade } = require('../services/gpaService');
const { logAction } = require('../services/auditService');

// ─────────────────────────────────────────────
// 1. Create Exam (Doctor / Admin)
// ─────────────────────────────────────────────
const createExam = async (req, res) => {
  const {
    sectionId,
    title,
    type,
    examDate,
    startTime,
    durationMinutes,
    location,
    maxScore = 100,
    weightPercentage = 20,
    instructions
  } = req.body;

  const section = await Section.findById(sectionId);
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({ success: false, message: 'Cannot create exams in a closed section' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  // Check cumulative exam weights in this section
  const existingExams = await Exam.find({ section: sectionId }).select('weightPercentage').lean();
  const currentTotalWeight = existingExams.reduce((sum, e) => sum + (e.weightPercentage || 0), 0);

  if (currentTotalWeight + weightPercentage > 100) {
    return res.status(400).json({
      success: false,
      message: `Total exam weights would exceed 100%. Current total: ${currentTotalWeight}%, requested: ${weightPercentage}%`
    });
  }

  const exam = await Exam.create({
    section: sectionId,
    doctor: req.user._id,
    title: title.trim(),
    type,
    examDate: new Date(examDate),
    startTime: startTime || '',
    durationMinutes: durationMinutes || null,
    location: location ? location.trim() : 'Classroom',
    maxScore,
    weightPercentage,
    instructions: instructions ? instructions.trim() : '',
    isPublished: true
  });

  // Notify students asynchronously
  setImmediate(async () => {
    try {
      if (section.students && section.students.length > 0) {
        const notifications = section.students.map((studentId) => ({
          recipient: studentId,
          title: `Exam Scheduled: ${exam.title}`,
          message: `${exam.type} exam is scheduled for ${new Date(exam.examDate).toLocaleDateString()}. Weight: ${exam.weightPercentage}%`,
          type: 'EXAM',
          refId: exam._id,
          priority: 'HIGH'
        }));
        await Notification.insertMany(notifications);
      }
    } catch (err) {
      console.error('[Notification] Error creating exam notifications:', err.message);
    }
  });

  logAction({
    user: req.user,
    action: 'CREATE_EXAM',
    category: 'ACADEMIC',
    targetEntity: 'Exam',
    targetId: exam._id,
    details: { sectionId, weightPercentage, maxScore },
    req
  });

  res.status(201).json({
    success: true,
    message: 'Exam created successfully',
    data: exam
  });
};

// ─────────────────────────────────────────────
// 2. Get Exams for Section
// ─────────────────────────────────────────────
const getSectionExams = async (req, res) => {
  const exams = await Exam.find({ section: req.params.sectionId })
    .sort({ examDate: 1 })
    .lean();

  res.status(200).json({ success: true, count: exams.length, data: exams });
};

// ─────────────────────────────────────────────
// 3. Batch Record Student Grades (Doctor / Admin)
// ─────────────────────────────────────────────
const recordGrades = async (req, res) => {
  const { grades } = req.body; // Array of { studentId, score, notes }
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const section = await Section.findById(exam.section).select('doctor students isClosed').lean();
  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const enrolledStudentIds = new Set(section.students.map((id) => id.toString()));

  // Validate each entry in batch
  for (const item of grades) {
    if (!enrolledStudentIds.has(item.studentId.toString())) {
      return res.status(400).json({
        success: false,
        message: `Student ${item.studentId} is not enrolled in this section`
      });
    }

    if (item.score < 0 || item.score > exam.maxScore) {
      return res.status(400).json({
        success: false,
        message: `Score for student ${item.studentId} must be between 0 and ${exam.maxScore}`
      });
    }
  }

  // High-performance batch execution via MongoDB bulkWrite
  const bulkOps = grades.map((item) => ({
    updateOne: {
      filter: { student: item.studentId, exam: exam._id },
      update: {
        $set: {
          student: item.studentId,
          section: section._id,
          exam: exam._id,
          score: item.score,
          notes: item.notes ? item.notes.trim() : '',
          gradedBy: req.user._id,
          isApproved: true
        }
      },
      upsert: true
    }
  }));

  await Grade.bulkWrite(bulkOps);

  // Send notifications to students asynchronously
  setImmediate(async () => {
    try {
      const notifications = grades.map((g) => ({
        recipient: g.studentId,
        title: `Grade Posted: ${exam.title}`,
        message: `Your score is ${g.score}/${exam.maxScore}`,
        type: 'GRADE',
        refId: exam._id,
        priority: 'NORMAL'
      }));
      await Notification.insertMany(notifications);
    } catch (err) {
      console.error('[Notification] Error creating grade notifications:', err.message);
    }
  });

  logAction({
    user: req.user,
    action: 'RECORD_EXAM_GRADES',
    category: 'GRADE',
    targetEntity: 'Exam',
    targetId: exam._id,
    details: { recordsCount: grades.length },
    req
  });

  res.status(200).json({
    success: true,
    message: 'Grades successfully recorded and published via bulk write',
    count: grades.length
  });
};

// ─────────────────────────────────────────────
// 4. Student Grade Breakdown & GPA Evaluation
// ─────────────────────────────────────────────
const getMySectionGrades = async (req, res) => {
  const sectionId = req.params.sectionId;
  const studentId = req.user._id;

  const [section, exams] = await Promise.all([
    Section.findById(sectionId).populate('course', 'name code credits stage').lean(),
    Exam.find({ section: sectionId }).select('title type maxScore weightPercentage').lean()
  ]);

  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  const examMap = new Map();
  exams.forEach((e) => examMap.set(e._id.toString(), e));

  const examIds = exams.map((e) => e._id);
  const examGrades = await Grade.find({ student: studentId, exam: { $in: examIds } })
    .select('exam score notes')
    .lean();

  let totalWeightedScore = 0;
  let totalEvaluatedWeight = 0;

  const breakdown = examGrades.map((g) => {
    const examInfo = examMap.get(g.exam.toString()) || {
      title: 'Exam',
      type: 'QUIZ',
      maxScore: 100,
      weightPercentage: 20
    };

    const percentage = (g.score / examInfo.maxScore) * 100;
    const weighted = (percentage * examInfo.weightPercentage) / 100;

    totalWeightedScore += weighted;
    totalEvaluatedWeight += examInfo.weightPercentage;

    return {
      examId: g.exam,
      examTitle: examInfo.title,
      examType: examInfo.type,
      score: g.score,
      maxScore: examInfo.maxScore,
      weightPercentage: `${examInfo.weightPercentage}%`,
      percentage: `${percentage.toFixed(1)}%`,
      notes: g.notes || ''
    };
  });

  const finalPercentage =
    totalEvaluatedWeight > 0
      ? Number(((totalWeightedScore / totalEvaluatedWeight) * 100).toFixed(1))
      : 0;

  const gradeSummary = calculateLetterGrade(finalPercentage);

  res.status(200).json({
    success: true,
    data: {
      courseName: section.course.name,
      courseCode: section.course.code,
      credits: section.course.credits,
      breakdown,
      accumulatedScore: Number(totalWeightedScore.toFixed(1)),
      totalWeightEvaluated: `${totalEvaluatedWeight}%`,
      letterGrade: gradeSummary.letter,
      gpaPoint: gradeSummary.gpaPoint,
      evaluation: gradeSummary.description,
      isPassed: gradeSummary.isPassed
    }
  });
};

// ─────────────────────────────────────────────
// 5. Complete Section Grades Sheet (Doctor / Admin)
// ─────────────────────────────────────────────
const getSectionGradesSheet = async (req, res) => {
  const sectionId = req.params.sectionId;

  const section = await Section.findById(sectionId)
    .populate('course', 'name code credits')
    .populate('students', 'name email avatar')
    .lean();

  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const [exams, allGrades, studentProfiles] = await Promise.all([
    Exam.find({ section: sectionId }).sort({ examDate: 1 }).lean(),
    Grade.find({ section: sectionId }).select('student exam score').lean(),
    StudentProfile.find({ user: { $in: section.students.map((s) => s._id) } })
      .select('user studentId')
      .lean()
  ]);

  const profileMap = new Map();
  studentProfiles.forEach((p) => profileMap.set(p.user.toString(), p.studentId));

  // Build Map: "studentId:examId" -> score
  const gradeLookup = new Map();
  allGrades.forEach((g) => {
    gradeLookup.set(`${g.student.toString()}:${g.exam.toString()}`, g.score);
  });

  const totalPossibleWeight = exams.reduce((sum, e) => sum + (e.weightPercentage || 0), 0);

  const studentRows = section.students.map((student) => {
    const sId = student._id.toString();
    let totalWeightedScore = 0;

    const examScores = exams.map((exam) => {
      const score = gradeLookup.get(`${sId}:${exam._id.toString()}`);
      if (score !== undefined) {
        const pct = (score / exam.maxScore) * 100;
        totalWeightedScore += (pct * exam.weightPercentage) / 100;
      }
      return {
        examId: exam._id,
        score: score !== undefined ? score : null
      };
    });

    const finalPercent = totalPossibleWeight > 0 ? (totalWeightedScore / totalPossibleWeight) * 100 : 0;
    const gradeSummary = calculateLetterGrade(finalPercent);

    return {
      _id: student._id,
      name: student.name,
      email: student.email,
      studentId: profileMap.get(sId) || 'N/A',
      examScores,
      totalWeightedScore: Number(totalWeightedScore.toFixed(1)),
      letterGrade: gradeSummary.letter,
      gpaPoint: gradeSummary.gpaPoint,
      evaluation: gradeSummary.description,
      isPassed: gradeSummary.isPassed
    };
  });

  res.status(200).json({
    success: true,
    section: {
      _id: section._id,
      sectionNumber: section.sectionNumber,
      course: section.course,
      totalStudents: studentRows.length
    },
    exams: exams.map((e) => ({
      _id: e._id,
      title: e.title,
      type: e.type,
      maxScore: e.maxScore,
      weightPercentage: e.weightPercentage
    })),
    data: studentRows
  });
};

module.exports = {
  createExam,
  getSectionExams,
  recordGrades,
  getMySectionGrades,
  getSectionGradesSheet
};
