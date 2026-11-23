import { ObjectId } from '@mikro-orm/mongodb';
import { ERROR_CODES, ROLES } from '@exam-view/shared';
import { getEm } from '../../../database/connection.js';
import { Feedback, User } from '../../../database/entities/index.js';
import { AppError } from '../../../core/errors.js';
import { notificationService } from '../notifications/notification.service.js';
import { logger } from '../../../core/logger.js';

export const FEEDBACK_KINDS = ['bug', 'feature'];
export const FEEDBACK_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const FEEDBACK_STATUSES = ['new', 'in_review', 'planned', 'in_progress', 'resolved', 'wont_do'];
const CLOSED = new Set(['resolved', 'wont_do']);

const STATUS_LABELS = {
  new: 'New',
  in_review: 'In review',
  planned: 'Planned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  wont_do: "Won't do",
};

const LIMITS = { title: 120, description: 4000, steps: 2000, note: 2000, page: 500, ua: 400, viewport: 40 };

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const invalid = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = () => new AppError('Report not found', 404, ERROR_CODES.NOT_FOUND);
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const toApi = (row) => ({
  id: String(row._id ?? row.id),
  kind: row.kind,
  title: row.title,
  description: row.description,
  steps: row.steps || '',
  priority: row.priority || 'medium',
  status: row.status || 'new',
  admin_note: row.admin_note || '',
  page: row.page || '',
  user_agent: row.user_agent || '',
  viewport: row.viewport || '',
  reporter_id: row.reporter_id,
  reporter_name: row.reporter_name || '',
  reporter_email: row.reporter_email || '',
  resolved_at: row.resolved_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const findOne = async (id) => {
  if (!OBJECT_ID.test(String(id || ''))) throw notFound();
  const row = await getEm().findOne(Feedback, { _id: new ObjectId(String(id)) });
  if (!row) throw notFound();
  return row;
};

/** Best-effort: never fail the request because a notification could not be sent. */
const safeNotify = async (userId, message) => {
  try {
    await notificationService.createNotification(String(userId), 'feedback', message);
  } catch (error) {
    logger?.warn?.(`feedback notification failed: ${error.message}`);
  }
};

export const createFeedback = async (input, me) => {
  const kind = FEEDBACK_KINDS.includes(input?.kind) ? input.kind : null;
  if (!kind) throw invalid('Choose bug or feature');
  const title = str(input.title);
  if (!title) throw invalid('Add a short title');
  if (title.length > LIMITS.title) throw invalid(`Title must be ${LIMITS.title} characters or fewer`);
  const description = str(input.description);
  if (!description) throw invalid(kind === 'bug' ? 'Describe what went wrong' : 'Describe the feature you need');
  if (description.length > LIMITS.description) throw invalid('Description is too long');
  const steps = kind === 'bug' ? str(input.steps) : '';
  if (steps.length > LIMITS.steps) throw invalid('Steps are too long');
  const priority = FEEDBACK_PRIORITIES.includes(input.priority) ? input.priority : 'medium';

  const em = getEm();
  const row = em.create(Feedback, {
    kind,
    title,
    description,
    steps: steps || null,
    priority: kind === 'feature' && priority === 'critical' ? 'high' : priority,
    status: 'new',
    page: str(input.page).slice(0, LIMITS.page) || null,
    user_agent: str(input.user_agent).slice(0, LIMITS.ua) || null,
    viewport: str(input.viewport).slice(0, LIMITS.viewport) || null,
    reporter_id: String(me.id),
    reporter_name: me.name || null,
    reporter_email: me.email || null,
  });
  await em.persist(row).flush();

  // Tell super admins (excluding the reporter) — fire and forget.
  em.fork()
    .find(User, { role: ROLES.SUPER_ADMIN })
    .then((admins) =>
      Promise.all(
        admins
          .filter((u) => String(u._id) !== String(me.id))
          .map((u) =>
            safeNotify(u._id, `New ${kind === 'bug' ? 'bug report' : 'feature request'}: “${title}” from ${me.name || me.email || 'a user'}`),
          ),
      ),
    )
    .catch(() => {});

  return toApi(row);
};

export const listMine = async (userId) => {
  const rows = await getEm().find(Feedback, { reporter_id: String(userId) }, { orderBy: { created_at: 'DESC' }, limit: 200 });
  return rows.map(toApi);
};

export const listAll = async () => {
  const rows = await getEm().find(Feedback, {}, { orderBy: { created_at: 'DESC' }, limit: 2000 });
  return rows.map(toApi);
};

export const updateFeedback = async (id, input, me) => {
  const row = await findOne(id);
  const patch = {};
  if (input.status !== undefined) {
    if (!FEEDBACK_STATUSES.includes(input.status)) throw invalid('Unknown status');
    patch.status = input.status;
    patch.resolved_at = CLOSED.has(input.status) ? row.resolved_at || new Date() : null;
  }
  if (input.priority !== undefined) {
    if (!FEEDBACK_PRIORITIES.includes(input.priority)) throw invalid('Unknown priority');
    patch.priority = input.priority;
  }
  if (input.admin_note !== undefined) {
    const note = str(input.admin_note);
    if (note.length > LIMITS.note) throw invalid('Reply is too long');
    patch.admin_note = note || null;
  }
  if (!Object.keys(patch).length) return toApi(row);

  const statusChanged = patch.status !== undefined && patch.status !== row.status;
  const noteChanged = patch.admin_note !== undefined && (patch.admin_note || '') !== (row.admin_note || '');
  const em = getEm();
  em.assign(row, { ...patch, handled_by: String(me.id) });
  await em.flush();

  if ((statusChanged || noteChanged) && row.reporter_id !== String(me.id)) {
    const what = statusChanged ? `is now ${STATUS_LABELS[row.status]}` : 'has a new reply';
    await safeNotify(row.reporter_id, `Your ${row.kind === 'bug' ? 'bug report' : 'feature request'} “${row.title}” ${what}`);
  }
  return toApi(row);
};

export const deleteFeedback = async (id) => {
  const row = await findOne(id);
  const em = getEm();
  await em.remove(row).flush();
  return { success: true };
};
