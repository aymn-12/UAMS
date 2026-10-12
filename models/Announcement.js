const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section'
    },
    isGeneral: {
      type: Boolean,
      default: false
    },
    expiresAt: Date
  },
  { timestamps: true }
);

announcementSchema.index({ isGeneral: 1, createdAt: -1 });
announcementSchema.index({ section: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
