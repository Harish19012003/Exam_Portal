import { getEm } from '../../../database/connection.js';
import { ExamLink } from '../../../database/entities/index.js';

/** Canonical undirected pair: smaller id first. */
export const orderedPair = (idA, idB) => {
  const a = String(idA);
  const b = String(idB);
  return a < b ? [a, b] : [b, a];
};

const otherId = (link, examId) =>
  String(link.exam_a_id) === String(examId) ? String(link.exam_b_id) : String(link.exam_a_id);

/** All link rows that touch any of the given exam ids. */
export const findForExams = async (examIds = []) => {
  const ids = [...new Set((examIds || []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const em = getEm();
  return em.find(
    ExamLink,
    { $or: [{ exam_a_id: { $in: ids } }, { exam_b_id: { $in: ids } }] },
    { orderBy: { created_at: 'ASC' } },
  );
};

/** Map examId → linked exam ids (sorted). */
export const linkedIdsByExam = async (examIds = []) => {
  const ids = [...new Set((examIds || []).map(String).filter(Boolean))];
  const map = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return map;

  const links = await findForExams(ids);
  for (const link of links) {
    const a = String(link.exam_a_id);
    const b = String(link.exam_b_id);
    if (map.has(a)) map.get(a).push(b);
    if (map.has(b)) map.get(b).push(a);
  }
  for (const [id, list] of map) {
    map.set(id, [...new Set(list)].sort());
  }
  return map;
};

export const findLinkedIds = async (examId) => {
  const map = await linkedIdsByExam([examId]);
  return map.get(String(examId)) || [];
};

export const ensureLink = async (examId, linkedExamId, { relation = 'related', createdBy = null } = {}) => {
  const a = String(examId);
  const b = String(linkedExamId);
  if (!a || !b || a === b) return null;

  const [exam_a_id, exam_b_id] = orderedPair(a, b);
  const em = getEm();
  const existing = await em.findOne(ExamLink, { exam_a_id, exam_b_id });
  if (existing) return existing;

  const entity = em.create(ExamLink, {
    exam_a_id,
    exam_b_id,
    relation: relation || 'related',
    created_by: createdBy || null,
    created_at: new Date(),
  });
  await em.persist(entity).flush();
  return entity;
};

export const removeLink = async (examId, linkedExamId) => {
  const [exam_a_id, exam_b_id] = orderedPair(examId, linkedExamId);
  const em = getEm();
  const existing = await em.findOne(ExamLink, { exam_a_id, exam_b_id });
  if (!existing) return false;
  em.remove(existing);
  await em.flush();
  return true;
};

/**
 * Replace the full set of links for one exam.
 * Returns the resulting linked exam ids.
 */
export const setLinksForExam = async (examId, linkedExamIds = [], { createdBy = null } = {}) => {
  const source = String(examId);
  const wanted = [
    ...new Set(
      (Array.isArray(linkedExamIds) ? linkedExamIds : [])
        .map(String)
        .filter((id) => id && id !== source),
    ),
  ].sort();

  const current = await findLinkedIds(source);
  const currentSet = new Set(current);
  const wantedSet = new Set(wanted);

  for (const id of current) {
    if (!wantedSet.has(id)) await removeLink(source, id);
  }
  for (const id of wanted) {
    if (!currentSet.has(id)) await ensureLink(source, id, { createdBy });
  }

  return findLinkedIds(source);
};

/** Link every unique pair among examIds (undirected clique). */
export const linkMany = async (examIds = [], { createdBy = null } = {}) => {
  const ids = [...new Set((examIds || []).map(String).filter(Boolean))].sort();
  let created = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const before = await findLinkedIds(ids[i]);
      await ensureLink(ids[i], ids[j], { createdBy });
      if (!before.includes(ids[j])) created += 1;
    }
  }
  return { linked: created, examIds: ids };
};

/** Drop every link that references this exam (cascade on exam delete). */
export const removeAllForExam = async (examId) => {
  const id = String(examId);
  const em = getEm();
  await em.nativeDelete(ExamLink, {
    $or: [{ exam_a_id: id }, { exam_b_id: id }],
  });
};

export const toClient = (link, examId) => ({
  id: String(link.id || link._id),
  examId: String(examId),
  linkedExamId: otherId(link, examId),
  relation: link.relation || 'related',
  createdBy: link.created_by || null,
  createdAt: link.created_at ? new Date(link.created_at).getTime() : null,
});
