const express = require('express');
const router = express.Router();
const {
  getMySections,
  getSectionRoster,
  getMySchedule
} = require('../controllers/doctorController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { ROLES } = require('../config/constants');

// All doctor routes require authentication and DOCTOR role
router.use(protect);
router.use(authorize(ROLES.DOCTOR));

// Doctor assigned sections
router.get('/sections', getMySections);

// Doctor student roster for a specific section
router.get('/sections/:id/students', getSectionRoster);

// Doctor weekly timetable
router.get('/schedule', getMySchedule);

module.exports = router;
