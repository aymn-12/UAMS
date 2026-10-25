const mongoose = require('mongoose');

const studentPlannerItemSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    subjectName: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true
    },
    dayOfWeek: {
      type: String,
      enum: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      required: true
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format']
    },
    endTime: {
      type: String,
      default: '',
      match: [/^$|^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format if provided']
    },
    room: {
      type: String,
      default: '',
      trim: true
    },
    doctorName: {
      type: String,
      default: '',
      trim: true
    },
    color: {
      type: String,
      enum: ['emerald', 'blue', 'purple', 'amber', 'rose', 'indigo'],
      default: 'emerald'
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    notebook: {
      currentPage: { type: String, default: '' },
      exams: [
        {
          id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
          title: { type: String, trim: true },
          date: { type: String, default: '' },
          completed: { type: Boolean, default: false }
        }
      ],
      quizzes: [
        {
          id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
          title: { type: String, trim: true },
          date: { type: String, default: '' },
          completed: { type: Boolean, default: false }
        }
      ],
      assignments: [
        {
          id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
          title: { type: String, trim: true },
          date: { type: String, default: '' },
          completed: { type: Boolean, default: false }
        }
      ],
      reports: [
        {
          id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
          title: { type: String, trim: true },
          page: { type: String, default: '' },
          completed: { type: Boolean, default: false }
        }
      ],
      notesList: [
        {
          id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
          text: { type: String, trim: true },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      files: [
        {
          id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
          name: { type: String, trim: true },
          url: { type: String, default: '' },
          size: { type: String, default: '' },
          uploadedAt: { type: Date, default: Date.now }
        }
      ]
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    reminderMinutesBefore: {
      type: Number,
      default: 15
    },
    attendanceCount: {
      type: Number,
      default: 0,
      min: 0
    },
    absenceCount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxAllowedAbsences: {
      type: Number,
      default: 4,
      min: 1
    }
  },
  { timestamps: true }
);

studentPlannerItemSchema.index({ student: 1, dayOfWeek: 1, startTime: 1 });

module.exports = mongoose.model('StudentPlannerItem', studentPlannerItemSchema);
