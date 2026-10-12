const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Helper to convert "HH:MM" to minutes for time range comparison
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// ─────────────────────────────────────────────
// Department Schemas
// ─────────────────────────────────────────────
const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string().trim().uppercase().min(2).max(10).required(),
  college: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().allow('', null).optional(),
  headOfDepartment: Joi.string().pattern(objectIdPattern).allow(null, '').optional()
});

const updateDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  college: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().allow('', null).optional(),
  headOfDepartment: Joi.string().pattern(objectIdPattern).allow(null, '').optional()
});

// ─────────────────────────────────────────────
// Course Schemas
// ─────────────────────────────────────────────
const createCourseSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  code: Joi.string().trim().uppercase().min(2).max(15).required(),
  department: Joi.string().pattern(objectIdPattern).required(),
  stage: Joi.number().integer().min(1).max(6).required(),
  credits: Joi.number().min(1).max(10).required(),
  description: Joi.string().allow('', null).optional()
});

const updateCourseSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).optional(),
  stage: Joi.number().integer().min(1).max(6).optional(),
  credits: Joi.number().min(1).max(10).optional(),
  description: Joi.string().allow('', null).optional()
});

// ─────────────────────────────────────────────
// Section Schemas
// ─────────────────────────────────────────────
const createSectionSchema = Joi.object({
  course: Joi.string().pattern(objectIdPattern).required(),
  sectionNumber: Joi.string().trim().uppercase().required(),
  doctor: Joi.string().pattern(objectIdPattern).required(),
  semester: Joi.string().trim().uppercase().valid('FIRST', 'SECOND', 'SUMMER').required(),
  academicYear: Joi.string().trim().pattern(/^\d{4}-\d{4}$/).required().messages({
    'string.pattern.base': 'Academic year must be in format YYYY-YYYY (e.g. 2025-2026)'
  }),
  capacity: Joi.number().integer().min(1).max(300).default(60),
  maxAbsenceHours: Joi.number().min(1).max(50).default(6)
});

const updateSectionSchema = Joi.object({
  doctor: Joi.string().pattern(objectIdPattern).optional(),
  capacity: Joi.number().integer().min(1).max(300).optional(),
  maxAbsenceHours: Joi.number().min(1).max(50).optional(),
  isClosed: Joi.boolean().optional()
});

const enrollStudentsSchema = Joi.object({
  studentIds: Joi.array()
    .items(Joi.string().pattern(objectIdPattern))
    .min(1)
    .unique()
    .required()
    .messages({
      'array.unique': 'Duplicate student IDs found in enrollment list'
    })
});

const unenrollStudentSchema = Joi.object({
  studentId: Joi.string().pattern(objectIdPattern).required()
});

// ─────────────────────────────────────────────
// Schedule Slot Schemas (Flexible Classroom Style)
// ─────────────────────────────────────────────
const addScheduleSlotSchema = Joi.object({
  sectionId: Joi.string().pattern(objectIdPattern).required(),
  dayOfWeek: Joi.string()
    .uppercase()
    .valid('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')
    .required(),
  startTime: Joi.string().pattern(timePattern).required(),
  endTime: Joi.string().pattern(timePattern).optional().allow('', null),
  room: Joi.string().trim().allow('', null).default('ONLINE'),
  building: Joi.string().trim().allow('', null).default('GENERAL')
});

// ─────────────────────────────────────────────
// Query Schemas
// ─────────────────────────────────────────────
const queryCoursesSchema = Joi.object({
  department: Joi.string().pattern(objectIdPattern).optional(),
  stage: Joi.number().integer().min(1).max(6).optional(),
  search: Joi.string().trim().max(100).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

const querySectionsSchema = Joi.object({
  course: Joi.string().pattern(objectIdPattern).optional(),
  doctor: Joi.string().pattern(objectIdPattern).optional(),
  semester: Joi.string().uppercase().valid('FIRST', 'SECOND', 'SUMMER').optional(),
  academicYear: Joi.string().trim().optional(),
  isClosed: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

module.exports = {
  createDepartmentSchema,
  updateDepartmentSchema,
  createCourseSchema,
  updateCourseSchema,
  createSectionSchema,
  updateSectionSchema,
  enrollStudentsSchema,
  unenrollStudentSchema,
  addScheduleSlotSchema,
  queryCoursesSchema,
  querySectionsSchema
};
