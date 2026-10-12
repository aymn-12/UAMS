const Announcement = require('../models/Announcement');
const Section = require('../models/Section');
const Notification = require('../models/Notification');
const { ROLES } = require('../config/constants');
const { logAction } = require('../services/auditService');

// ─────────────────────────────────────────────
// 1. Create Announcement (Doctor / Admin)
// ─────────────────────────────────────────────
const createAnnouncement = async (req, res) => {
  const { title, content, sectionId, isGeneral = false, expiresAt } = req.body;

  if (!isGeneral && !sectionId) {
    return res.status(400).json({ success: false, message: 'Please specify a section or mark as general' });
  }

  let section = null;
  if (sectionId) {
    section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Not authorized for this section' });
    }
  }

  const announcement = await Announcement.create({
    title: title.trim(),
    content: content.trim(),
    author: req.user._id,
    section: sectionId || null,
    isGeneral,
    expiresAt: expiresAt ? new Date(expiresAt) : null
  });

  // Notify students if section-specific
  if (section && section.students && section.students.length > 0) {
    setImmediate(async () => {
      try {
        const notifications = section.students.map((studentId) => ({
          recipient: studentId,
          title: `Announcement: ${announcement.title}`,
          message: announcement.content.substring(0, 100),
          type: 'ANNOUNCEMENT',
          refId: announcement._id,
          priority: 'NORMAL'
        }));
        await Notification.insertMany(notifications);
      } catch (err) {
        console.error('[Notification] Error creating announcement notifications:', err.message);
      }
    });
  }

  logAction({
    user: req.user,
    action: 'CREATE_ANNOUNCEMENT',
    category: 'ACADEMIC',
    targetEntity: 'Announcement',
    targetId: announcement._id,
    details: { sectionId, isGeneral },
    req
  });

  res.status(201).json({
    success: true,
    message: 'Announcement published successfully',
    data: announcement
  });
};

// ─────────────────────────────────────────────
// 2. Get Announcements Feed
// ─────────────────────────────────────────────
const getAnnouncements = async (req, res) => {
  const { page = 1, limit = 20, sectionId } = req.query;

  let query = {};

  if (sectionId) {
    query.section = sectionId;
  } else if (req.user.role === ROLES.STUDENT) {
    const sections = await Section.find({ students: req.user._id, isClosed: false }).select('_id').lean();
    const enrolledSectionIds = sections.map((s) => s._id);
    query = {
      $or: [{ isGeneral: true }, { section: { $in: enrolledSectionIds } }]
    };
  } else if (req.user.role === ROLES.DOCTOR) {
    const sections = await Section.find({ doctor: req.user._id, isClosed: false }).select('_id').lean();
    const doctorSectionIds = sections.map((s) => s._id);
    query = {
      $or: [{ isGeneral: true }, { section: { $in: doctorSectionIds } }]
    };
  } else {
    // Admin sees all
    query = {};
  }

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  const [announcements, total] = await Promise.all([
    Announcement.find(query)
      .select('title content isGeneral expiresAt createdAt author section')
      .populate('author', 'name email role')
      .populate({
        path: 'section',
        select: 'sectionNumber course',
        populate: { path: 'course', select: 'name code' }
      })
      .skip(skip)
      .limit(parsedLimit)
      .sort({ createdAt: -1 })
      .lean(),
    Announcement.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parsedLimit);

  res.status(200).json({
    success: true,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
    hasPrevPage: parsedPage > 1,
    hasNextPage: parsedPage < totalPages,
    count: announcements.length,
    data: announcements
  });
};

// ─────────────────────────────────────────────
// 3. Delete Announcement (Author / Admin)
// ─────────────────────────────────────────────
const deleteAnnouncement = async (req, res) => {
  const { id } = req.params;

  const announcement = await Announcement.findById(id);
  if (!announcement) {
    return res.status(404).json({ success: false, message: 'Announcement not found' });
  }

  const isAuthor = announcement.author.toString() === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this announcement' });
  }

  await Announcement.findByIdAndDelete(id);

  logAction({
    user: req.user,
    action: 'DELETE_ANNOUNCEMENT',
    category: 'ACADEMIC',
    targetEntity: 'Announcement',
    targetId: id,
    req
  });

  res.status(200).json({ success: true, message: 'Announcement deleted successfully' });
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement
};
