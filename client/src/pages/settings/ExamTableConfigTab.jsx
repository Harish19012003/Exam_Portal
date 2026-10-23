import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Table2, RefreshCw } from 'lucide-react';
import {
  fetchExamTableConfig,
  canConfigureExamTable,
} from '../exams/examTableConfig';

/**
 * Settings surface for the shared Exam table config.
 * Editing happens in Exams → Field Builder / Feature Builder; this tab shows status.
 */
export const ExamTableConfigTab = () => {
  const navigate = useNavigate();
  const canConfigure = canConfigureExamTable();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await fetchExamTableConfig();
      setConfig(next);
    } catch {
      setError('Could not load exam table settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fieldCount = Array.isArray(config?.fields) ? config.fields.length : 0;
  const featureFlags = config?.features
    ? Object.entries(config.features).filter(
        ([key, value]) => key.startsWith('enable') && value === true,
      )
    : [];

  return (
    <div className="config-section-panel" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(92, 67, 250, 0.1)',
            color: 'var(--primary-color, #5c43fa)',
            flexShrink: 0,
          }}
        >
          <Table2 size={20} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Exam table configuration</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary, #64748b)', lineHeight: 1.45 }}>
            Super admins configure fields and Feature Builder on the Exams page. That config is
            saved here and loaded for every portal member.
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</p>
      ) : error ? (
        <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 12,
              padding: '14px 16px',
              background: 'var(--bg-card, #fff)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Fields
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{fieldCount}</div>
          </div>
          <div
            style={{
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 12,
              padding: '14px 16px',
              background: 'var(--bg-card, #fff)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Features on
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{featureFlags.length}</div>
          </div>
          <div
            style={{
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 12,
              padding: '14px 16px',
              background: 'var(--bg-card, #fff)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Last saved
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>
              {config?.updatedAt
                ? new Date(config.updatedAt).toLocaleString()
                : 'Not published yet'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {canConfigure && (
          <button
            type="button"
            className="exams-btn primary compact"
            onClick={() => navigate('/exams')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--primary-color, #5c43fa)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={15} />
            Open Exams configurator
          </button>
        )}
        <button
          type="button"
          onClick={load}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-card, #fff)',
            color: 'var(--text-primary, #0f172a)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>
    </div>
  );
};

export default ExamTableConfigTab;
