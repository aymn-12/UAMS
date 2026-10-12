const Notification = require('../models/Notification');

// @desc    Get current user notifications
// @route   GET /api/notifications/my-notifications
// @access  Private
const getMyNotifications = async (req, res) => {
  const { page = 1, limit = 20, unreadOnly, type, priority } = req.query;
  const query = { recipient: req.user._id };

  if (unreadOnly === 'true') {
    query.isRead = false;
  }

  if (type) {
    query.type = type.toUpperCase();
  }

  if (priority) {
    query.priority = priority.toUpperCase();
  }

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .select('title message type priority link refId isRead createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: req.user._id, isRead: false })
  ]);

  const totalPages = Math.ceil(total / parsedLimit);

  res.status(200).json({
    success: true,
    total,
    unreadCount,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
    hasPrevPage: parsedPage > 1,
    hasNextPage: parsedPage < totalPages,
    data: notifications
  });
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id
  });

  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
  res.status(200).json({ success: true, message: 'All notifications marked as read' });
};

// @desc    Delete single notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id
  });

  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  res.status(200).json({ success: true, message: 'Notification deleted successfully' });
};

// @desc    Clear all read notifications
// @route   DELETE /api/notifications/clear-read
// @access  Private
const clearReadNotifications = async (req, res) => {
  const result = await Notification.deleteMany({
    recipient: req.user._id,
    isRead: true
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} read notifications cleared`
  });
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications
};
