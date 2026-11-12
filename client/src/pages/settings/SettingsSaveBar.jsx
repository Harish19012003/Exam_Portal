import React from 'react';
import { Save, CheckCircle2, AlertCircle } from 'lucide-react';

/** Success / error message shown above a settings form. */
export const SettingsNotice = ({ notice }) => {
  if (!notice) {
    return null;
  }
  return (
    <div className={`ps-alert ${notice.type}`} role="status">
      {notice.type === 'success' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
      <span>{notice.text}</span>
    </div>
  );
};

/** Unsaved-changes hint + Discard / Save buttons shared by the integration panels. */
export const SettingsSaveBar = ({ dirty, saving, onDiscard }) => (
  <div className="ps-actions">
    <span className={`ps-hint ${dirty ? 'dirty' : ''}`} role="status">
      {dirty ? 'You have unsaved changes' : 'All changes saved'}
    </span>
    <div className="ps-buttons">
      {dirty && (
        <button type="button" className="ps-btn ps-btn--ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </button>
      )}
      <button type="submit" className="ps-btn ps-btn--primary" disabled={saving || !dirty}>
        <Save size={16} aria-hidden="true" />
        <span>{saving ? 'Saving…' : 'Save changes'}</span>
      </button>
    </div>
  </div>
);
