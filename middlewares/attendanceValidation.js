const Joi = require('joi');
const { ATTENDANCE_STATUS } = require('../config/constants');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createSessionSchema = Joi.object({
  sectionId: Joi.string().pattern(objectIdPattern).required(),
  sessionTitle: Joi.string().trim().max(100).optional(),
  sessionType: Joi.string().optional(),
  // Flexible duration: from 5 minutes up to 24 hours (1440 mins). Default is 180 mins.
  durationMinutes: Joi.number().integer().min(5).max(1440).default(180),
  geoFence: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radiusMeters: Joi.number().positive().max(2000).default(100)
  }).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  radiusMeters: Joi.number().positive().max(2000).optional()
});

const checkInSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'QR attendance token is required'
  }),
  deviceId: Joi.string().trim().min(3).max(150).optional().default('web-client'),
  isBiometricVerified: Joi.boolean().default(false),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  }).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  sessionId: Joi.string().optional()
});

const manualUpdateRecordSchema = Joi.object({
  status: Joi.string().valid(...Object.values(ATTENDANCE_STATUS)).required().messages({
    'any.required': 'Attendance status is required',
    'any.only': 'Invalid attendance status'
  }),
  modificationReason: Joi.string().trim().min(5).max(300).required().messages({
    'any.required': 'Official reason must be provided for audit tracking',
    'string.min': 'Reason must be at least 5 characters long'
  })
});

const queryAttendanceOverviewSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});

module.exports = {
  createSessionSchema,
  checkInSchema,
  manualUpdateRecordSchema,
  queryAttendanceOverviewSchema
};
