const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement
} = require('../controllers/announcementController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { ROLES } = require('../config/constants');

router.use(protect);

// Create announcement (Doctor for section, Admin for all/section)
router.post('/', authorize(ROLES.DOCTOR, ROLES.ADMIN), createAnnouncement);

// Get announcements feed
router.get('/', getAnnouncements);

// Delete announcement
router.delete('/:id', authorize(ROLES.DOCTOR, ROLES.ADMIN), deleteAnnouncement);

module.exports = router;
