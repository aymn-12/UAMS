const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const annotationSchema = Joi.object({
  pageNumber: Joi.number().integer().min(1).required(),
  noteText: Joi.string().trim().max(2000).replace(/<[^>]*>?/gm, '').allow('', null).optional(),
  highlights: Joi.array().items(Joi.string().max(50)).max(100).optional()
});

const questionSchema = Joi.object({
  sectionId: Joi.string().pattern(objectIdPattern).required(),
  questionText: Joi.string().trim().min(3).max(1000).replace(/<[^>]*>?/gm, '').required()
});

const answerSchema = Joi.object({
  answerText: Joi.string().trim().min(2).max(2000).replace(/<[^>]*>?/gm, '').required()
});

module.exports = {
  annotationSchema,
  questionSchema,
  answerSchema
};
