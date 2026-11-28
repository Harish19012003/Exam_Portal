import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { deviceMasterTableId } from '@exam-view/shared';
import { apiClient } from '../api/client';
import { IconButton } from '../components/Button';
import { PageHeading, PageShell } from '../components/PageHeading';
import { DynamicTable, TableSkeleton } from '../components/DynamicTable';
import { useToast } from '../components/ui/Toast';
import { TABLE_IDS } from '../constants/tableIds';
import { useAccess, applyColumnAccess, tablePermissions } from '../hooks/useAccess';
import { useDeviceMasterBioExam } from '../hooks/useDeviceMasterBioExam.jsx';
import {
  useDeviceTabFields,
  useDeviceTabList,
  useInvalidateDeviceTab,
} from '../hooks/useDeviceTabQuery';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { DeviceApiModal } from './DeviceApiModal';
import { buildFieldColumns } from './exams/examTableAdapter';
import { useConfigLists } from './settings/useConfigLists';
import './ExamsPage.css';

/** Layout prefs id per Device Master report tab (falls back to a stable namespaced key). */
const LAYOUT_ID_BY_VIEW = {
  'stats-center': TABLE_IDS.DEVICE_STATS_CENTER,
  oprsummary: TABLE_IDS.DEVICE_OPRSUMMARY,
  'sync-pending': TABLE_IDS.DEVICE_SYNC_PENDING,
  'data-download': TABLE_IDS.DEVICE_DATA_DOWNLOAD,
  training: TABLE_IDS.DEVICE_TRAINING,
  'non-aadhaar-enrollments': TABLE_IDS.DEVICE_NON_AADHAAR_ENROLLMENTS,
  'aadhaar-enrollments': TABLE_IDS.DEVICE_AADHAAR_ENROLLMENTS,
  csr: TABLE_IDS.DEVICE_CSR,
  'modality-report': TABLE_IDS.DEVICE_MODALITY_REPORT,
  'modality-summary': TABLE_IDS.DEVICE_MODALITY_SUMMARY,
  'aadhaar-failed-reason': TABLE_IDS.DEVICE_AADHAAR_FAILED_REASON,
};

/**
 * Read-mostly table for Device Master report tabs (Stats Center, Training, …).
 * Columns come from the tab’s latest preset (+ fixed Date/Shift); rows from the fetch API.
 */
