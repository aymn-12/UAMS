const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// Get my notifications (supports ?unreadOnly=true&type=...&priority=...)
router.get('/my-notifications', getMyNotifications);

// Mark notification as read
router.put('/:id/read', markAsRead);

// Mark all as read
router.put('/mark-all-read', markAllAsRead);

// Delete single notification
router.delete('/:id', deleteNotification);

// Clear all read notifications
router.delete('/clear-read', clearReadNotifications);

module.exports = router;
