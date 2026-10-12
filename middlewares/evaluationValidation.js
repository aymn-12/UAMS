const Joi = require('joi');
const { EXAM_TYPES } = require('../config/constants');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createAssignmentSchema = Joi.object({
  sectionId: Joi.string().pattern(objectIdPattern).required(),
  title: Joi.string().trim().min(3).max(150).required(),
  description: Joi.string().allow('', null).optional(),
  deadline: Joi.date().iso().required(),
  maxScore: Joi.number().positive().max(100).default(10),
  allowLate: Joi.boolean().default(false),
  attachments: Joi.array().items(
    Joi.object({
      fileName: Joi.string().required(),
      fileUrl: Joi.string().required(),
      fileSize: Joi.number().optional()
    })
  ).optional()
});

const submitAssignmentSchema = Joi.object({
  submittedFiles: Joi.array().items(
    Joi.object({
      fileName: Joi.string().required(),
      fileUrl: Joi.string().required(),
      fileSize: Joi.number().optional()
    })
  ).optional(),
  studentNotes: Joi.string().allow('', null).optional(),
  submissionText: Joi.string().allow('', null).optional(),
  attachmentUrl: Joi.string().allow('', null).optional(),
  comments: Joi.string().allow('', null).optional()
}).or('submittedFiles', 'submissionText', 'attachmentUrl', 'comments');

const gradeSubmissionSchema = Joi.object({
  score: Joi.number().min(0).required(),
  doctorFeedback: Joi.string().allow('', null).optional()
});

const createExamSchema = Joi.object({
  sectionId: Joi.string().pattern(objectIdPattern).required(),
  title: Joi.string().trim().min(3).max(150).required(),
  type: Joi.string().valid(...Object.values(EXAM_TYPES)).required(),
  examDate: Joi.date().iso().required(),
  startTime: Joi.string().optional(),
  durationMinutes: Joi.number().integer().min(10).max(300).optional(),
  location: Joi.string().allow('', null).optional(),
  maxScore: Joi.number().positive().max(100).default(100),
  weightPercentage: Joi.number().positive().max(100).required(),
  instructions: Joi.string().allow('', null).optional()
});

const recordGradesSchema = Joi.object({
  grades: Joi.array().items(
    Joi.object({
      studentId: Joi.string().pattern(objectIdPattern).required(),
      score: Joi.number().min(0).required(),
      notes: Joi.string().allow('', null).optional()
    })
  ).min(1).required()
});

module.exports = {
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
  createExamSchema,
  recordGradesSchema
};
