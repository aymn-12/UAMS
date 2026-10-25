const express = require('express');
const router = express.Router();
const {
  createDepartment,
  getDepartments,
  updateDepartment,
  createCourse,
  getCourses,
  createSection,
  getSections,
  enrollStudents,
  unenrollStudent,
  addScheduleSlot,
  updateScheduleSlot,
  deleteScheduleSlot,
  getScheduleByDay,
  getSectionSchedule
} = require('../controllers/academicController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validate, validateQuery } = require('../middlewares/validationMiddleware');
const {
  createDepartmentSchema,
  updateDepartmentSchema,
  createCourseSchema,
  createSectionSchema,
  enrollStudentsSchema,
  unenrollStudentSchema,
  addScheduleSlotSchema,
  queryCoursesSchema,
  querySectionsSchema
} = require('../middlewares/academicValidation');
const { ROLES } = require('../config/constants');

// All academic routes require active authentication
router.use(protect);

// ─────────────────────────────────────────────
// Departments
// ─────────────────────────────────────────────
router.route('/departments')
  .get(getDepartments)
  .post(authorize(ROLES.ADMIN), validate(createDepartmentSchema), createDepartment);

router.route('/departments/:id')
  .put(authorize(ROLES.ADMIN), validate(updateDepartmentSchema), updateDepartment);

// ─────────────────────────────────────────────
// Courses
// ─────────────────────────────────────────────
router.route('/courses')
  .get(validateQuery(queryCoursesSchema), getCourses)
  .post(authorize(ROLES.ADMIN), validate(createCourseSchema), createCourse);

// ─────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────
router.route('/sections')
  .get(authorize(ROLES.ADMIN), validateQuery(querySectionsSchema), getSections)
  .post(authorize(ROLES.ADMIN), validate(createSectionSchema), createSection);

router.route('/sections/:id/enroll')
  .post(authorize(ROLES.ADMIN), validate(enrollStudentsSchema), enrollStudents);

router.route('/sections/:id/unenroll')
  .post(authorize(ROLES.ADMIN), validate(unenrollStudentSchema), unenrollStudent);

router.route('/sections/:id/schedule')
  .get(getSectionSchedule)
  .post(
    authorize(ROLES.ADMIN),
    (req, res, next) => {
      req.body.sectionId = req.params.id;
      next();
    },
    validate(addScheduleSlotSchema),
    addScheduleSlot
  );

// ─────────────────────────────────────────────
// Schedules & Timetables
// ─────────────────────────────────────────────
router.route('/schedules/slots')
  .post(authorize(ROLES.ADMIN), validate(addScheduleSlotSchema), addScheduleSlot);

router.route('/schedules/slots/:id')
  .put(authorize(ROLES.ADMIN), updateScheduleSlot)
  .delete(authorize(ROLES.ADMIN), deleteScheduleSlot);

router.route('/sections/:sectionId/schedule/:id')
  .put(authorize(ROLES.ADMIN), updateScheduleSlot)
  .delete(authorize(ROLES.ADMIN), deleteScheduleSlot);

router.route('/schedules')
  .get(getScheduleByDay);

router.route('/schedule')
  .get(getScheduleByDay);

module.exports = router;
