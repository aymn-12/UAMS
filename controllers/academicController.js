const mongoose = require('mongoose');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Section = require('../models/Section');
const ScheduleSlot = require('../models/ScheduleSlot');
const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { logAction } = require('../services/auditService');

// Helper to convert "HH:MM" to minutes for interval overlap check
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Check if two time intervals [s1, e1] and [s2, e2] overlap
const isOverlapping = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;

// ─────────────────────────────────────────────
// 1. Departments Management
// ─────────────────────────────────────────────
const createDepartment = async (req, res) => {
  const { name, code, college, description, headOfDepartment } = req.body;
  const upperCode = code.toUpperCase().trim();

  const exists = await Department.findOne({ code: upperCode }).lean();
  if (exists) {
    return res.status(409).json({ success: false, message: 'Department code already exists' });
  }

  if (headOfDepartment) {
    const headUser = await User.findOne({ _id: headOfDepartment, isDeleted: false }).lean();
    if (!headUser || headUser.role !== ROLES.DOCTOR) {
      return res.status(400).json({ success: false, message: 'Head of department must be an active faculty doctor' });
    }
  }

  const dept = await Department.create({
    name: name.trim(),
    code: upperCode,
    college: college.trim(),
    description: description ? description.trim() : '',
    headOfDepartment: headOfDepartment || null
  });

  logAction({
    user: req.user,
    action: 'CREATE_DEPARTMENT',
    category: 'ACADEMIC',
    targetEntity: 'Department',
    targetId: dept._id,
    req
  });

  res.status(201).json({ success: true, data: dept });
};

const getDepartments = async (req, res) => {
  const depts = await Department.find({ isDeleted: false })
    .select('name code college description headOfDepartment createdAt')
    .populate('headOfDepartment', 'name email')
    .sort({ name: 1 })
    .lean();

  res.status(200).json({ success: true, count: depts.length, data: depts });
};

const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const dept = await Department.findOne({ _id: id, isDeleted: false });

  if (!dept) {
    return res.status(404).json({ success: false, message: 'Department not found' });
  }

  const { name, college, description, headOfDepartment } = req.body;
  if (name) dept.name = name.trim();
  if (college) dept.college = college.trim();
  if (description !== undefined) dept.description = description.trim();

  if (headOfDepartment !== undefined) {
    if (headOfDepartment) {
      const headUser = await User.findOne({ _id: headOfDepartment, isDeleted: false }).lean();
      if (!headUser || headUser.role !== ROLES.DOCTOR) {
        return res.status(400).json({ success: false, message: 'Head of department must be an active faculty doctor' });
      }
      dept.headOfDepartment = headOfDepartment;
    } else {
      dept.headOfDepartment = null;
    }
  }

  await dept.save();

  logAction({
    user: req.user,
    action: 'UPDATE_DEPARTMENT',
    category: 'ACADEMIC',
    targetEntity: 'Department',
    targetId: dept._id,
    req
  });

  res.status(200).json({ success: true, message: 'Department updated successfully', data: dept });
};

// ─────────────────────────────────────────────
// 2. Courses Management
// ─────────────────────────────────────────────
const createCourse = async (req, res) => {
  const { name, code, department, stage, credits, description } = req.body;
  const upperCode = code.toUpperCase().trim();

  const deptExists = await Department.findOne({ _id: department, isDeleted: false }).lean();
  if (!deptExists) {
    return res.status(404).json({ success: false, message: 'Referenced department not found or is inactive' });
  }

  const exists = await Course.findOne({ code: upperCode, isDeleted: false }).lean();
  if (exists) {
    return res.status(409).json({ success: false, message: 'Course with this code already exists' });
  }

  const course = await Course.create({
    name: name.trim(),
    code: upperCode,
    department,
    stage,
    credits,
    description: description ? description.trim() : ''
  });

  logAction({
    user: req.user,
    action: 'CREATE_COURSE',
    category: 'ACADEMIC',
    targetEntity: 'Course',
    targetId: course._id,
    req
  });

  res.status(201).json({ success: true, data: course });
};

const getCourses = async (req, res) => {
  const { department, stage, search, page = 1, limit = 50 } = req.query;
  const filter = { isDeleted: false };

  if (department) filter.department = department;
  if (stage) filter.stage = Number(stage);

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { code: { $regex: escaped, $options: 'i' } }
    ];
  }

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select('name code department stage credits description createdAt')
      .populate('department', 'name code college')
      .skip(skip)
      .limit(parsedLimit)
      .sort({ stage: 1, code: 1 })
      .lean(),
    Course.countDocuments(filter)
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
    data: courses
  });
};

