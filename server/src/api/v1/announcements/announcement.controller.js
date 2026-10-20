import { announcementService } from './announcement.service.js';

export const announcementController = {
  async getAnnouncements(req, res, next) {
    try {
      const announcements = await announcementService.getForRole(req.user.role);
      res.json(announcements);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const id = await announcementService.createAnnouncement(req.body, req.user.id);
      res.status(201).json({ message: 'Announcement created', id });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await announcementService.deleteAnnouncement(req.params.id);
      res.json({ message: 'Announcement deleted' });
    } catch (err) {
      next(err);
    }
  }
};
