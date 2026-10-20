import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';

const router = Router();

// A basic global search endpoint placeholder
// In the future, this will fan-out to user service, exams service, etc.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ results: [] });

    // Mock search logic
    const results = [
      { id: 1, type: 'Module', title: `Search result for: ${q}` }
    ];

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
