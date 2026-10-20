import { AnnouncementRepository } from './announcement.repository.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../../../core/socket.js';

const announcementRepo = new AnnouncementRepository();

export const announcementService = {
  async getForRole(role) {
    return await announcementRepo.getLatestForRole(role);
  },

  async createAnnouncement(data, authorId) {
    const id = uuidv4();
    await announcementRepo.create({
      id,
      title: data.title,
      content: data.content,
      target_role: data.targetRole || 'ALL',
      author_id: authorId,
    });

    // Notify users in real-time
    const io = getIO();
    if (data.targetRole && data.targetRole !== 'ALL') {
      io.to(`role:${data.targetRole}`).emit('invalidate_query', { queryKey: ['announcements'] });
      io.to(`role:${data.targetRole}`).emit('notification', { message: `New Announcement: ${data.title}` });
    } else {
      io.emit('invalidate_query', { queryKey: ['announcements'] });
      io.emit('notification', { message: `New Announcement: ${data.title}` });
    }

    return id;
  },

  async deleteAnnouncement(id) {
    return await announcementRepo.delete(id);
  }
};