export const DeviceMasterReportPage = ({ view }) => {
  const viewKey = String(view?.tab || '').trim();
  const Icon = view?.icon;
  const accessTableId = deviceMasterTableId(viewKey) || 'devices';
  const layoutTableId = LAYOUT_ID_BY_VIEW[viewKey] || `device_report_${viewKey}_v1`;
  const configVersion = useConfigLists();
  const { examId: bioExamId } = useDeviceMasterBioExam();
  const [isDarkMode, setIsDarkMode] = useState(
    () =>
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      localStorage.getItem('theme') === 'dark',
  );
  const [apiOpen, setApiOpen] = useState(false);

  const {
    layoutReady,
    layoutPrefs,
    hasUserLayoutOverride,
    layoutEpoch,
    canSaveLayoutAsDefault,
    onLayoutPrefsChange,
    onSaveLayoutAsDefault,
    onResetLayoutToDefault,
  } = useTableLayoutPrefs(layoutTableId);

  const fieldsQuery = useDeviceTabFields(viewKey);
  const listQuery = useDeviceTabList(viewKey, bioExamId);
  const { invalidateList, invalidateFields, refetchList, setList } = useInvalidateDeviceTab(
    viewKey,
    bioExamId,
  );
  const fields = fieldsQuery.data || [];
  const rows = listQuery.data || [];
  const showSkeleton =
    !layoutReady ||
    (fieldsQuery.isPending && !fieldsQuery.data) ||
    (Boolean(bioExamId) && listQuery.isPending && !listQuery.data);

  const { addToast } = useToast();
  const setSuccessMsg = useCallback((message) => {
    if (message) addToast(message, 'success');
  }, [addToast]);
  const setErrorMsg = useCallback((message) => {
    if (message) addToast(message, 'error');
  }, [addToast]);

  const { access, can } = useAccess();
  const canConfigure = can('devices', 'configure') || can(accessTableId, 'configure');
  const tablePerms = useMemo(() => {
    const base = tablePermissions(access, accessTableId) || {};
    // Fetch operators with Param configure can delete rows they imported.
    if (can('devices', 'configure') && !base.delete) {
      return { ...base, delete: true, export: base.export !== false };
    }
    return Object.keys(base).length ? base : null;
  }, [access, accessTableId, can]);

  useEffect(() => {
    const sync = () => {
      setIsDarkMode(
        document.documentElement.getAttribute('data-theme') === 'dark' ||
          localStorage.getItem('theme') === 'dark',
      );
    };
    window.addEventListener('storage', sync);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      window.removeEventListener('storage', sync);
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    if (fieldsQuery.isError) {
      setErrorMsg(
        fieldsQuery.error?.response?.data?.message || `Failed to load ${view?.label || 'tab'} columns.`,
      );
    }
  }, [fieldsQuery.isError, fieldsQuery.error, setErrorMsg, view?.label]);

  useEffect(() => {
    if (listQuery.isError) {
      setErrorMsg(
        listQuery.error?.response?.data?.message || `Failed to load ${view?.label || 'tab'} rows.`,
      );
    }
  }, [listQuery.isError, listQuery.error, setErrorMsg, view?.label]);

  const columns = useMemo(
    () => applyColumnAccess(buildFieldColumns(fields), accessTableId, access),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, access, accessTableId, configVersion],
  );

  const refreshRows = useCallback(async () => {
    await Promise.all([refetchList(), invalidateFields()]);
  }, [refetchList, invalidateFields]);

  const handleRowDelete = useCallback(
    async (ids) => {
      const list = Array.isArray(ids) ? ids.map(String) : [String(ids)];
      await apiClient.post(`/devices/tabs/${encodeURIComponent(viewKey)}/delete`, { ids: list });
      setList((prev) => (prev || []).filter((r) => !list.includes(String(r.rowId))));
      setSuccessMsg(`Deleted ${list.length} row${list.length === 1 ? '' : 's'}.`);
      await invalidateList();
    },
    [viewKey, setList, setSuccessMsg, invalidateList],
  );

  const emptyHint = !bioExamId
    ? 'Select a bio exam in the header to load rows for this tab.'
    : fields.length === 0
      ? 'Map columns on a Device Preset for this tab (KEY + Bulk API header), then fetch.'
      : 'Use the gear to fetch this report type for the selected bio exam.';

  return (
    <PageShell fill className="tables-page--dynamic">
      <PageHeading
        title={view?.title || view?.label || 'Report'}
        subtitle={view?.subtitle}
        actions={
          canConfigure ? (
            <IconButton label={`API fetch for ${view?.label || 'tab'}`} onClick={() => setApiOpen(true)}>
              <Settings size={16} strokeWidth={2} />
            </IconButton>
          ) : null
        }
      />

      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
        {showSkeleton ? (
          <TableSkeleton isDarkMode={isDarkMode} columns={Math.max(4, fields.length || 5)} />
        ) : !fields.length ? (
          <div className="dm-tab-empty" role="status">
            {Icon ? <Icon size={22} aria-hidden="true" /> : null}
            <div>
              <h4 className="dm-tab-empty-title">No {view?.label || 'report'} columns yet</h4>
              <p className="dm-tab-empty-hint">{emptyHint}</p>
            </div>
          </div>
        ) : (
          <DynamicTable
            key={`dm_report_${viewKey}_${layoutEpoch}_${configVersion}_${fields.map((f) => f.key).join(',')}`}
            tableId={layoutTableId}
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
            onRowDelete={handleRowDelete}
            onRefresh={refreshRows}
            showAddRow={false}
            permissions={
              tablePerms
                ? { ...tablePerms, create: false, edit: false, import: false }
                : { create: false, edit: false, import: false, delete: canConfigure, export: true }
            }
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      <DeviceApiModal
        open={apiOpen}
        onClose={() => setApiOpen(false)}
        onFetched={refreshRows}
        onNotify={setSuccessMsg}
        examId={bioExamId}
        view={viewKey}
        title={`${view?.label || 'Report'} · API request`}
      />
    </PageShell>
  );
};

export default DeviceMasterReportPage;
