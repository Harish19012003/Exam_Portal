import { NotificationRepository } from './notification.repository.js';
import { v4 as uuidv4 } from 'uuid';
import { notifyUser } from '../../../core/socket.js';

const notificationRepo = new NotificationRepository();

export const notificationService = {
  async getUserNotifications(userId) {
    return await notificationRepo.findByUserId(userId);
  },

  async markAsRead(notificationId, userId) {
    return await notificationRepo.markAsRead(notificationId, userId);
  },

  async createNotification(userId, type, message) {
    const id = uuidv4();
    await notificationRepo.create({
      id,
      user_id: userId,
      type,
      message,
    });
    
    // Fire realtime event
    notifyUser(userId, 'notification', {
      id,
      type,
      message,
    });

    return id;
  }
};
