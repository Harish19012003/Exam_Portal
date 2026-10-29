import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useToast } from '../components/ui/Toast';
import { Button, IconButton } from '../components/Button';
import { PageHeading } from '../components/PageHeading';
import { DynamicTable } from '../components/DynamicTable';
import { ListPlus, Plus, SlidersHorizontal } from 'lucide-react';
import { apiClient } from '../api/client';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { useAccess, applyColumnAccess, tablePermissions } from '../hooks/useAccess';
import { usePortalTableFeatures, withPortalFeatureLocks } from '../hooks/usePortalTableFeatures';
import { TABLE_IDS } from '../constants/tableIds';
import { BulkFieldsModal } from './exams/BulkFieldsModal';
import { ExamFieldBuilder } from './exams/ExamFieldBuilder';
import { buildFieldColumns } from './exams/examTableAdapter';
import './ExamsPage.css';

/** `vendors` keeps only these fixed columns; no custom field may use them. */
const RESERVED_VENDOR_KEYS = ['id', 'version', 'created_at', 'updated_at'];
const SYSTEM_VALUE_KEYS = new Set(RESERVED_VENDOR_KEYS);

export const VendorsPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           localStorage.getItem('theme') === 'dark';
  });

  const {
    layoutReady,
    layoutPrefs,
    hasUserLayoutOverride,
    layoutEpoch,
    canSaveLayoutAsDefault,
    onLayoutPrefsChange,
    onSaveLayoutAsDefault,
    onResetLayoutToDefault,
  } = useTableLayoutPrefs(TABLE_IDS.VENDORS);

  const [rows, setRows] = useState([]);
  // Confirmations and errors show as toasts (top right) instead of a banner that shifts the table down.
  const { addToast } = useToast();
  const setSuccessMsg = useCallback((message) => { if (message) addToast(message, 'success'); }, [addToast]);
  const setErrorMsg = useCallback((message) => { if (message) addToast(message, 'error'); }, [addToast]);
  const [customFields, setCustomFields] = useState([]);
  const [bulkFieldsOpen, setBulkFieldsOpen] = useState(false);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [manageStartNew, setManageStartNew] = useState(false);
  const saveChain = useRef(Promise.resolve());
  const [savingFields, setSavingFields] = useState(false);
  const [fieldsError, setFieldsError] = useState('');
  const { access, can } = useAccess();
  const canConfigure = can('vendors', 'configure');
  const tablePerms = useMemo(() => tablePermissions(access, 'vendors'), [access]);
  const persistFeatures = useCallback(async (features) => {
    const res = await apiClient.put('/vendors/config', { features });
    setSuccessMsg('Feature Builder settings saved for everyone');
    return res;
  }, []);
  const portalFeatures = usePortalTableFeatures({ canConfigure, persist: persistFeatures });

  const openAddField = () => {
    setManageStartNew(true);
    setManageFieldsOpen(true);
  };
  const openManageFields = () => {
    setManageStartNew(false);
    setManageFieldsOpen(true);
  };
  const openBulkFields = () => {
    setFieldsError('');
    setBulkFieldsOpen(true);
  };

  const columns = useMemo(
    () => applyColumnAccess(buildFieldColumns(customFields), 'vendors', access),
    [customFields, access],
  );

  const fetchConfig = async () => {
    try {
      const res = await apiClient.get('/vendors/config');
      const data = res.data?.data || res.data || {};
      setCustomFields(Array.isArray(data.fields) ? data.fields : []);
      portalFeatures.hydrate(data.features);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to load vendor field configuration.');
    }
  };

  /**
   * Fields drawer. Every change is saved immediately to the API.
   * The list updates optimistically and is restored if the server rejects the change.
   */
  const persistFields = (next) => {
    const keyById = new Map(customFields.map((f) => [f.id, f.key]));
    if (next.some((f) => keyById.has(f.id) && keyById.get(f.id) !== f.key)) {
      setErrorMsg('A field key cannot be changed after it is created because its data would be lost. Create a new field instead.');
      return;
    }
    const previous = customFields;
    const removed = previous.filter((f) => !next.some((n) => n.id === f.id));
    const added = next.some((n) => !previous.some((f) => f.id === n.id));
    setCustomFields(next);

    saveChain.current = saveChain.current.then(async () => {
      try {
        const res = await apiClient.put('/vendors/config', { fields: next, confirmDrops: removed.length > 0 });
        const data = res.data?.data || res.data || {};
        if (Array.isArray(data.fields)) setCustomFields(data.fields);
        if (removed.length || added) await fetchVendorsFromBackend();
      } catch (err) {
        setCustomFields(previous);
        setErrorMsg(err.response?.data?.message || err.message || 'Could not save the field change.');
      }
    });
  };

  const handleAddFields = async (newFields, updatedFields = []) => {
    const updatedById = new Map(updatedFields.map((f) => [f.id, f]));
    const base = customFields.map((f) => updatedById.get(f.id) || f);
    setSavingFields(true);
    setFieldsError('');
    try {
      const res = await apiClient.put('/vendors/config', { fields: [...base, ...newFields] });
      const data = res.data?.data || res.data || {};
      setCustomFields(Array.isArray(data.fields) ? data.fields : [...base, ...newFields]);
      setBulkFieldsOpen(false);
      setErrorMsg('');
      const parts = [
        newFields.length && `Added ${newFields.length} field${newFields.length === 1 ? '' : 's'}`,
        updatedFields.length && `updated ${updatedFields.length}`,
      ].filter(Boolean);
      setSuccessMsg(`${parts.join(', ')} in the vendor table.`);
      await fetchVendorsFromBackend();
    } catch (err) {
      setFieldsError(err.response?.data?.message || err.message || 'Could not save the fields.');
    } finally {
      setSavingFields(false);
    }
  };

  const fetchVendorsFromBackend = async () => {
    try {
      const res = await apiClient.get('/vendors');
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        const mapped = list.map((v) => ({
          rowId: String(v.id),
          version: v.version || 1,
          values: Object.fromEntries(Object.entries(v).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
        }));
        setRows(mapped);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to load vendors from the database.');
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchVendorsFromBackend();
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);


  // ── Bulk update: PATCH every selected vendor, then confirm once for the whole operation ──
  const handleBulkUpdate = async (items) => {
    if (!items?.length) return;
    const results = await Promise.allSettled(
      items.map((item) =>
        apiClient.patch(`/vendors/${encodeURIComponent(item.rowId)}`, {
          values: item.values,
          version: item.row?.version,
        }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    const done = items.length - failed.length;
    if (done) setSuccessMsg(`${done} vendor${done === 1 ? '' : 's'} updated.`);
    if (failed.length) {
      const reason = failed[0].reason;
      setErrorMsg(
        `${failed.length} vendor${failed.length === 1 ? '' : 's'} could not be updated` +
          (reason?.response?.data?.message ? `: ${reason.response.data.message}` : '.'),
      );
    }
    await fetchVendorsFromBackend();
  };

  // ── Persistent row update ───────────────────────────────────────────────────
  const handleRowUpdate = async (rowId, updatedValues, updatedRow) => {
    try {
      const res = await apiClient.patch(`/vendors/${encodeURIComponent(rowId)}`, {
        values: updatedValues,
        version: updatedRow?.version,
      });
      const saved = res.data?.data || res.data || {};

      setRows((prev) =>
        prev.map((r) =>
          r.rowId === String(rowId)
            ? {
                ...r,
                version: saved.version || (r.version || 1) + 1,
                values: {
                  ...r.values,
                  ...Object.fromEntries(Object.entries(saved).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
                },
              }
            : r,
        ),
      );
      setSuccessMsg('Vendor updated successfully.');
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update vendor in database.');
      fetchVendorsFromBackend();
    }
  };

  // ── Persistent row delete ───────────────────────────────────────────────────
  const handleRowDelete = async (rowIds) => {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    if (ids.length === 0) return;

    try {
      await apiClient.post('/vendors/delete', { ids });
      const idSet = new Set(ids.map(String));
      setRows((prev) => prev.filter((r) => !idSet.has(r.rowId)));
      setSuccessMsg(ids.length === 1 ? 'Vendor deleted successfully.' : `${ids.length} vendors deleted successfully.`);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to delete vendor from database.');
      fetchVendorsFromBackend();
    }
  };

  // ── CSV import (table toolbar) ──────────────────────────────────────────────
  const handleImportRows = async (csvRows) => {
    const byHeader = new Map();
    customFields.forEach((f) => {
      byHeader.set(String(f.key).toLowerCase(), f.key);
      byHeader.set(String(f.label).toLowerCase(), f.key);
    });

    const importRows = (Array.isArray(csvRows) ? csvRows : [])
      .map((row) => {
        const v = {};
        Object.entries(row || {}).forEach(([header, raw]) => {
          const key = byHeader.get(String(header).trim().toLowerCase());
          if (key) v[key] = raw;
        });
        return v;
      })
      .filter((v) => Object.values(v).some((x) => String(x ?? '').trim() !== ''));

    if (importRows.length === 0) {
      setErrorMsg('No rows matched your vendor fields. CSV headers must be a field label or key.');
      return;
    }

    try {
      await apiClient.post('/vendors/import', { rows: importRows });
      setErrorMsg('');
      setSuccessMsg(`Successfully imported ${importRows.length} vendor${importRows.length === 1 ? '' : 's'}.`);
      await fetchVendorsFromBackend();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to import vendors.');
    }
  };

  return (
    <div
      className="tables-page--dynamic"
      style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, height: '100%' }}
    >
      {/* Page Header */}
      <PageHeading
        title="Vendor Data"
        subtitle="Manage and update vendor details and supplier records."
        actions={
          canConfigure ? (
            <IconButton label="Field builder (admin)" onClick={openManageFields}>
              <SlidersHorizontal size={16} strokeWidth={2} />
            </IconButton>
          ) : null
        }
      />

      {/* Main Vendor Data Table */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
        {!layoutReady ? (
          <div style={{ padding: '2rem', color: 'var(--text-secondary, #64748b)' }}>Loading table layout…</div>
        ) : customFields.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              color: 'var(--text-secondary, #64748b)',
              background: 'var(--bg-card, #ffffff)',
              border: '1px dashed var(--border-color, #e2e8f0)',
              borderRadius: '14px',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>No vendor fields yet</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
              {canConfigure
                ? 'Add the columns this table needs, one at a time or many at once.'
                : 'An administrator needs to create the vendor fields first.'}
            </p>
            {canConfigure && (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '18px' }}>
                <Button variant="primary" icon={<Plus size={16} />} onClick={openAddField}>
                  Add a field
                </Button>
                <Button icon={<ListPlus size={16} />} onClick={openBulkFields}>
                  Bulk add fields
                </Button>
              </div>
            )}
          </div>
        ) : (
          <DynamicTable
            key={`vendors_layout_${layoutEpoch}_${customFields.map((f) => f.key).join(',')}`}
            tableId={TABLE_IDS.VENDORS}
            shareState={false}
            initialColumns={columns}
            initialRows={rows}
            layoutPrefs={layoutPrefs}
            onLayoutPrefsChange={onLayoutPrefsChange}
            canSaveLayoutAsDefault={canSaveLayoutAsDefault}
            hasUserLayoutOverride={hasUserLayoutOverride}
            onSaveLayoutAsDefault={
              canSaveLayoutAsDefault
                ? async (prefs) => {
                    const result = await onSaveLayoutAsDefault?.(prefs);
                    if (result?.message) {
                      if (result.ok) setSuccessMsg(result.message);
                      else setErrorMsg(result.message);
                    }
                  }
                : undefined
            }
            onResetLayoutToDefault={
              hasUserLayoutOverride
                ? async () => {
                    const result = await onResetLayoutToDefault?.();
                    if (result?.message) {
                      if (result.ok) setSuccessMsg(result.message);
                      else setErrorMsg(result.message);
                    }
                  }
                : undefined
            }
            onRowUpdate={handleRowUpdate}
            onBulkUpdate={handleBulkUpdate}
            onRowDelete={handleRowDelete}
            onRefresh={fetchVendorsFromBackend}
            onImportRows={handleImportRows}
            showAddRow={false}
            permissions={tablePerms}
            isDarkMode={isDarkMode}
            usePortalFeatures
            enableFeatureBuilder={canConfigure}
            onFeaturesChange={canConfigure ? portalFeatures.onChange : undefined}
            onSaveFeatures={canConfigure ? portalFeatures.save : undefined}
            isSavingFeatures={portalFeatures.saving}
            featuresDirty={portalFeatures.dirty}
            features={withPortalFeatureLocks(portalFeatures.features)}
          />
        )}
      </div>

      <ExamFieldBuilder
        open={manageFieldsOpen}
        fields={customFields}
        startWithNewField={manageStartNew}
        onClose={() => { setManageFieldsOpen(false); setManageStartNew(false); }}
        onChange={persistFields}
        title="Vendor fields"
        reservedKeys={RESERVED_VENDOR_KEYS}
        allowUnique
        deleteConfirm={(f) =>
          `Delete field "${f.label}"? Its column and all vendor data stored in it will be permanently removed.`
        }
        bulkModalProps={{
          title: 'Bulk add / edit vendor fields',
          labelPlaceholder: 'e.g. GST Number',
          keyPlaceholder: 'gst_number',
        }}
      />

      {bulkFieldsOpen && (
        <BulkFieldsModal
          title="Bulk add / edit vendor fields"
          labelPlaceholder="e.g. GST Number"
          keyPlaceholder="gst_number"
          fields={customFields}
          reservedKeys={RESERVED_VENDOR_KEYS}
          allowUnique
          saving={savingFields}
          error={fieldsError}
          onClose={() => setBulkFieldsOpen(false)}
          onAdd={handleAddFields}
        />
      )}
    </div>
  );
};

export default VendorsPage;
