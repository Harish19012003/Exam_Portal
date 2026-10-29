import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudDownload, FlaskConical, Info, Plus, Trash2, X } from 'lucide-react';
import { Button } from '../components/Button';
import { apiClient } from '../api/client';
import { useConfirm } from '../feedback';
import './SeqViewApiModal.css';

const EMPTY = {
  url: '',
  method: 'GET',
  headers: [],
  properties: [],
  body: '',
  dataPath: '',
  mode: 'append',
  schedule: { enabled: false, type: 'interval', intervalMinutes: 60, time: '09:00', days: [1], timezone: '' },
};
const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
const SCHEDULE_TYPES = [
  { value: 'interval', label: 'Every…' },
  { value: 'daily', label: 'Daily at' },
  { value: 'weekly', label: 'Weekly on' },
];
const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];
const DAY_NAMES = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
const formatTime = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const describeSchedule = (sc) => {
  if (sc.type === 'daily') return `Runs every day at ${formatTime(sc.time)} (${sc.timezone})`;
  if (sc.type === 'weekly') {
    const names = WEEKDAYS.filter((d) => sc.days.includes(d.value)).map((d) => DAY_NAMES[d.value]);
    return `Runs every ${names.join(', ') || '…'} at ${formatTime(sc.time)} (${sc.timezone})`;
  }
  return `Runs every ${describeInterval(sc.intervalMinutes)}`;
};
const MIN_INTERVAL = 5;
const MAX_INTERVAL = 10080;
const PRESETS = [
  { minutes: 5, label: '5 min' },
  { minutes: 10, label: '10 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 20, label: '20 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 360, label: '6 hours' },
  { minutes: 720, label: '12 hours' },
  { minutes: 1440, label: 'Daily' },
];
const describeInterval = (minutes) => {
  const { amount, unit } = splitInterval(minutes);
  const name = UNITS.find((u) => u.value === unit).label.replace(/s$/, '');
  return amount === 1 ? name : `${amount} ${name}s`;
};
const UNITS = [
  { value: 1, label: 'minutes' },
  { value: 60, label: 'hours' },
  { value: 1440, label: 'days' },
];
/** Largest unit that divides the interval evenly, so 120 shows as "2 hours". */
const splitInterval = (minutes) => {
  const unit = [...UNITS].reverse().find((u) => minutes % u.value === 0) || UNITS[0];
  return { amount: minutes / unit.value, unit: unit.value };
};
const formatWhen = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : '';
};
const unwrap = (res) => res.data?.data || res.data || {};
const errorText = (err, fallback) => err.response?.data?.message || err.message || fallback;

const TIP_WIDTH = 280;

/** Info icon; its text shows on hover, keyboard focus or click (click pins it until clicked again or Escape). */
const InfoTip = ({ children, label = 'More information' }) => {
  const id = useId();
  const btnRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const visible = hover || pinned;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - TIP_WIDTH / 2), window.innerWidth - TIP_WIDTH - 8);
    setPos({ top: r.bottom + 6, left });
  };

  useEffect(() => {
    if (!visible) return undefined;
    place();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPinned(false);
        setHover(false);
      }
    };
    const close = () => setPinned(false);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', close);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', close);
      window.removeEventListener('resize', place);
    };
  }, [visible]);

  return (
    <span className="sv-api-tipwrap" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        ref={btnRef}
        type="button"
        className="sv-api-tipbtn"
        aria-label={label}
        aria-describedby={visible ? id : undefined}
        aria-expanded={pinned}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <Info size={14} />
      </button>
      {visible && (
        <span id={id} role="tooltip" className="sv-api-tip" style={{ top: pos.top, left: pos.left, width: TIP_WIDTH }}>
          {children}
        </span>
      )}
    </span>
  );
};

