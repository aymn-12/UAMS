const express = require('express');
const router = express.Router();
const { getMyProfile, getMySections, getMySchedule } = require('../controllers/studentController');
const {
  getMyPlanner,
  createPlannerItem,
  updatePlannerItem,
  deletePlannerItem,
  recordAttendance
} = require('../controllers/studentPlannerController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { ROLES } = require('../config/constants');

// All student routes require authentication and STUDENT role
router.use(protect);
router.use(authorize(ROLES.STUDENT));

// Student official academic profile & record
router.get('/profile', getMyProfile);

// Enrolled sections with schedule and credits
router.get('/sections', getMySections);

// Student personal weekly timetable (official)
router.get('/schedule', getMySchedule);

// Student Self-Managed Study Planner & Timetable
router.get('/planner', getMyPlanner);
router.post('/planner', createPlannerItem);
router.put('/planner/:id', updatePlannerItem);
router.delete('/planner/:id', deletePlannerItem);
router.patch('/planner/:id/attendance', recordAttendance);

module.exports = router;
