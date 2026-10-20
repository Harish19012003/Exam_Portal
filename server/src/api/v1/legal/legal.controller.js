import { LegalRepository } from './legal.repository.js';

const legalRepo = new LegalRepository();

export const legalController = {
  async getDocument(req, res, next) {
    try {
      const doc = await legalRepo.findByType(req.params.type.toUpperCase());
      if (!doc) return res.status(404).json({ message: 'Document not found' });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  },

  async updateDocument(req, res, next) {
    try {
      const { type } = req.params;
      const { title, content } = req.body;
      await legalRepo.upsertDocument(type.toUpperCase(), title, content, req.user.id);
      res.json({ message: 'Document updated successfully' });
    } catch (err) {
      next(err);
    }
  }
};
