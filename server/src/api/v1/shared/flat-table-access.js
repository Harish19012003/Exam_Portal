import {
  assertTable,
  assertRowVisible,
  assertWritable,
  autoFillKeys,
  rowVisible,
  stripHidden,
  writableValues,
} from '../../../core/access.js';

const SYSTEM_KEYS = new Set(['id', 'version', 'created_at', 'updated_at']);

const splitRow = (row) => {
  const system = {};
  const values = {};
  Object.entries(row || {}).forEach(([key, val]) => {
    if (SYSTEM_KEYS.has(key)) system[key] = val;
    else values[key] = val;
  });
  return { system, values };
};

/**
 * Access guard for tables whose rows are flat documents ({ id, version, ...fieldKeys }),
 * e.g. vendors and seq-views. `service` must expose list/get/create/update/delete/import/config.
 */
export const createFlatTableAccess = (tableId, service) => {
  const ruleValues = (row) => ({ ...splitRow(row).values, __id: row?.id });

  const forClient = (req, row) => {
    const { system, values } = splitRow(row);
    return { ...system, ...stripHidden(req, tableId, values) };
  };

  const autoKeys = async () => {
    try {
      return autoFillKeys((await service.config())?.fields);
    } catch {
      return [];
    }
  };

  const loadVisible = async (req, id) => {
    const row = await service.get(id);
    assertRowVisible(req, tableId, ruleValues(row));
    return row;
  };

  return {
    list: async (req) => {
      assertTable(req, tableId, 'view');
      const rows = await service.list();
      return rows.filter((row) => rowVisible(req, tableId, ruleValues(row))).map((row) => forClient(req, row));
    },

    get: async (req) => {
      assertTable(req, tableId, 'view');
      return forClient(req, await loadVisible(req, req.params.id));
    },

    create: async (req) => {
      assertTable(req, tableId, 'create');
      const values = writableValues(req, tableId, req.body?.values ?? {}, await autoKeys());
      assertRowVisible(req, tableId, values);
      return forClient(req, await service.create(values));
    },

    update: async (req) => {
      assertTable(req, tableId, 'edit');
      const existing = await loadVisible(req, req.params.id);
      const values = req.body?.values ?? {};
      const previous = splitRow(existing).values;
      assertWritable(req, tableId, values, previous);
      assertRowVisible(req, tableId, { ...ruleValues(existing), ...values });
      return forClient(req, await service.update(req.params.id, values, req.body?.version));
    },

    remove: async (req) => {
      assertTable(req, tableId, 'delete');
      const ids = req.body?.ids ?? req.params.id;
      for (const id of Array.isArray(ids) ? ids : [ids]) await loadVisible(req, id);
      return service.remove(ids);
    },

    import: async (req) => {
      assertTable(req, tableId, 'import');
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const keys = await autoKeys();
      const prepared = rows.map((row) => {
        const values = writableValues(req, tableId, row, keys);
        assertRowVisible(req, tableId, values);
        return values;
      });
      return service.import(prepared);
    },

    config: async (req) => {
      assertTable(req, tableId, 'view');
      return service.config();
    },

    saveConfig: async (req) => {
      assertTable(req, tableId, 'configure');
      return service.saveConfig(req.body, req.user?.id);
    },
  };
};
