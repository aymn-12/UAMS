const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const CourseMaterial = require('../models/CourseMaterial');
const Section = require('../models/Section');
const { ROLES } = require('../config/constants');
const { logAction } = require('../services/auditService');

// ─────────────────────────────────────────────
// 1. Get Section Materials & Lectures
// ─────────────────────────────────────────────
const getSectionMaterials = async (req, res) => {
  const { sectionId } = req.params;
  const { isLecture } = req.query;

  if (!mongoose.Types.ObjectId.isValid(sectionId)) {
    return res.status(400).json({ success: false, message: 'Invalid section ID format' });
  }

  const section = await Section.findById(sectionId).select('doctor students').lean();
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  // Enrollment check
  const isDoctor = section.doctor.toString() === req.user._id.toString();
  const isEnrolled = section.students.some((s) => s.toString() === req.user._id.toString());
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isAdmin && !isDoctor && !isEnrolled) {
    return res.status(403).json({ success: false, message: 'Not authorized to view materials for this section' });
  }

  const query = { section: sectionId };
  if (isLecture !== undefined) {
    query.isLecture = isLecture === 'true' || isLecture === true;
  }

  const materials = await CourseMaterial.find(query)
    .populate('uploadedBy', 'name email')
    .sort({ lectureDate: -1, createdAt: -1 })
    .lean();

  // If student, enrich with annotation flags without exposing other students' private notes
  const studentIdStr = req.user._id.toString();
  const enriched = materials.map((m) => {
    const studentNotes = (m.studentAnnotations || []).filter(
      (a) => a.student && a.student.toString() === studentIdStr
    );

    const { studentAnnotations, ...rest } = m;

    return {
      ...rest,
      hasPersonalNotes: studentNotes.length > 0,
      personalNotesCount: studentNotes.length
    };
  });

  res.status(200).json({
    success: true,
    count: enriched.length,
    data: enriched
  });
};

// ─────────────────────────────────────────────
// 2. Save / Update Student Personal Annotation
// ─────────────────────────────────────────────
const saveStudentAnnotation = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid material ID format' });
  }

  const { pageNumber, noteText, highlights } = req.body;
  const material = await CourseMaterial.findById(req.params.id);

  if (!material) {
    return res.status(404).json({ success: false, message: 'Material not found' });
  }

  const section = await Section.findById(material.section).select('students').lean();
  const isEnrolled = section && section.students.some((s) => s.toString() === req.user._id.toString());
  if (!isEnrolled) {
    return res.status(403).json({ success: false, message: 'Not enrolled in this section' });
  }

  // Find existing annotation for this student and page
  const existingIndex = material.studentAnnotations.findIndex(
    (a) => a.student.toString() === req.user._id.toString() && a.pageNumber === pageNumber
  );

  if (existingIndex > -1) {
    material.studentAnnotations[existingIndex].noteText =
      noteText !== undefined ? noteText.trim() : material.studentAnnotations[existingIndex].noteText;
    material.studentAnnotations[existingIndex].highlights =
      highlights || material.studentAnnotations[existingIndex].highlights;
    material.studentAnnotations[existingIndex].updatedAt = new Date();
  } else {
    material.studentAnnotations.push({
      student: req.user._id,
      pageNumber,
      noteText: noteText ? noteText.trim() : '',
      highlights: highlights || []
    });
  }

  await material.save();

  res.status(200).json({
    success: true,
    message: 'Personal note saved successfully',
    data: { pageNumber, noteText, highlights }
  });
};

// ─────────────────────────────────────────────
// 3. Get Student's Own Annotations for a Document
// ─────────────────────────────────────────────
const getMyAnnotations = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid material ID format' });
  }

  const material = await CourseMaterial.findById(req.params.id)
    .select('studentAnnotations title')
    .lean();

  if (!material) {
    return res.status(404).json({ success: false, message: 'Material not found' });
  }

  // Strictly filter only annotations belonging to the authenticated student
  const studentIdStr = req.user._id.toString();
  const myAnnotations = (material.studentAnnotations || []).filter(
    (a) => a.student && a.student.toString() === studentIdStr
  );

  res.status(200).json({
    success: true,
    materialTitle: material.title,
    count: myAnnotations.length,
    data: myAnnotations
  });
};

// ─────────────────────────────────────────────
// 4. Delete Student Personal Annotation
// ─────────────────────────────────────────────
const deleteStudentAnnotation = async (req, res) => {
  const { id, annotationId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(annotationId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  const material = await CourseMaterial.findById(id);
  if (!material) {
    return res.status(404).json({ success: false, message: 'Material not found' });
  }

  const initialCount = material.studentAnnotations.length;
  material.studentAnnotations = material.studentAnnotations.filter(
    (a) => !(a._id.toString() === annotationId && a.student.toString() === req.user._id.toString())
  );

  if (material.studentAnnotations.length === initialCount) {
    return res.status(404).json({ success: false, message: 'Annotation not found or not owned by you' });
  }

  await material.save();

  res.status(200).json({ success: true, message: 'Personal note deleted successfully' });
};

// ─────────────────────────────────────────────
// 5. Delete Course Material (Doctor / Admin)
// ─────────────────────────────────────────────
const deleteMaterial = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid material ID format' });
  }

  const material = await CourseMaterial.findById(id);
  if (!material) {
    return res.status(404).json({ success: false, message: 'Material not found' });
  }

  const section = await Section.findById(material.section).select('doctor').lean();
  if (section && section.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this material' });
  }

  // Delete physical file on disk if exists
  const relativeFile = material.fileUrl.replace(/^\/uploads\//, '');
  const physicalPath = path.resolve(process.cwd(), 'uploads', relativeFile);
  if (fs.existsSync(physicalPath)) {
    try {
      fs.unlinkSync(physicalPath);
    } catch (e) {
      console.warn('[Storage] Could not remove physical file:', e.message);
    }
  }

  await CourseMaterial.findByIdAndDelete(id);

  logAction({
    user: req.user,
    action: 'DELETE_MATERIAL',
    category: 'FILE',
    targetEntity: 'CourseMaterial',
    targetId: id,
    req
  });

  res.status(200).json({ success: true, message: 'Material deleted successfully' });
};

module.exports = {
  getSectionMaterials,
  saveStudentAnnotation,
  getMyAnnotations,
  deleteStudentAnnotation,
  deleteMaterial
};
