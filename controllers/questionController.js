const mongoose = require('mongoose');
const Question = require('../models/Question');
const Section = require('../models/Section');
const Notification = require('../models/Notification');
const { ROLES } = require('../config/constants');
const { logAction } = require('../services/auditService');

// ─────────────────────────────────────────────
// 1. Ask Question (Student)
// ─────────────────────────────────────────────
const askQuestion = async (req, res) => {
  const { sectionId, questionText } = req.body;

  if (!mongoose.Types.ObjectId.isValid(sectionId)) {
    return res.status(400).json({ success: false, message: 'Invalid section ID format' });
  }

  const section = await Section.findById(sectionId).select('students doctor sectionNumber isClosed').lean();
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({ success: false, message: 'Cannot ask questions in a closed section' });
  }

  const isEnrolled = section.students.some((s) => s.toString() === req.user._id.toString());
  if (!isEnrolled) {
    return res.status(403).json({ success: false, message: 'You are not enrolled in this section' });
  }

  const question = await Question.create({
    section: sectionId,
    student: req.user._id,
    questionText: questionText.trim()
  });

  // Notify section doctor
  setImmediate(async () => {
    try {
      await Notification.create({
        recipient: section.doctor,
        title: `New Question in Section ${section.sectionNumber}`,
        message: `${req.user.name} asked: "${questionText.substring(0, 80)}..."`,
        type: 'GENERAL',
        refId: question._id,
        priority: 'NORMAL'
      });
    } catch (err) {
      console.error('[Notification] Error sending question notification:', err.message);
    }
  });

  res.status(201).json({
    success: true,
    message: 'Question posted successfully to the class stream',
    data: question
  });
};

// ─────────────────────────────────────────────
// 2. Get Questions for a Section (Filterable Stream)
// ─────────────────────────────────────────────
const getSectionQuestions = async (req, res) => {
  const { sectionId } = req.params;
  const { isAnswered, search, page = 1, limit = 30 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(sectionId)) {
    return res.status(400).json({ success: false, message: 'Invalid section ID format' });
  }

  const query = { section: sectionId };

  if (isAnswered !== undefined) {
    query.isAnswered = isAnswered === 'true' || isAnswered === true;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.questionText = { $regex: escaped, $options: 'i' };
  }

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  const [questions, total] = await Promise.all([
    Question.find(query)
      .select('questionText answerText isAnswered answeredAt createdAt student answeredBy')
      .populate('student', 'name email avatar')
      .populate('answeredBy', 'name email avatar')
      .skip(skip)
      .limit(parsedLimit)
      .sort({ createdAt: -1 })
      .lean(),
    Question.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parsedLimit);

  res.status(200).json({
    success: true,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
    data: questions
  });
};

// ─────────────────────────────────────────────
// 3. Answer Question (Doctor / Admin)
// ─────────────────────────────────────────────
const answerQuestion = async (req, res) => {
  const { answerText } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid question ID format' });
  }

  const question = await Question.findById(req.params.id);
  if (!question) {
    return res.status(404).json({ success: false, message: 'Question not found' });
  }

  const section = await Section.findById(question.section).select('doctor isClosed').lean();
  if (section && section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized to answer questions in this section' });
  }

  question.answerText = answerText.trim();
  question.isAnswered = true;
  question.answeredAt = new Date();
  question.answeredBy = req.user._id;
  await question.save();

  // Notify student who asked
  setImmediate(async () => {
    try {
      await Notification.create({
        recipient: question.student,
        title: 'Question Answered by Professor',
        message: `Your question has been answered: "${answerText.substring(0, 80)}..."`,
        type: 'QUESTION_ANSWERED',
        refId: question._id,
        priority: 'HIGH'
      });
    } catch (err) {
      console.error('[Notification] Error creating answer notification:', err.message);
    }
  });

  res.status(200).json({
    success: true,
    message: 'Answer posted successfully',
    data: question
  });
};

// ─────────────────────────────────────────────
// 4. Delete Question (Student owner or Doctor / Admin)
// ─────────────────────────────────────────────
const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid question ID format' });
  }

  const question = await Question.findById(id);
  if (!question) {
    return res.status(404).json({ success: false, message: 'Question not found' });
  }

  const section = await Section.findById(question.section).select('doctor').lean();
  const isAuthor = question.student.toString() === req.user._id.toString();
  const isDoctor = section && section.doctor.toString() === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isAuthor && !isDoctor && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this question' });
  }

  await Question.findByIdAndDelete(id);

  res.status(200).json({ success: true, message: 'Question deleted successfully' });
};

module.exports = {
  askQuestion,
  getSectionQuestions,
  answerQuestion,
  deleteQuestion
};