/** Admin dialog for the one API SeqView pulls its rows from. Saving stores it; Fetch imports the rows. */
export const SeqViewApiModal = ({ open, onClose, onFetched, onNotify }) => {
  const confirm = useConfirm();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [wasScheduled, setWasScheduled] = useState(false);
  const [unit, setUnit] = useState(60);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setError('');
    setResult(null);
    setDirty(false);
    setLoading(true);
    apiClient
      .get('/seq-views/api-config')
      .then((res) => {
        const data = unwrap(res);
        if (!live) return;
        const next = { ...EMPTY, ...(data.url ? data : {}) };
        next.schedule = { ...EMPTY.schedule, ...(next.schedule || {}) };
        if (!next.schedule.timezone) next.schedule.timezone = browserZone();
        setForm(next);
        setWasScheduled(next.schedule.enabled);
        setUnit(splitInterval(next.schedule.intervalMinutes).unit);
        setCustom(!PRESETS.some((pr) => pr.minutes === next.schedule.intervalMinutes));
      })
      .catch((err) => live && setError(errorText(err, 'Could not load the API settings.')))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open]);

  if (!open) return null;

  const change = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setResult(null);
  };
  const setHeader = (i, patch) => change({ headers: form.headers.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  const removeHeader = (i) => change({ headers: form.headers.filter((_, idx) => idx !== i) });
  const setProperty = (i, patch) => change({ properties: form.properties.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const removeProperty = (i) => change({ properties: form.properties.filter((_, idx) => idx !== i) });
  const addProperty = () => change({ properties: [...form.properties, { name: '', value: '' }] });
  const changeSchedule = (patch) => change({ schedule: { ...form.schedule, ...patch } });
  const sched = form.schedule;
  const minutes = form.schedule.intervalMinutes;
  const amount = minutes / unit;
  const toggleDay = (d) =>
    changeSchedule({ days: sched.days.includes(d) ? sched.days.filter((x) => x !== d) : [...sched.days, d] });
  const intervalError = !sched.enabled
    ? ''
    : sched.type === 'interval'
      ? minutes < MIN_INTERVAL
        ? `The shortest interval is ${MIN_INTERVAL} minutes.`
        : minutes > MAX_INTERVAL
          ? 'The longest interval is 7 days.'
          : ''
      : !sched.time
        ? 'Choose a time of day.'
        : sched.type === 'weekly' && !sched.days.length
          ? 'Choose at least one day.'
          : '';
  const pickPreset = (m) => {
    setCustom(false);
    setUnit(splitInterval(m).unit);
    changeSchedule({ intervalMinutes: m });
  };
  const setAmount = (value) => changeSchedule({ intervalMinutes: Math.round(Number(value) * unit) || 0 });
  const toggleSchedule = (enabled) =>
    change({ schedule: { ...form.schedule, enabled, timezone: form.schedule.timezone || browserZone() } });
  const addHeader = () => change({ headers: [...form.headers, { name: '', value: '' }] });

  const run = async (name, fn) => {
    setBusy(name);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorText(err, 'Something went wrong.'));
    } finally {
      setBusy('');
    }
  };

  const save = () =>
    run('save', async () => {
      if (form.schedule.enabled && form.mode === 'replace' && !wasScheduled) {
        const ok = await confirm({
          title: 'Turn on scheduled fetching?',
          message: 'Every run replaces all SeqView rows with the API data, so manual edits will be lost.',
          confirmLabel: 'Turn on',
          destructive: true,
        });
        if (!ok) return;
      }
      const saved = unwrap(await apiClient.put('/seq-views/api-config', form));
      setForm({ ...EMPTY, ...saved, schedule: { ...EMPTY.schedule, ...(saved.schedule || {}) } });
      setWasScheduled(Boolean(saved.schedule?.enabled));
      setDirty(false);
      onNotify?.('API request saved.');
    });

  const test = () =>
    run('test', async () => {
      setResult(unwrap(await apiClient.post('/seq-views/api-config/test', form)));
    });

  const fetchNow = () =>
    run('fetch', async () => {
      if (dirty) throw new Error('Save your changes before fetching.');
      if (form.mode === 'replace') {
        const ok = await confirm({
          title: 'Replace all rows?',
          message: 'Replace mode deletes every existing SeqView row once the new rows are saved.',
          confirmLabel: 'Fetch and replace',
          destructive: true,
        });
        if (!ok) return;
      }
      const res = unwrap(await apiClient.post('/seq-views/sync', { confirmReplace: form.mode === 'replace' }));
      onNotify?.(`Imported ${res.imported} row${res.imported === 1 ? '' : 's'}${res.skipped ? `, skipped ${res.skipped} already there` : ''}${res.removed ? `, removed ${res.removed} old` : ''}.`);
      await onFetched?.();
      onClose();
    });

  return createPortal(
    <div className="exams-bulk-overlay" onClick={onClose}>
      <div className="exams-bulk-modal sv-api-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="SeqView API request">
        <div className="exams-bulk-header">
          <div>
            <h2 className="exams-bulk-title">
              <CloudDownload size={16} /> API request
              <InfoTip>The server calls this API and saves the rows it returns into SeqView.</InfoTip>
            </h2>
          </div>
          <button type="button" className="exams-drawer-close compact" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="exams-bulk-body sv-api-body">
          {loading ? (
            <p className="sv-api-muted">Loading…</p>
          ) : (
            <>
              <div className="sv-api-row">
                <label className="sv-api-field sv-api-method">
                  <span>Method</span>
                  <select value={form.method} onChange={(e) => change({ method: e.target.value })}>
                    <option>GET</option>
                    <option>POST</option>
                  </select>
                </label>
                <label className="sv-api-field sv-api-grow">
                  <span>URL</span>
                  <input type="url" placeholder="https://api.example.com/records" value={form.url} onChange={(e) => change({ url: e.target.value })} />
                </label>
              </div>

              <div className="sv-api-field">
                <span className="sv-api-label">
                  Headers
                  <InfoTip>Saved values are hidden after saving. Leave a masked value as it is to keep it.</InfoTip>
                </span>
                {form.headers.map((h, i) => (
                  <div className="sv-api-row" key={i}>
                    <input aria-label="Header name" placeholder="Authorization" value={h.name} onChange={(e) => setHeader(i, { name: e.target.value })} />
                    <input
                      aria-label="Header value"
                      className="sv-api-grow"
                      placeholder="Bearer …"
                      value={h.value}
                      autoComplete="off"
                      onChange={(e) => setHeader(i, { value: e.target.value })}
                    />
                    <button type="button" className="sv-api-icon" onClick={() => removeHeader(i)} aria-label="Remove header">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button type="button" className="exams-text-add-btn sv-api-add" onClick={addHeader}>
                  <Plus size={14} /> Add header
                </button>
              </div>

              <div className="sv-api-field">
                <span className="sv-api-label">
                  Script properties
                  <InfoTip>
                    Named values for this API, like a username, password or token. Use them as {'{{NAME}}'} in the URL, a header value or the body.
                    Values with a name containing pass, token, secret, key or auth are hidden after saving.
                  </InfoTip>
                </span>
                {form.properties.map((p, i) => (
                  <div className="sv-api-row" key={i}>
                    <input aria-label="Property name" placeholder="MIS_USERNAME" value={p.name} onChange={(e) => setProperty(i, { name: e.target.value })} />
                    <input
                      aria-label="Property value"
                      className="sv-api-grow"
                      placeholder="Value"
                      value={p.value}
                      autoComplete="off"
                      onChange={(e) => setProperty(i, { value: e.target.value })}
                    />
                    <button type="button" className="sv-api-icon" onClick={() => removeProperty(i)} aria-label="Remove property">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button type="button" className="exams-text-add-btn sv-api-add" onClick={addProperty}>
                  <Plus size={14} /> Add property
                </button>
              </div>

              {form.method === 'POST' && (
                <label className="sv-api-field">
                  <span>JSON body</span>
                  <textarea rows={4} placeholder='{"page": 1}' value={form.body} onChange={(e) => change({ body: e.target.value })} />
                </label>
              )}

              <div className="sv-api-row">
                <label className="sv-api-field sv-api-grow">
                  <span className="sv-api-label">
                    Data path (optional)
                    <InfoTip>Where the list of records sits in the response, such as data.items. Leave empty if the response is the list.</InfoTip>
                  </span>
                  <input placeholder="data.items" value={form.dataPath} onChange={(e) => change({ dataPath: e.target.value })} />
                </label>
                <label className="sv-api-field sv-api-grow">
                  <span>When fetching</span>
                  <select value={form.mode} onChange={(e) => change({ mode: e.target.value })}>
                    <option value="append">Add new rows (skip ones already there)</option>
                    <option value="replace">Replace all existing rows</option>
                  </select>
                </label>
              </div>

              <div className="sv-api-field">
                <span className="sv-api-label">
                  Automatic fetch
                  <InfoTip>
                    The server runs the fetch by itself, even when nobody has the page open. Pick a repeating interval, a time every day, or chosen days of the
                    week at a set time (in the time zone of the browser that saved it). What each run does depends on "When fetching": add only the rows that are not in SeqView yet, or replace
                    all rows. If the API fails or returns nothing usable, the existing rows are kept. The shortest interval is {MIN_INTERVAL} minutes.
                  </InfoTip>
                </span>
                <label className="sv-api-switch">
                  <input type="checkbox" role="switch" checked={form.schedule.enabled} onChange={(e) => toggleSchedule(e.target.checked)} />
                  <span className="sv-api-switch-track" aria-hidden="true" />
                  <span>{form.schedule.enabled ? 'On: fetches automatically' : 'Off: fetch manually only'}</span>
                </label>
                {form.schedule.enabled && (
                  <>
                    <div className="sv-api-chips" role="group" aria-label="Schedule type">
                      {SCHEDULE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          className={`sv-api-chip sv-api-chip--type ${sched.type === t.value ? 'is-active' : ''}`}
                          aria-pressed={sched.type === t.value}
                          onClick={() => changeSchedule({ type: t.value })}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {sched.type === 'weekly' && (
                      <div className="sv-api-chips" role="group" aria-label="Days of the week">
                        {WEEKDAYS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            className={`sv-api-chip ${sched.days.includes(d.value) ? 'is-active' : ''}`}
                            aria-pressed={sched.days.includes(d.value)}
                            onClick={() => toggleDay(d.value)}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {sched.type !== 'interval' && (
                      <label className="sv-api-row sv-api-interval">
                        <span className="sv-api-muted">At</span>
                        <input type="time" aria-label="Time of day" value={sched.time} onChange={(e) => changeSchedule({ time: e.target.value })} />
                        <span className="sv-api-muted">{sched.timezone}</span>
                      </label>
                    )}

                    {sched.type === 'interval' && (
                      <div className="sv-api-chips" role="group" aria-label="Fetch interval">
                        {PRESETS.map((pr) => (
                          <button
                            key={pr.minutes}
                            type="button"
                            className={`sv-api-chip ${!custom && minutes === pr.minutes ? 'is-active' : ''}`}
                            aria-pressed={!custom && minutes === pr.minutes}
                            onClick={() => pickPreset(pr.minutes)}
                          >
                            {pr.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={`sv-api-chip ${custom ? 'is-active' : ''}`}
                          aria-pressed={custom}
                          onClick={() => setCustom(true)}
                        >
                          Custom
                        </button>
                      </div>
                    )}
                    {sched.type === 'interval' && custom && (
                      <div className="sv-api-row sv-api-interval">
                        <span className="sv-api-muted">Every</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          aria-label="Interval"
                          aria-invalid={!!intervalError}
                          value={Number.isFinite(amount) && amount > 0 ? amount : ''}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                        <select
                          aria-label="Interval unit"
                          value={unit}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setUnit(next);
                            changeSchedule({ intervalMinutes: Math.round(amount * next) });
                          }}
                        >
                          {UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {intervalError ? (
                      <small className="sv-api-status-error" role="alert">
                        {intervalError}
                      </small>
                    ) : (
                      <small className="sv-api-muted">
                        {describeSchedule(sched)}, and {form.mode === 'replace' ? 'replaces all SeqView rows with the API data.' : 'adds the rows that are not in SeqView yet.'}
                      </small>
                    )}
                  </>
                )}
                {form.status?.last_run_at && (
                  <small className={`sv-api-muted ${form.status.last_status === 'error' ? 'sv-api-status-error' : ''}`}>
                    Last run {formatWhen(form.status.last_run_at)} ({form.status.last_trigger === 'schedule' ? 'automatic' : 'manual'}):{' '}
                    {form.status.last_message}
                  </small>
                )}
                {form.schedule.enabled && !dirty && formatWhen(form.status?.next_run_at) && (
                  <small className="sv-api-muted">Next run {formatWhen(form.status.next_run_at)}</small>
                )}
              </div>

              {result && (
                <div className="sv-api-result" role="status">
                  <strong>
                    HTTP {result.status} · {result.itemCount} record{result.itemCount === 1 ? '' : 's'} · {result.importableRows} importable
                  </strong>
                  <div>Matched fields: {result.matchedKeys.length ? result.matchedKeys.join(', ') : 'none'}</div>
                  {result.unmatchedKeys.length > 0 && <div>Ignored (no matching SeqView field): {result.unmatchedKeys.join(', ')}</div>}
                  <pre>{JSON.stringify(result.sample, null, 2)}</pre>
                </div>
              )}
              {error && (
                <div className="sv-api-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="exams-bulk-footer sv-api-footer">
          <Button icon={<FlaskConical size={16} />} onClick={test} disabled={loading || !!busy || !form.url}>
            {busy === 'test' ? 'Testing…' : 'Test request'}
          </Button>
          <Button onClick={save} disabled={loading || !!busy || !form.url || !!intervalError}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="primary" icon={<CloudDownload size={16} />} onClick={fetchNow} disabled={loading || !!busy || !form.url}>
            {busy === 'fetch' ? 'Fetching…' : 'Fetch data'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