// ─────────────────────────────────────────────
// 3. Sections Management
// ─────────────────────────────────────────────
const createSection = async (req, res) => {
  const {
    course,
    sectionNumber,
    doctor,
    semester,
    academicYear,
    capacity = 60,
    maxAbsenceHours = 6
  } = req.body;

  const normalizedSection = sectionNumber.toUpperCase().trim();
  const normalizedSemester = semester.toUpperCase().trim();
  const normalizedYear = academicYear.trim();

  // Validate course
  const courseExists = await Course.findOne({ _id: course, isDeleted: false }).lean();
  if (!courseExists) {
    return res.status(404).json({ success: false, message: 'Referenced course not found or is deleted' });
  }

  // Validate doctor
  const doctorUser = await User.findOne({ _id: doctor, isDeleted: false }).lean();
  if (!doctorUser || doctorUser.role !== ROLES.DOCTOR) {
    return res.status(400).json({ success: false, message: 'Assigned user is not an active doctor' });
  }

  // Check section uniqueness
  const duplicateSection = await Section.findOne({
    course,
    sectionNumber: normalizedSection,
    academicYear: normalizedYear,
    semester: normalizedSemester
  }).lean();

  if (duplicateSection) {
    return res.status(409).json({
      success: false,
      message: `Section ${normalizedSection} already exists for this course in semester ${normalizedSemester} (${normalizedYear})`
    });
  }

  const section = await Section.create({
    course,
    sectionNumber: normalizedSection,
    doctor,
    semester: normalizedSemester,
    academicYear: normalizedYear,
    capacity,
    maxAbsenceHours
  });

  logAction({
    user: req.user,
    action: 'CREATE_SECTION',
    category: 'ACADEMIC',
    targetEntity: 'Section',
    targetId: section._id,
    req
  });

  res.status(201).json({ success: true, data: section });
};

const getSections = async (req, res) => {
  const { course, doctor, semester, academicYear, isClosed, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (course) filter.course = course;
  if (doctor) filter.doctor = doctor;
  if (semester) filter.semester = semester.toUpperCase();
  if (academicYear) filter.academicYear = academicYear;
  if (isClosed !== undefined) filter.isClosed = isClosed === 'true' || isClosed === true;

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  const [sections, total] = await Promise.all([
    Section.find(filter)
      .populate('course', 'name code stage credits')
      .populate('doctor', 'name email')
      .skip(skip)
      .limit(parsedLimit)
      .sort({ academicYear: -1, semester: 1, sectionNumber: 1 })
      .lean(),
    Section.countDocuments(filter)
  ]);

  // Enrich with enrolledCount and availableSeats
  const enriched = sections.map((s) => ({
    ...s,
    enrolledCount: s.students ? s.students.length : 0,
    availableSeats: Math.max(0, (s.capacity || 60) - (s.students ? s.students.length : 0))
  }));

  const totalPages = Math.ceil(total / parsedLimit);

  res.status(200).json({
    success: true,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
    data: enriched
  });
};

const enrollStudents = async (req, res) => {
  const { studentIds } = req.body;
  const sectionId = req.params.id;

  const section = await Section.findById(sectionId);
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({
      success: false,
      message: 'Cannot enroll students into a closed or completed section'
    });
  }

  // Check capacity limits
  const currentCount = section.students ? section.students.length : 0;
  const availableSeats = section.capacity - currentCount;

  if (studentIds.length > availableSeats) {
    return res.status(400).json({
      success: false,
      message: `Enrollment exceeds section capacity. Available seats: ${availableSeats}, attempted: ${studentIds.length}`
    });
  }

  // Validate students
  const validStudents = await User.find({
    _id: { $in: studentIds },
    role: ROLES.STUDENT,
    isDeleted: false
  }).select('_id').lean();

  if (validStudents.length !== studentIds.length) {
    return res.status(400).json({
      success: false,
      message: 'One or more IDs do not belong to active enrolled students'
    });
  }

  // Atomic enrollment using $addToSet
  const updatedSection = await Section.findByIdAndUpdate(
    sectionId,
    { $addToSet: { students: { $each: studentIds } } },
    { new: true }
  )
    .populate('course', 'name code')
    .populate('doctor', 'name email')
    .lean();

  logAction({
    user: req.user,
    action: 'ENROLL_STUDENTS',
    category: 'ACADEMIC',
    targetEntity: 'Section',
    targetId: section._id,
    details: { newlyEnrolled: studentIds.length, totalEnrolled: updatedSection.students.length },
    req
  });

  res.status(200).json({
    success: true,
    message: `${studentIds.length} student(s) successfully enrolled`,
    data: {
      sectionId: updatedSection._id,
      enrolledCount: updatedSection.students.length,
      availableSeats: Math.max(0, updatedSection.capacity - updatedSection.students.length)
    }
  });
};

