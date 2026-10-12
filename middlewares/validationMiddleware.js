const Joi = require('joi');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

// Generic middleware generator for body validation
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map((detail) => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: errorDetails
    });
  }

  req.body = value;
  next();
};

// Generic middleware generator for query string validation
const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map((detail) => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Query Parameter Validation Error',
      errors: errorDetails
    });
  }

  req.query = value;
  next();
};

// Strict university domain regex
const emailDomainRegex = /^[a-zA-Z0-9._%+-]+@uomustansiriyah\.edu\.iq$/;

// Strong password policy: min 8 chars, at least one letter and one number
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// 24-character hexadecimal MongoDB ObjectId
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ─────────────────────────────────────────────
// Auth Schemas
// ─────────────────────────────────────────────
const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .pattern(emailDomainRegex)
    .required()
    .messages({
      'string.pattern.base': 'Email must be a valid @uomustansiriyah.edu.iq address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
  deviceId: Joi.string().trim().max(100).optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string()
    .pattern(passwordRegex)
    .required()
    .messages({
      'string.pattern.base': 'New password must be at least 8 characters long and contain both letters and numbers',
      'any.required': 'New password is required'
    })
});

const logoutSchema = Joi.object({
  deviceId: Joi.string().trim().max(100).optional(),
  allDevices: Joi.boolean().optional()
});

// ─────────────────────────────────────────────
// Admin User Management Schemas
// ─────────────────────────────────────────────
const createUserSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string()
    .trim()
    .pattern(emailDomainRegex)
    .required()
    .messages({
      'string.pattern.base': 'Email must be a valid @uomustansiriyah.edu.iq address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .pattern(passwordRegex)
    .required()
    .messages({
      'string.pattern.base': 'Password must be at least 8 characters long and contain both letters and numbers',
      'any.required': 'Password is required'
    }),
  role: Joi.string()
    .valid(...Object.values(ROLES))
    .required(),
  department: Joi.string()
    .pattern(objectIdRegex)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'Invalid department ID format'
    }),

  // Student-specific fields
  studentId: Joi.string().trim().max(50).optional(),
  stage: Joi.number().integer().min(1).max(6).optional(),
  studyType: Joi.string().valid('MORNING', 'EVENING').optional(),
  admissionYear: Joi.number().integer().min(2000).max(2100).optional(),

  // Doctor-specific fields
  employeeId: Joi.string().trim().max(50).optional(),
  academicTitle: Joi.string()
    .valid('PROFESSOR', 'ASSISTANT_PROFESSOR', 'LECTURER', 'ASSISTANT_LECTURER')
    .optional(),
  officeLocation: Joi.string().trim().max(100).optional()
});

const updateUserStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(ACCOUNT_STATUS))
    .required()
    .messages({
      'any.required': 'Account status is required',
      'any.only': 'Invalid account status value'
    })
});

const queryUsersSchema = Joi.object({
  role: Joi.string().valid(...Object.values(ROLES)).optional(),
  status: Joi.string().valid(...Object.values(ACCOUNT_STATUS)).optional(),
  department: Joi.string().pattern(objectIdRegex).optional(),
  search: Joi.string().trim().max(100).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const queryAuditLogsSchema = Joi.object({
  category: Joi.string()
    .valid('AUTH', 'GRADE', 'ATTENDANCE', 'USER_MGMT', 'FILE', 'ACADEMIC', 'SECURITY', 'SYSTEM')
    .optional(),
  status: Joi.string().valid('SUCCESS', 'FAILURE').optional(),
  userId: Joi.string().pattern(objectIdRegex).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

module.exports = {
  validate,
  validateQuery,
  loginSchema,
  changePasswordSchema,
  logoutSchema,
  createUserSchema,
  updateUserStatusSchema,
  queryUsersSchema,
  queryAuditLogsSchema
};
