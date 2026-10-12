const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Section = require('../models/Section');
const Notification = require('../models/Notification');
const { ROLES, ASSIGNMENT_STATUS } = require('../config/constants');
const { logAction } = require('../services/auditService');

// ─────────────────────────────────────────────
// 1. Create Assignment (Doctor)
// ─────────────────────────────────────────────
const createAssignment = async (req, res) => {
  const {
    sectionId,
    title,
    description,
    deadline,
    dueDate,
    maxScore = 10,
    allowLate = false,
    attachments
  } = req.body;

  const section = await Section.findById(sectionId);
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({ success: false, message: 'Cannot create assignments in a closed section' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const finalDeadline = deadline || dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const assignment = await Assignment.create({
    section: sectionId,
    doctor: req.user._id,
    title: title.trim(),
    description: description ? description.trim() : '',
    deadline: new Date(finalDeadline),
    maxScore,
    allowLate,
    attachments: attachments || []
  });

  // Notify all enrolled students asynchronously
  setImmediate(async () => {
    try {
      if (section.students && section.students.length > 0) {
        const notifications = section.students.map((studentId) => ({
          recipient: studentId,
          title: `New Assignment: ${assignment.title}`,
          message: `A new assignment has been posted with deadline ${new Date(assignment.deadline).toLocaleDateString()}`,
          type: 'ASSIGNMENT',
          refId: assignment._id,
          priority: 'NORMAL'
        }));
        await Notification.insertMany(notifications);
      }
    } catch (err) {
      console.error('[Notification] Error sending assignment notifications:', err.message);
    }
  });

  logAction({
    user: req.user,
    action: 'CREATE_ASSIGNMENT',
    category: 'ACADEMIC',
    targetEntity: 'Assignment',
    targetId: assignment._id,
    details: { sectionId, maxScore, allowLate },
    req
  });

  res.status(201).json({
    success: true,
    message: 'Assignment created and published successfully',
    data: assignment
  });
};

// ─────────────────────────────────────────────
// 2. Get Section Assignments (Student / Doctor)
// ─────────────────────────────────────────────
const getSectionAssignments = async (req, res) => {
  const { sectionId } = req.params;

  const assignments = await Assignment.find({ section: sectionId })
    .populate({
      path: 'section',
      select: 'sectionNumber course doctor',
      populate: [
        { path: 'course', select: 'name code credits' },
        { path: 'doctor', select: 'name email' }
      ]
    })
    .sort({ deadline: 1 })
    .lean();

  const assignmentIds = assignments.map((a) => a._id);

  // Student perspective: attach personal submission info and status
  if (req.user.role === ROLES.STUDENT) {
    const mySubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: req.user._id
    })
      .select('assignment status score doctorFeedback submittedAt isLate submissionCount submittedFiles studentNotes')
      .lean();

    const submissionMap = new Map();
    mySubmissions.forEach((s) => submissionMap.set(s.assignment.toString(), s));

    const enriched = assignments.map((a) => {
      const sub = submissionMap.get(a._id.toString());
      const now = new Date();
      let displayStatus = 'NOT_SUBMITTED';

      if (sub) {
        displayStatus = sub.status;
      } else if (now > a.deadline) {
        displayStatus = 'MISSING';
      }

      return {
        ...a,
        mySubmission: sub || null,
        displayStatus
      };
    });

    return res.status(200).json({ success: true, count: enriched.length, data: enriched });
  }

  // Doctor perspective: calculate submission metrics per assignment
  const allSubmissions = await Submission.find({
    assignment: { $in: assignmentIds }
  })
    .select('assignment status')
    .lean();

  const submissionCountsMap = new Map();
  allSubmissions.forEach((s) => {
    const aId = s.assignment.toString();
    if (!submissionCountsMap.has(aId)) {
      submissionCountsMap.set(aId, { total: 0, graded: 0, pending: 0 });
    }
    const metrics = submissionCountsMap.get(aId);
    metrics.total += 1;
    if (s.status === ASSIGNMENT_STATUS.GRADED) {
      metrics.graded += 1;
    } else {
      metrics.pending += 1;
    }
  });

  const enrichedForDoctor = assignments.map((a) => ({
    ...a,
    metrics: submissionCountsMap.get(a._id.toString()) || { total: 0, graded: 0, pending: 0 }
  }));

  res.status(200).json({ success: true, count: enrichedForDoctor.length, data: enrichedForDoctor });
};

