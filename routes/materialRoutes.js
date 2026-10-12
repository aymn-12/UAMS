const express = require('express');
const router = express.Router();
const {
  getSectionMaterials,
  saveStudentAnnotation,
  getMyAnnotations,
  deleteStudentAnnotation,
  deleteMaterial
} = require('../controllers/materialController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { annotationSchema } = require('../middlewares/materialValidation');
const { ROLES } = require('../config/constants');

// All material routes require active authentication
router.use(protect);

// Get materials for a section
router.get('/section/:sectionId', getSectionMaterials);

// Delete course material (Doctor / Admin)
router.delete('/:id', authorize(ROLES.DOCTOR, ROLES.ADMIN), deleteMaterial);

// Student personal annotations on PDF
router.post('/:id/annotations', authorize(ROLES.STUDENT), validate(annotationSchema), saveStudentAnnotation);
router.get('/:id/my-annotations', authorize(ROLES.STUDENT), getMyAnnotations);
router.delete('/:id/annotations/:annotationId', authorize(ROLES.STUDENT), deleteStudentAnnotation);

module.exports = router;
