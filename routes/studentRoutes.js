const express = require('express');
const router = express.Router();
const { getMyProfile, getMySections, getMySchedule } = require('../controllers/studentController');
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

// Student personal weekly timetable
router.get('/schedule', getMySchedule);

module.exports = router;
