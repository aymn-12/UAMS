const express = require('express');
const router = express.Router();
const {
  createExam,
  getSectionExams,
  recordGrades,
  getMySectionGrades,
  getSectionGradesSheet
} = require('../controllers/examController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const {
  createExamSchema,
  recordGradesSchema
} = require('../middlewares/evaluationValidation');
const { ROLES } = require('../config/constants');

// All exam routes require active authentication
router.use(protect);

// Doctor creates exam
router.post('/', authorize(ROLES.DOCTOR, ROLES.ADMIN), validate(createExamSchema), createExam);

// View all scheduled exams for a section
router.get('/section/:sectionId', getSectionExams);

// Doctor views full grade sheet matrix for a section
router.get('/section/:sectionId/grades-sheet', authorize(ROLES.DOCTOR, ROLES.ADMIN), getSectionGradesSheet);

// Doctor records/updates grades in batch via bulkWrite
router.post('/:id/grades', authorize(ROLES.DOCTOR, ROLES.ADMIN), validate(recordGradesSchema), recordGrades);

// Student views personal grade breakdown for a section
router.get('/section/:sectionId/my-breakdown', authorize(ROLES.STUDENT), getMySectionGrades);

module.exports = router;
