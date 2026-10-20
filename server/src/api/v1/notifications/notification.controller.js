import { notificationService } from './notification.service.js';

export const notificationController = {
  async getMine(req, res, next) {
    try {
      const notifications = await notificationService.getUserNotifications(req.user.id);
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  },

  async markRead(req, res, next) {
    try {
      const { id } = req.params;
      await notificationService.markAsRead(id, req.user.id);
      res.json({ message: 'Notification marked as read' });
    } catch (err) {
      next(err);
    }
  }
};