const unenrollStudent = async (req, res) => {
  const { studentId } = req.body;
  const sectionId = req.params.id;

  const section = await Section.findById(sectionId);
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({
      success: false,
      message: 'Cannot modify student roster in a closed section'
    });
  }

  const updatedSection = await Section.findByIdAndUpdate(
    sectionId,
    { $pull: { students: studentId } },
    { new: true }
  ).lean();

  logAction({
    user: req.user,
    action: 'UNENROLL_STUDENT',
    category: 'ACADEMIC',
    targetEntity: 'Section',
    targetId: section._id,
    details: { studentId },
    req
  });

  res.status(200).json({
    success: true,
    message: 'Student unenrolled successfully',
    data: {
      sectionId: updatedSection._id,
      enrolledCount: updatedSection.students.length,
      availableSeats: Math.max(0, updatedSection.capacity - updatedSection.students.length)
    }
  });
};

// ─────────────────────────────────────────────
// 4. Timetable & Schedule Management (Flexible Classroom Style)
// ─────────────────────────────────────────────
const addScheduleSlot = async (req, res) => {
  const { sectionId, dayOfWeek, startTime, endTime, room, building } = req.body;

  const section = await Section.findById(sectionId).lean();
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }

  if (section.isClosed) {
    return res.status(400).json({ success: false, message: 'Cannot add schedule slots to a closed section' });
  }

  const normalizedRoom = room ? room.trim() : 'ONLINE';
  const normalizedBuilding = building ? building.trim() : 'GENERAL';

  const slot = await ScheduleSlot.create({
    section: sectionId,
    dayOfWeek: dayOfWeek.toUpperCase(),
    startTime,
    endTime: endTime || '',
    room: normalizedRoom,
    building: normalizedBuilding
  });

  logAction({
    user: req.user,
    action: 'ADD_SCHEDULE_SLOT',
    category: 'ACADEMIC',
    targetEntity: 'ScheduleSlot',
    targetId: slot._id,
    details: { sectionId, dayOfWeek, startTime, endTime, room: normalizedRoom },
    req
  });

  res.status(201).json({ success: true, message: 'Schedule slot added successfully', data: slot });
};

const getScheduleByDay = async (req, res) => {
  const { day } = req.query;
  const userId = req.user._id;
  const role = req.user.role;

  let sectionIds = [];
  if (role === ROLES.STUDENT) {
    const sections = await Section.find({ students: userId, isClosed: false }).select('_id').lean();
    sectionIds = sections.map((s) => s._id);
  } else if (role === ROLES.DOCTOR) {
    const sections = await Section.find({ doctor: userId, isClosed: false }).select('_id').lean();
    sectionIds = sections.map((s) => s._id);
  } else {
    // Admin sees all active sections
    const sections = await Section.find({ isClosed: false }).select('_id').lean();
    sectionIds = sections.map((s) => s._id);
  }

  const filter = { section: { $in: sectionIds } };
  if (day) filter.dayOfWeek = day.toUpperCase();

  const slots = await ScheduleSlot.find(filter)
    .populate({
      path: 'section',
      select: 'sectionNumber course doctor semester academicYear',
      populate: [
        { path: 'course', select: 'name code stage credits' },
        { path: 'doctor', select: 'name email' }
      ]
    })
    .sort({ startTime: 1 })
    .lean();

  res.status(200).json({ success: true, count: slots.length, data: slots });
};

const getSectionSchedule = async (req, res) => {
  const sectionId = req.params.id;
  const slots = await ScheduleSlot.find({ section: sectionId })
    .populate({
      path: 'section',
      select: 'sectionNumber course doctor',
      populate: [
        { path: 'course', select: 'name code' },
        { path: 'doctor', select: 'name email' }
      ]
    })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  res.status(200).json({ success: true, count: slots.length, data: slots });
};

module.exports = {
  createDepartment,
  getDepartments,
  updateDepartment,
  createCourse,
  getCourses,
  createSection,
  getSections,
  enrollStudents,
  unenrollStudent,
  addScheduleSlot,
  getScheduleByDay,
  getSectionSchedule
};
