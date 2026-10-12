const express = require('express');
const router = express.Router();
const {
  exportAttendanceExcel,
  exportGradesExcel
} = require('../controllers/reportController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { ROLES } = require('../config/constants');

router.use(protect);
router.use(authorize(ROLES.DOCTOR, ROLES.ADMIN));

router.get('/attendance/:sectionId/excel', exportAttendanceExcel);
router.get('/grades/:sectionId/excel', exportGradesExcel);

module.exports = router;
