const StudentPlannerItem = require('../models/StudentPlannerItem');

// ─────────────────────────────────────────────
// 1. Get all planner items for current student
// ─────────────────────────────────────────────
const getMyPlanner = async (req, res) => {
  const items = await StudentPlannerItem.find({ student: req.user._id })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: items.length,
    data: items
  });
};

// ─────────────────────────────────────────────
// 2. Create new custom subject
// ─────────────────────────────────────────────
const createPlannerItem = async (req, res) => {
  const {
    subjectName,
    dayOfWeek,
    startTime,
    endTime,
    room,
    doctorName,
    color,
    notes,
    notificationsEnabled,
    reminderMinutesBefore,
    maxAllowedAbsences
  } = req.body;

  if (!subjectName || !subjectName.trim()) {
    return res.status(400).json({ success: false, message: 'اسم المادة مطلوب' });
  }

  if (!dayOfWeek || !startTime) {
    return res.status(400).json({ success: false, message: 'اليوم والوقت مطلوبان' });
  }

  const item = await StudentPlannerItem.create({
    student: req.user._id,
    subjectName: subjectName.trim(),
    dayOfWeek: dayOfWeek.toUpperCase(),
    startTime,
    endTime: endTime || '',
    room: (room || '').trim(),
    doctorName: (doctorName || '').trim(),
    color: color || 'emerald',
    notes: (notes || '').trim(),
    notificationsEnabled: notificationsEnabled !== undefined ? Boolean(notificationsEnabled) : true,
    reminderMinutesBefore: Number(reminderMinutesBefore) || 15,
    maxAllowedAbsences: Number(maxAllowedAbsences) || 4,
    attendanceCount: 0,
    absenceCount: 0
  });

  res.status(201).json({
    success: true,
    message: 'تمت إضافة المادة إلى جدولك الذاتي بنجاح',
    data: item
  });
};

// ─────────────────────────────────────────────
// 3. Update existing custom subject
// ─────────────────────────────────────────────
const updatePlannerItem = async (req, res) => {
  const { id } = req.params;
  const item = await StudentPlannerItem.findOne({ _id: id, student: req.user._id });

  if (!item) {
    return res.status(404).json({ success: false, message: 'المادة غير موجودة' });
  }

  const fields = [
    'subjectName',
    'dayOfWeek',
    'startTime',
    'endTime',
    'room',
    'doctorName',
    'color',
    'notes',
    'notebook',
    'notificationsEnabled',
    'reminderMinutesBefore',
    'maxAllowedAbsences'
  ];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (field === 'dayOfWeek') {
        item.dayOfWeek = req.body.dayOfWeek.toUpperCase();
      } else if (typeof req.body[field] === 'string') {
        item[field] = req.body[field].trim();
      } else {
        item[field] = req.body[field];
      }
    }
  });

  await item.save();

  res.status(200).json({
    success: true,
    message: 'تم تحديث بيانات المادة بنجاح',
    data: item
  });
};

// ─────────────────────────────────────────────
// 4. Delete custom subject
// ─────────────────────────────────────────────
const deletePlannerItem = async (req, res) => {
  const { id } = req.params;
  const item = await StudentPlannerItem.findOneAndDelete({ _id: id, student: req.user._id });

  if (!item) {
    return res.status(404).json({ success: false, message: 'المادة غير موجودة' });
  }

  res.status(200).json({
    success: true,
    message: 'تم حذف المادة من جدولك بنجاح'
  });
};

// ─────────────────────────────────────────────
// 5. Update attendance / absence counters
// ─────────────────────────────────────────────
const recordAttendance = async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'ATTEND', 'ABSENT', 'RESET'

  const item = await StudentPlannerItem.findOne({ _id: id, student: req.user._id });
  if (!item) {
    return res.status(404).json({ success: false, message: 'المادة غير موجودة' });
  }

  if (action === 'ATTEND') {
    item.attendanceCount += 1;
  } else if (action === 'ABSENT') {
    item.absenceCount += 1;
  } else if (action === 'RESET') {
    item.attendanceCount = 0;
    item.absenceCount = 0;
  } else {
    return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
  }

  await item.save();

  res.status(200).json({
    success: true,
    message: 'تم تحديث سجل الحضور بنجاح',
    data: item
  });
};

module.exports = {
  getMyPlanner,
  createPlannerItem,
  updatePlannerItem,
  deletePlannerItem,
  recordAttendance
};
