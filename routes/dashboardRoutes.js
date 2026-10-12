const express = require('express');
const router = express.Router();
const {
  getStudentDashboard,
  getDoctorDashboard,
  getAdminDashboard
} = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { ROLES } = require('../config/constants');

router.use(protect);

router.get('/student', authorize(ROLES.STUDENT), getStudentDashboard);
router.get('/doctor', authorize(ROLES.DOCTOR), getDoctorDashboard);
router.get('/admin', authorize(ROLES.ADMIN), getAdminDashboard);

module.exports = router;
