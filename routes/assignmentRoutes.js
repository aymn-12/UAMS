const express = require('express');
const router = express.Router();
const {
  createAssignment,
  getSectionAssignments,
  getMyAssignments,
  submitAssignment,
  uploadAssignmentFile,
  gradeSubmission,
  getAssignmentSubmissions
} = require('../controllers/assignmentController');
const upload = require('../middlewares/uploadMiddleware');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const {
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema
} = require('../middlewares/evaluationValidation');
const { ROLES } = require('../config/constants');

router.use(protect);

// Student gets enrolled assignments
router.get('/my', authorize(ROLES.STUDENT), getMyAssignments);

// Doctor creates assignment
router.post('/', authorize(ROLES.DOCTOR, ROLES.ADMIN), validate(createAssignmentSchema), createAssignment);

// Get assignments for a section
router.get('/section/:sectionId', getSectionAssignments);

// Secure file upload for assignments
router.post('/upload', authorize(ROLES.STUDENT, ROLES.DOCTOR, ROLES.ADMIN), upload.single('file'), uploadAssignmentFile);

// Student submits assignment (supports both JSON and multipart FormData)
router.post(
  '/:id/submit',
  authorize(ROLES.STUDENT),
  upload.array('files', 5),
  (req, res, next) => {
    if (req.files && req.files.length > 0) {
      req.body.submittedFiles = req.files.map((f) => ({
        fileName: f.originalname,
        fileUrl: `/uploads/${f.filename}`,
        fileSize: f.size
      }));
    }
    next();
  },
  validate(submitAssignmentSchema),
  submitAssignment
);

// Doctor grades submission
router.put('/submissions/:id/grade', authorize(ROLES.DOCTOR, ROLES.ADMIN), validate(gradeSubmissionSchema), gradeSubmission);

// Doctor views submissions for an assignment
router.get('/:id/submissions', authorize(ROLES.DOCTOR, ROLES.ADMIN), getAssignmentSubmissions);

module.exports = router;
