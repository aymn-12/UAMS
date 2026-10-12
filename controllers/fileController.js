const path = require('path');
const fs = require('fs');
const CourseMaterial = require('../models/CourseMaterial');
const Section = require('../models/Section');
const Notification = require('../models/Notification');
const { ROLES } = require('../config/constants');
const { logAction } = require('../services/auditService');

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

// ─────────────────────────────────────────────
// 1. Upload Course Material / Lecture (Doctor / Admin)
// ─────────────────────────────────────────────
const uploadMaterial = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please attach a document file' });
  }

  const { sectionId, title, description, isLecture, lectureDate } = req.body;

  const section = await Section.findById(sectionId);
  if (!section) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'Cannot upload materials to a closed section' });
  }

  if (section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ success: false, message: 'Not authorized for this section' });
  }

  const material = await CourseMaterial.create({
    section: sectionId,
    uploadedBy: req.user._id,
    title: title ? title.trim() : req.file.originalname,
    description: description ? description.trim() : '',
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
    isLecture: isLecture !== undefined ? (isLecture === 'true' || isLecture === true) : true,
    lectureDate: lectureDate ? new Date(lectureDate) : new Date()
  });

  // Notify enrolled students asynchronously
  setImmediate(async () => {
    try {
      if (section.students && section.students.length > 0) {
        const notifications = section.students.map((studentId) => ({
          recipient: studentId,
          title: `New Material: ${material.title}`,
          message: `New lecture material has been uploaded to section ${section.sectionNumber}`,
          type: 'GENERAL',
          refId: material._id,
          priority: 'NORMAL'
        }));
        await Notification.insertMany(notifications);
      }
    } catch (err) {
      console.error('[Notification] Error creating material notifications:', err.message);
    }
  });

  logAction({
    user: req.user,
    action: 'UPLOAD_MATERIAL',
    category: 'FILE',
    targetEntity: 'CourseMaterial',
    targetId: material._id,
    details: { sectionId, fileName: req.file.originalname, fileSize: req.file.size },
    req
  });

  res.status(201).json({
    success: true,
    message: 'Material uploaded and published successfully',
    data: material
  });
};

// ─────────────────────────────────────────────
// 2. Secure File Access / Download
// ─────────────────────────────────────────────
const accessMaterialFile = async (req, res) => {
  const material = await CourseMaterial.findById(req.params.id);
  if (!material) {
    return res.status(404).json({ success: false, message: 'Material not found' });
  }

  const section = await Section.findById(material.section).select('doctor students').lean();
  if (!section) {
    return res.status(404).json({ success: false, message: 'Associated section not found' });
  }

  // Authorization check: Admin, Doctor of section, or Enrolled Student
  const isDoctor = section.doctor.toString() === req.user._id.toString();
  const isEnrolled = section.students.some((s) => s.toString() === req.user._id.toString());
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isAdmin && !isDoctor && !isEnrolled) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You are not enrolled in this section'
    });
  }

  // Path Traversal Security: Ensure the file path stays strictly inside UPLOAD_ROOT
  const relativeFile = material.fileUrl.replace(/^\/uploads\//, '');
  const resolvedPath = path.resolve(UPLOAD_ROOT, relativeFile);

  if (!resolvedPath.startsWith(UPLOAD_ROOT)) {
    return res.status(403).json({ success: false, message: 'Security violation: Invalid file path' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ success: false, message: 'Physical file not found on disk' });
  }

  // If download query is specified, force browser download dialog; otherwise stream inline
  const shouldDownload = req.query.download === 'true';

  if (shouldDownload) {
    return res.download(resolvedPath, material.fileName);
  }

  res.setHeader('Content-Type', material.fileType || 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(material.fileName || 'document.pdf')}"`);
  return res.sendFile(resolvedPath);
};

module.exports = {
  uploadMaterial,
  accessMaterialFile
};