// ─────────────────────────────────────────────
// 2.b Get My Assignments (Student)
// ─────────────────────────────────────────────
const getMyAssignments = async (req, res) => {
  const studentId = req.user._id;
  const { sectionId } = req.query;

  let sectionIds = [];
  if (sectionId) {
    const section = await Section.findOne({ _id: sectionId, students: studentId, isClosed: false }).lean();
    if (!section) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    sectionIds = [section._id];
  } else {
    const enrolledSections = await Section.find({ students: studentId, isClosed: false }).select('_id').lean();
    sectionIds = enrolledSections.map((s) => s._id);
  }

  const assignments = await Assignment.find({ section: { $in: sectionIds } })
    .populate({
      path: 'section',
      select: 'sectionNumber course doctor',
      populate: [
        { path: 'course', select: 'name code credits' },
        { path: 'doctor', select: 'name email' }
      ]
    })
    .sort({ deadline: 1 })
    .lean();

  const assignmentIds = assignments.map((a) => a._id);

  const mySubmissions = await Submission.find({
    assignment: { $in: assignmentIds },
    student: studentId
  })
    .select('assignment status score doctorFeedback submittedAt isLate submissionCount submittedFiles studentNotes')
    .lean();

  const submissionMap = new Map();
  mySubmissions.forEach((s) => submissionMap.set(s.assignment.toString(), s));

  const enriched = assignments.map((a) => {
    const sub = submissionMap.get(a._id.toString());
    const now = new Date();
    let displayStatus = 'NOT_SUBMITTED';

    if (sub) {
      displayStatus = sub.status;
    } else if (now > a.deadline) {
      displayStatus = 'MISSING';
    }

    return {
      ...a,
      mySubmission: sub || null,
      displayStatus
    };
  });

  return res.status(200).json({ success: true, count: enriched.length, data: enriched });
};

// ─────────────────────────────────────────────
// 3. Submit Assignment (Student)
// ─────────────────────────────────────────────
const submitAssignment = async (req, res) => {
  const assignmentId = req.params.id;
  const { submittedFiles, studentNotes, submissionText, attachmentUrl, comments } = req.body;

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  const section = await Section.findById(assignment.section).select('students isClosed').lean();
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({ success: false, message: 'Cannot submit assignments for a closed section' });
  }

  const isEnrolled = section.students.some((s) => s.toString() === req.user._id.toString());
  if (!isEnrolled) {
    return res.status(403).json({ success: false, message: 'You are not enrolled in this section' });
  }

  const now = new Date();
  const isLate = now > assignment.deadline;

  if (isLate && !assignment.allowLate) {
    return res.status(400).json({
      success: false,
      message: 'The deadline has passed and late submissions are strictly not accepted for this assignment'
    });
  }

  let finalFiles = submittedFiles || [];
  if (finalFiles.length === 0 && (attachmentUrl || submissionText)) {
    finalFiles = [{
      fileName: attachmentUrl ? 'المستند المرفق' : 'الحل المكتوب',
      fileUrl: attachmentUrl || 'text://submission',
      fileSize: 0
    }];
  }

  const finalNotes = studentNotes !== undefined 
    ? studentNotes.trim() 
    : (submissionText ? `${submissionText}${comments ? `\n\nملاحظات: ${comments}` : ''}` : (comments ? comments.trim() : ''));

  let submission = await Submission.findOne({ assignment: assignmentId, student: req.user._id });

  if (submission) {
    // If already graded, cannot modify without permission
    if (submission.status === ASSIGNMENT_STATUS.GRADED) {
      return res.status(400).json({
        success: false,
        message: 'This assignment has already been graded and cannot be resubmitted'
      });
    }

    if (isLate && !assignment.allowLate) {
      return res.status(400).json({
        success: false,
        message: 'Modifying solution after deadline is not allowed'
      });
    }

    submission.submittedFiles = finalFiles.length > 0 ? finalFiles : submission.submittedFiles;
    submission.studentNotes = finalNotes !== '' ? finalNotes : submission.studentNotes;
    submission.isLate = isLate;
    submission.status = isLate ? ASSIGNMENT_STATUS.LATE : ASSIGNMENT_STATUS.SUBMITTED;
    submission.submittedAt = now;
    submission.submissionCount += 1;
    await submission.save();
  } else {
    submission = await Submission.create({
      assignment: assignmentId,
      student: req.user._id,
      submittedFiles: finalFiles,
      studentNotes: finalNotes,
      isLate,
      status: isLate ? ASSIGNMENT_STATUS.LATE : ASSIGNMENT_STATUS.SUBMITTED,
      submittedAt: now,
      submissionCount: 1
    });
  }

  logAction({
    user: req.user,
    action: 'SUBMIT_ASSIGNMENT',
    category: 'ACADEMIC',
    targetEntity: 'Submission',
    targetId: submission._id,
    details: { isLate, submissionCount: submission.submissionCount },
    req
  });

  res.status(200).json({
    success: true,
    message: isLate ? 'Assignment submitted late' : 'Assignment submitted successfully',
    data: submission
  });
};

