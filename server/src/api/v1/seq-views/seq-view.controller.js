import { successResponse } from '../../../core/response.js';
import * as seqViewService from './seq-view.service.js';
import * as fieldsService from './seq-view-fields.service.js';
import * as apiService from './seq-view-api.service.js';
import { createFlatTableAccess } from '../shared/flat-table-access.js';
import { assertTable } from '../../../core/access.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

const TABLE = 'seq_views';

const guarded = createFlatTableAccess(TABLE, {
  list: () => seqViewService.getAllSeqViews(),
  get: (id) => seqViewService.getSeqViewById(id),
  create: (values) => seqViewService.createSeqView(values),
  update: (id, values, version) => seqViewService.updateSeqView(id, values, version),
  remove: (ids) => seqViewService.deleteSeqViews(ids),
  import: (rows) => seqViewService.importSeqViews(rows),
  config: () => fieldsService.getConfig(),
  saveConfig: (body, userId) => fieldsService.saveConfig(body, userId),
});

/** External API sync replaces table data, so it needs the configure right. */
const configureOnly = (fn) => (req) => {
  assertTable(req, TABLE, 'configure');
  return fn(req);
};

export const listSeqViews = handle(guarded.list);
export const getSeqView = handle(guarded.get);
export const createSeqView = handle(guarded.create, 201);
export const updateSeqView = handle(guarded.update);
export const deleteSeqViews = handle(guarded.remove);
export const importSeqViews = handle(guarded.import, 201);
export const getConfig = handle(guarded.config);
export const saveConfig = handle(guarded.saveConfig);
export const getApiConfig = handle(configureOnly(() => apiService.getApiConfig()));
export const saveApiConfig = handle(configureOnly((req) => apiService.saveApiConfig(req.body, req.user?.id)));
export const testApiConfig = handle(configureOnly((req) => apiService.testApiConfig(req.body)));
export const syncFromApi = handle(configureOnly((req) => apiService.syncFromApi(req.body?.confirmReplace === true)));
