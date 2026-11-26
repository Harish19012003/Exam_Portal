import React, { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { IconButton } from '../components/Button';
import { PageHeading, PageShell } from '../components/PageHeading';
import { useToast } from '../components/ui/Toast';
import { useAccess } from '../hooks/useAccess';
import { useDeviceMasterBioExam } from '../hooks/useDeviceMasterBioExam.jsx';
import { CenterCsrMatchingPage } from './CenterCsrMatchingPage';
import { DeviceApiModal } from './DeviceApiModal';
import { DeviceMasterPage } from './DeviceMasterPage';
import {
  DEFAULT_DEVICE_MASTER_VIEW,
  deviceMasterPath,
  deviceMasterViewMeta,
  isDeviceMasterViewKey,
} from './deviceMasterViews';
import './ExamsPage.css';

/** /device-master → Param. */
export const DeviceMasterIndexRedirect = () => (
  <Navigate to={deviceMasterPath(DEFAULT_DEVICE_MASTER_VIEW)} replace />
);

/** Placeholder for Device Master pages that are not wired to a full table UI yet. */
const DeviceMasterPlaceholder = ({ view }) => {
  const Icon = view.icon;
  const { addToast } = useToast();
  const { can } = useAccess();
  const canConfigure = can('devices', 'configure');
  const { examId } = useDeviceMasterBioExam();
  const [apiOpen, setApiOpen] = useState(false);

  return (
    <PageShell fill className="tables-page--dynamic">
      <PageHeading
        title={view.title}
        subtitle={view.subtitle}
        actions={
          canConfigure ? (
            <IconButton
              label={`API fetch for ${view.label}`}
              onClick={() => setApiOpen(true)}
            >
              <Settings size={16} strokeWidth={2} />
            </IconButton>
          ) : null
        }
      />
      <div className="dm-tab-empty" role="status">
        <Icon size={22} aria-hidden="true" />
        <div>
          <h4 className="dm-tab-empty-title">No {view.label} data yet</h4>
          <p className="dm-tab-empty-hint">
            {view.subtitle} Use the gear to set the shared API token/endpoint and fetch this report type for the
            selected bio exam.
          </p>
        </div>
      </div>
      <DeviceApiModal
        open={apiOpen}
        onClose={() => setApiOpen(false)}
        onFetched={() => addToast('Fetch finished for this tab.', 'success')}
        onNotify={(msg) => addToast(msg, 'success')}
        examId={examId}
        view={view.tab}
        title={`${view.label} · API request`}
      />
    </PageShell>
  );
};

/**
 * Route element for /device-master/:subTab — mirrors exam /exams/:examId/:subTab.
 */
export const DeviceMasterSubRoute = () => {
  const { subTab } = useParams();
  if (!isDeviceMasterViewKey(subTab)) {
    return <Navigate to={deviceMasterPath(DEFAULT_DEVICE_MASTER_VIEW)} replace />;
  }
  if (subTab === DEFAULT_DEVICE_MASTER_VIEW) {
    return <DeviceMasterPage />;
  }
  if (subTab === 'center-csr-matching') {
    return <CenterCsrMatchingPage />;
  }
  return <DeviceMasterPlaceholder view={deviceMasterViewMeta(subTab)} />;
};