// ─────────────────────────────────────────────
// 4. Grade Submission (Doctor)
// ─────────────────────────────────────────────
const gradeSubmission = async (req, res) => {
  const { score, doctorFeedback } = req.body;

  const submission = await Submission.findById(req.params.id).populate('assignment');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  const assignment = submission.assignment;
  const section = await Section.findById(assignment.section).select('doctor').lean();

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized to grade this submission' });
  }

  if (score < 0 || score > assignment.maxScore) {
    return res.status(400).json({
      success: false,
      message: `Score must be between 0 and maximum possible score (${assignment.maxScore})`
    });
  }

  submission.score = score;
  submission.doctorFeedback = doctorFeedback ? doctorFeedback.trim() : '';
  submission.status = ASSIGNMENT_STATUS.GRADED;
  submission.gradedAt = new Date();
  submission.gradedBy = req.user._id;
  await submission.save();

  // Send grade notification to student
  setImmediate(async () => {
    try {
      await Notification.create({
        recipient: submission.student,
        title: `Grade Posted: ${assignment.title}`,
        message: `Your score is ${score}/${assignment.maxScore}. ${doctorFeedback ? 'Feedback provided.' : ''}`,
        type: 'GRADE',
        refId: assignment._id,
        priority: 'HIGH'
      });
    } catch (err) {
      console.error('[Notification] Error posting grade notification:', err.message);
    }
  });

  logAction({
    user: req.user,
    action: 'GRADE_SUBMISSION',
    category: 'GRADE',
    targetEntity: 'Submission',
    targetId: submission._id,
    details: { score, maxScore: assignment.maxScore },
    req
  });

  res.status(200).json({
    success: true,
    message: 'Submission graded successfully',
    data: submission
  });
};

// ─────────────────────────────────────────────
// 5. Get Submissions for Assignment (Doctor)
// ─────────────────────────────────────────────
const getAssignmentSubmissions = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  const section = await Section.findById(assignment.section).select('doctor').lean();
  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const submissions = await Submission.find({ assignment: assignment._id })
    .select('student submittedFiles studentNotes status score doctorFeedback submittedAt gradedAt isLate submissionCount')
    .populate('student', 'name email avatar')
    .sort({ submittedAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    assignment: {
      _id: assignment._id,
      title: assignment.title,
      deadline: assignment.deadline,
      maxScore: assignment.maxScore
    },
    count: submissions.length,
    data: submissions
  });
};

// @desc    Secure file upload for student assignment submissions
// @route   POST /api/assignments/upload
// @access  Private (Student, Doctor, Admin)
const uploadAssignmentFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'يرجى إرفاق ملف للرفع' });
  }

  res.status(200).json({
    success: true,
    data: {
      fileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      fileSize: req.file.size,
      fileType: req.file.mimetype
    }
  });
};

module.exports = {
  createAssignment,
  getSectionAssignments,
  getMyAssignments,
  submitAssignment,
  uploadAssignmentFile,
  gradeSubmission,
  getAssignmentSubmissions
};
