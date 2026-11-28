import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CenterCsrMatchingPage } from './CenterCsrMatchingPage';
import { DeviceMasterPage } from './DeviceMasterPage';
import { DeviceMasterReportPage } from './DeviceMasterReportPage';
import {
  DEFAULT_DEVICE_MASTER_VIEW,
  deviceMasterPath,
  deviceMasterViewMeta,
  isDeviceMasterViewKey,
} from './deviceMasterViews';

/** /device-master → Param. */
export const DeviceMasterIndexRedirect = () => (
  <Navigate to={deviceMasterPath(DEFAULT_DEVICE_MASTER_VIEW)} replace />
);

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
  return <DeviceMasterReportPage view={deviceMasterViewMeta(subTab)} />;
};
