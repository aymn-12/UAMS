const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    answerText: {
      type: String,
      default: ''
    },
    isAnswered: {
      type: Boolean,
      default: false
    },
    answeredAt: Date,
    answeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

questionSchema.index({ section: 1, isAnswered: 1, createdAt: -1 });

module.exports = mongoose.model('Question', questionSchema);
