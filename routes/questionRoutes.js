const express = require('express');
const router = express.Router();
const {
  askQuestion,
  getSectionQuestions,
  answerQuestion,
  deleteQuestion
} = require('../controllers/questionController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { questionSchema, answerSchema } = require('../middlewares/materialValidation');
const { ROLES } = require('../config/constants');

// All question routes require active authentication
router.use(protect);

// Student asks question
router.post('/', authorize(ROLES.STUDENT), validate(questionSchema), askQuestion);

// Get questions stream for a section (filterable with ?isAnswered=true/false&search=...)
router.get('/section/:sectionId', getSectionQuestions);

// Doctor answers student question
router.put('/:id/answer', authorize(ROLES.DOCTOR, ROLES.ADMIN), validate(answerSchema), answerQuestion);

// Delete question (Author student, or Doctor / Admin)
router.delete('/:id', deleteQuestion);

module.exports = router;
