import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  CalendarClock,
  CloudDownload,
  Eye,
  EyeOff,
  Database,
  FlaskConical,
  Globe,
  Info,
  KeyRound,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../components/Button';
import { DynamicDropdown } from '../components/DynamicData';
import { apiClient } from '../api/client';
import { useConfirm } from '../feedback';
import './SeqViewApiModal.css';

const DEFAULT_LOGIN_BODY = '{"username":"{{username}}","password":"{{password}}"}';
const EMPTY_AUTH = {
  enabled: false,
  url: '',
  method: 'POST',
  headers: [],
  body: '{"username":"{{username}}","password":"{{password}}"}',
  username: '',
  password: '',
  tokenPath: 'token',
  tokenProperty: 'token',
};
/** Derive login URL from the data API host, e.g. trustview.in → …/api/auth/login */
const guessLoginUrl = (dataUrl) => {
  try {
    return `${new URL(dataUrl).origin}/api/auth/login`;
  } catch {
    return '';
  }
};
const EMPTY_AADHAAR_TYPES = { aadhaar: '', non_aadhaar: '' };
/** Fallback TrustView types if Training has not set them yet. */
const FALLBACK_AADHAAR_TYPES = {
  aadhaar: 'biometric_enrollments',
  non_aadhaar: 'non_aadhaar_enrollments',
};
const EMPTY = {
  url: '',
  method: 'GET',
  headers: [],
  properties: [],
  body: '',
  dataPath: '',
  mode: 'append',
  auth: { ...EMPTY_AUTH },
  schedule: { enabled: false, type: 'interval', intervalMinutes: 60, time: '09:00', days: [1], timezone: '' },
  /** Param: this exam is Aadhaar or Non Aadhaar. */
  examAadhaar: 'non_aadhaar',
  /** Training: TrustView `type` for each mode. */
  aadhaarTypes: { ...EMPTY_AADHAAR_TYPES },
};
const METHOD_OPTIONS = ['GET', 'POST'];
const AADHAAR_LABELS = ['Aadhaar', 'Non Aadhaar'];
const AADHAAR_LABEL_BY_KEY = { aadhaar: 'Aadhaar', non_aadhaar: 'Non Aadhaar' };
const AADHAAR_KEY_BY_LABEL = { Aadhaar: 'aadhaar', 'Non Aadhaar': 'non_aadhaar' };
const resolveExamAadhaar = (value) =>
  String(value || '').trim().toLowerCase() === 'aadhaar' ? 'aadhaar' : 'non_aadhaar';
const resolveAadhaarTypes = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    aadhaar: String(src.aadhaar || '').trim() || FALLBACK_AADHAAR_TYPES.aadhaar,
    non_aadhaar: String(src.non_aadhaar || '').trim() || FALLBACK_AADHAAR_TYPES.non_aadhaar,
  };
};
/** Apply Param exam mode + Training type map → `type` property. */
const withTrainingTypeFromExam = (properties, examAadhaar, aadhaarTypes) => {
  const reportType = resolveAadhaarTypes(aadhaarTypes)[resolveExamAadhaar(examAadhaar)];
  let props = (Array.isArray(properties) ? properties : []).filter(
    (p) => String(p?.name || '').trim().toLowerCase() !== 'aadhaar',
  );
  const typeIdx = props.findIndex((p) => String(p?.name || '').trim().toLowerCase() === 'type');
  if (typeIdx >= 0) props[typeIdx] = { ...props[typeIdx], name: 'type', value: reportType };
  else props = [...props, { name: 'type', value: reportType }];
  return props;
};
const FETCH_MODE_OPTIONS = [
  { value: 'append', label: 'Add new rows (skip ones already there)' },
  { value: 'replace', label: 'Replace all existing rows' },
];
const FETCH_MODE_LABELS = FETCH_MODE_OPTIONS.map((o) => o.label);
const readDarkMode = () =>
  document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('theme') === 'dark';
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

const ALL_TABS = [
  { id: 'login', label: 'Login', icon: KeyRound },
  { id: 'request', label: 'Request', icon: Globe },
  { id: 'import', label: 'Import', icon: Database },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
];

/** Report tabs share Param’s token/endpoint — only Request / Import / Schedule. */
const REPORT_TABS = ALL_TABS.filter((t) => t.id !== 'login');

/** One titled card of the form; `action` sits at the right of the header (e.g. an on/off switch). */
const Section = ({ icon: Icon, title, hint, tip, action, children }) => (
  <section className="dv-api-section">
    <header className="dv-api-section-head">
      <span className="dv-api-section-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="dv-api-section-titles">
        <h3 className="sv-api-label">
          {title}
          {tip && <InfoTip>{tip}</InfoTip>}
        </h3>
        {hint && <p className="sv-api-muted">{hint}</p>}
      </div>
      {action}
    </header>
    {children ? <div className="dv-api-section-body">{children}</div> : null}
  </section>
);

const Switch = ({ label, checked, onChange }) => (
  <label className="sv-api-switch dv-api-switch">
    <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="sv-api-switch-track" aria-hidden="true" />
    <span className="dv-api-switch-text">{checked ? 'On' : 'Off'}</span>
  </label>
);

const SECRET_MASK_TEXT = '••••••••';
const VAR_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
const varsIn = (texts) => [...new Set(texts.flatMap((t) => [...String(t || '').matchAll(VAR_RE)].map((m) => m[1])))];

/** Admin dialog for Device Master API fetch. Same token/endpoint pattern; `view` picks the report type / target tab. */
export const DeviceApiModal = ({
  open,
  onClose,
  onFetched,
  onNotify,
  examId = '',
  view = 'devices',
  title = 'API request',
}) => {
  const viewKey = String(view || 'devices').trim() || 'devices';
  /** Param keeps full setup; other Device Master tabs only tweak variables / import / schedule. */
  const reportOnly = viewKey !== 'devices';
  const tabs = reportOnly ? REPORT_TABS : ALL_TABS;
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
  const [isDarkMode, setIsDarkMode] = useState(readDarkMode);
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState('request');
  const [loginUrlTouched, setLoginUrlTouched] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!open) {
      setSharedOpen(false);
      return undefined;
    }
    let live = true;
    setError('');
    setResult(null);
    setDirty(false);
    setShowPassword(false);
    setLoginUrlTouched(false);
    setUrlTouched(false);
    setLoading(true);
    setIsDarkMode(readDarkMode());
    setTab('request');
    apiClient
      .get('/devices/api-config', { params: { view: viewKey } })
      .then((res) => {
        const data = unwrap(res);
        if (!live) return;
        const next = { ...EMPTY, ...(data.url ? data : {}) };
        next.schedule = { ...EMPTY.schedule, ...(next.schedule || {}) };
        next.auth = { ...EMPTY_AUTH, ...(next.auth || {}) };
        next.examAadhaar = resolveExamAadhaar(next.examAadhaar);
        next.aadhaarTypes = {
          ...EMPTY_AADHAAR_TYPES,
          ...(next.aadhaarTypes && typeof next.aadhaarTypes === 'object' ? next.aadhaarTypes : {}),
        };
        if (next.auth.enabled && !String(next.auth.url || '').trim() && next.url) {
          next.auth.url = guessLoginUrl(next.url);
        }
        if (next.auth.enabled && !String(next.auth.body || '').trim()) {
          next.auth.body = EMPTY_AUTH.body;
        }
        if (!next.schedule.timezone) next.schedule.timezone = browserZone();
        // Training: `type` comes from Param exam mode + Training type map.
        if (viewKey === 'training') {
          next.properties = withTrainingTypeFromExam(next.properties, next.examAadhaar, next.aadhaarTypes);
        }
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
  }, [open, viewKey, reloadTick]);

  useEffect(() => {
    if (!open) return undefined;
    const observer = new MutationObserver(() => setIsDarkMode(readDarkMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
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
  const showParamExamAadhaar = !reportOnly;
  const showTrainingTypeVars = viewKey === 'training';
  const examAadhaarKey = resolveExamAadhaar(form.examAadhaar);
  const trainingTypeMap = resolveAadhaarTypes(form.aadhaarTypes);
  const trainingTypeValue = trainingTypeMap[examAadhaarKey];
  const setExamAadhaar = (aadhaarKey) => {
    const next = resolveExamAadhaar(aadhaarKey);
    change({ examAadhaar: next });
  };
  const setAadhaarTypeField = (which, value) => {
    const nextTypes = {
      ...EMPTY_AADHAAR_TYPES,
      ...(form.aadhaarTypes || {}),
      [which]: value,
    };
    const patch = { aadhaarTypes: nextTypes };
    if (showTrainingTypeVars) {
      patch.properties = withTrainingTypeFromExam(form.properties, form.examAadhaar, nextTypes);
    }
    change(patch);
  };
  const changeSchedule = (patch) => change({ schedule: { ...form.schedule, ...patch } });
  const changeAuth = (patch) => change({ auth: { ...EMPTY_AUTH, ...form.auth, ...patch } });
  const sched = form.schedule;
  const auth = form.auth || EMPTY_AUTH;
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
  const tokenVar = auth.enabled ? String(auth.tokenProperty || '').trim() : '';
  const loginVars = auth.enabled ? [auth.username && 'username', auth.password && 'password'] : [];
  const knownVars = new Set([...form.properties.map((p) => p.name.trim()), tokenVar, ...loginVars].filter(Boolean));
  const loginBodyError = (() => {
    if (!auth.enabled || (auth.method || 'POST') !== 'POST' || !String(auth.body || '').trim()) return '';
    try {
      JSON.parse(auth.body);
      return '';
    } catch {
      return 'Not valid JSON. Keep {{name}} inside quotes, e.g. "{{username}}".';
    }
  })();
  const usedVars = varsIn([
    form.url,
    form.method === 'POST' ? form.body : '',
    ...form.headers.map((h) => h.value),
    ...(auth.enabled ? [auth.url, auth.body] : []),
  ]);
  const missingVars = usedVars.filter((v) => !knownVars.has(v));
  const blocker = !form.url
    ? 'Enter the request URL.'
    : auth.enabled && !auth.url
      ? 'Enter the login URL, or turn off Login first.'
      : loginBodyError
        ? 'Fix the login body JSON.'
        : '';
  const footerHint = blocker || intervalError || (dirty ? 'Unsaved changes. Save before fetching.' : '');
  /** TrustView exceldownload: token is a header, other variables are query params, format=csv is added. */
  const trustViewDownload = /trustview\.in\/api\/exa\/exceldownload/i.test(String(form.url || ''));
  /** Rough client-side picture of the data URL the server will call (same substitution + GET query rules). */
  const urlPreview = (() => {
    const raw = String(form.url || '').trim();
    if (!/^https?:\/\/\S+/i.test(raw)) return null;
    const shown = new Map();
    form.properties.forEach((p) => {
      const name = p.name.trim();
      if (name) shown.set(name, p.value);
    });
    if (tokenVar) shown.set(tokenVar, 'from login');
    const resolved = raw.replace(VAR_RE, (m, name) => shown.get(name) || m);
    const already = (name) => resolved.includes(`?${name}=`) || resolved.includes(`&${name}=`);
    const params =
      form.method === 'GET'
        ? [...shown].filter(([name, value]) => {
            if (!value || already(name)) return false;
            if (trustViewDownload && name.toLowerCase() === 'token') return false;
            return true;
          })
        : [];
    if (trustViewDownload && form.method === 'GET' && !params.some(([name]) => name.toLowerCase() === 'format') && !already('format')) {
      params.push(['format', 'csv']);
    }
    const headerToken =
      trustViewDownload &&
      form.method === 'GET' &&
      [...shown].some(([name, value]) => name.toLowerCase() === 'token' && value) &&
      !form.headers.some((h) => h.name.trim().toLowerCase() === 'token');
    return { resolved: resolved === raw ? '' : resolved, params, headerToken };
  })();
  const loginError =
    !reportOnly && auth.enabled && (!auth.url ? 'Login URL missing' : loginBodyError ? 'Login body is not valid JSON' : '');
  const tabInfo = {
    login: { badge: auth.enabled ? 'On' : 'Off', on: auth.enabled, error: loginError },
    request: {
      error: !reportOnly && !form.url
        ? 'URL missing'
        : missingVars.length
          ? `Not defined: ${missingVars.join(', ')}`
          : '',
    },
    import: { badge: form.mode === 'replace' ? 'Replace' : null },
    schedule: { badge: form.schedule.enabled ? 'On' : 'Off', on: form.schedule.enabled, error: intervalError },
  };
  const hintTab = !reportOnly && !form.url
    ? 'request'
    : loginError
      ? 'login'
      : intervalError
        ? 'schedule'
        : '';
  const onTabKey = (e) => {
    const idx = tabs.findIndex((t) => t.id === tab);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? tabs.length - 1
          : step
            ? (idx + step + tabs.length) % tabs.length
            : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(tabs[next].id);
    document.getElementById(`dv-api-tab-${tabs[next].id}`)?.focus();
  };

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
          message: 'Every run replaces all Device Master rows with the API data, so manual edits will be lost.',
          confirmLabel: 'Turn on',
          destructive: true,
        });
        if (!ok) return;
      }
      const saved = unwrap(await apiClient.put('/devices/api-config', { ...form, view: viewKey }, { params: { view: viewKey } }));
      setForm({
        ...EMPTY,
        ...saved,
        schedule: { ...EMPTY.schedule, ...(saved.schedule || {}) },
        auth: { ...EMPTY_AUTH, ...(saved.auth || {}) },
        examAadhaar: resolveExamAadhaar(saved.examAadhaar),
        aadhaarTypes: {
          ...EMPTY_AADHAAR_TYPES,
          ...(saved.aadhaarTypes && typeof saved.aadhaarTypes === 'object' ? saved.aadhaarTypes : {}),
        },
      });
      setWasScheduled(Boolean(saved.schedule?.enabled));
      setDirty(false);
      onNotify?.('API request saved.');
    });

  const test = (overrideMode = null) => {
    const modeKey = typeof overrideMode === 'string' ? overrideMode : null;
    const busyName = modeKey ? `test:${modeKey}` : 'test';
    const effectiveMode = modeKey || (showTrainingTypeVars ? examAadhaarKey : null);
    const payload = effectiveMode
      ? {
          ...form,
          properties: withTrainingTypeFromExam(form.properties, effectiveMode, form.aadhaarTypes),
        }
      : form;
    const testedLabel = effectiveMode
      ? `${AADHAAR_LABEL_BY_KEY[effectiveMode]} · type=${resolveAadhaarTypes(form.aadhaarTypes)[effectiveMode]}`
      : '';

    return run(busyName, async () => {
      const data = unwrap(
        await apiClient.post(
          '/devices/api-config/test',
          { ...payload, view: viewKey, examId: String(examId || '') },
          { params: { view: viewKey, examId: String(examId || '') } },
        ),
      );
      setResult({ ...data, testedLabel });
    });
  };

  const fetchNow = () =>
    run('fetch', async () => {
      if (dirty) throw new Error('Save your changes before fetching.');
      if (form.mode === 'replace') {
        const ok = await confirm({
          title: 'Replace all rows?',
          message: 'Replace mode deletes every existing Device Master row once the new rows are saved.',
          confirmLabel: 'Fetch and replace',
          destructive: true,
        });
        if (!ok) return;
      }
      const res = unwrap(
        await apiClient.post('/devices/sync', {
          confirmReplace: form.mode === 'replace',
          examId: String(examId || ''),
          view: viewKey,
        }),
      );
      onNotify?.(`Imported ${res.imported} row${res.imported === 1 ? '' : 's'}${res.skipped ? `, skipped ${res.skipped} already there` : ''}${res.removed ? `, removed ${res.removed} old` : ''}.`);
      await onFetched?.();
      onClose();
    });

  return (
    <>
    {createPortal(
    <div className="exams-bulk-overlay" onClick={onClose}>
      <div className="exams-bulk-modal sv-api-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="exams-bulk-header">
          <div>
            <h2 className="exams-bulk-title">
              <CloudDownload size={16} /> {title}
              <InfoTip>
                Same token and endpoint as Param. This tab only changes the report type (`type` variable) and where
                rows are saved. Use the gear for shared token, endpoint, and login.
              </InfoTip>
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {reportOnly ? (
              <button
                type="button"
                className="exams-drawer-close compact"
                onClick={() => setSharedOpen(true)}
                aria-label="Shared connection (token, endpoint, login)"
                title="Shared connection — token, endpoint, login"
              >
                <Settings size={16} strokeWidth={2} />
              </button>
            ) : null}
            <button type="button" className="exams-drawer-close compact" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {!loading && (
          <div className="dv-api-tabs" role="tablist" aria-label="API request settings" onKeyDown={onTabKey}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const info = tabInfo[t.id];
              const selected = tab === t.id;
              return (
                <button
                  key={t.id}
                  id={`dv-api-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`dv-api-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  className={`dv-api-tab ${selected ? 'is-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{t.label}</span>
                  {info.error ? (
                    <span className="dv-api-tab-dot" title={info.error} aria-label={`Needs attention: ${info.error}`} />
                  ) : info.badge != null ? (
                    <span className={`dv-api-tab-badge ${info.on ? 'is-on' : ''}`}>{info.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="exams-bulk-body sv-api-body dv-api-body">
          {loading ? (
            <p className="sv-api-muted">Loading…</p>
          ) : (
            <>
              {tab === 'login' && !reportOnly && (
                <div role="tabpanel" id="dv-api-panel-login" aria-labelledby="dv-api-tab-login">
                  <Section
                    icon={KeyRound}
                    title="Login first"
                    hint={auth.enabled ? 'Gets a fresh token before every fetch.' : 'Off: the request uses the saved variables as they are.'}
                    tip={
                      <>
                        Before each Test / Fetch / scheduled run, the server calls this login URL, reads the token from the
                        response, and saves it as the variable named below. The username and password you enter here fill{' '}
                        {'{{username}}'} / {'{{password}}'} in the login body and are hidden after saving. For TrustView
                        exceldownload the token is sent as a header named token. For other APIs, place {'{{token}}'} in the URL
                        or a header.
                      </>
                    }
                    action={<Switch label="Login first" checked={auth.enabled} onChange={(enabled) => changeAuth({ enabled })} />}
                  >
                    {auth.enabled && (
                      <>
                        <div className="sv-api-row sv-api-row--fields">
                          <div className="sv-api-field sv-api-method">
                            <span>Method</span>
                            <DynamicDropdown
                              variant="form"
                              required
                              isDarkMode={isDarkMode}
                              options={METHOD_OPTIONS}
                              value={auth.method || 'POST'}
                              onChange={(method) => changeAuth({ method })}
                              minMenuWidth={100}
                            />
                          </div>
                          <label className="sv-api-field sv-api-grow">
                            <span>Login URL</span>
                            <input
                              type="url"
                              placeholder="https://example.com/api/auth/login"
                              value={auth.url}
                              aria-invalid={loginUrlTouched && !auth.url}
                              onBlur={() => setLoginUrlTouched(true)}
                              onChange={(e) => changeAuth({ url: e.target.value })}
                            />
                            {loginUrlTouched && !auth.url && <small className="sv-api-status-error">Enter the login URL.</small>}
                          </label>
                        </div>

                        <div className="dv-api-grid2">
                          <label className="sv-api-field">
                            <span>Username</span>
                            <input
                              placeholder="Login username"
                              autoComplete="off"
                              value={auth.username || ''}
                              onChange={(e) => changeAuth({ username: e.target.value })}
                            />
                          </label>
                          <label className="sv-api-field">
                            <span>Password</span>
                            <span className="dv-api-secret">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Login password"
                                autoComplete="new-password"
                                value={auth.password || ''}
                                onChange={(e) => changeAuth({ password: e.target.value })}
                              />
                              <button
                                type="button"
                                className="dv-api-secret-btn"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                              >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </span>
                          </label>
                        </div>

                        {(auth.method || 'POST') === 'POST' && (
                          <label className="sv-api-field">
                            <span className="dv-api-labelrow">
                              <span className="sv-api-label">
                                Request body (JSON)
                                <InfoTip>
                                  Sent to the login URL. {'{{username}}'} and {'{{password}}'} are replaced with the values above;
                                  any other {'{{name}}'} comes from Variables.
                                </InfoTip>
                              </span>
                              {auth.body !== DEFAULT_LOGIN_BODY && (
                                <button type="button" className="dv-api-link" onClick={() => changeAuth({ body: DEFAULT_LOGIN_BODY })}>
                                  Use default
                                </button>
                              )}
                            </span>
                            <textarea
                              rows={2}
                              spellCheck={false}
                              placeholder={DEFAULT_LOGIN_BODY}
                              value={auth.body}
                              aria-invalid={!!loginBodyError}
                              onChange={(e) => changeAuth({ body: e.target.value })}
                            />
                            {loginBodyError && <small className="sv-api-status-error">{loginBodyError}</small>}
                          </label>
                        )}

                        <div className="dv-api-token-panel">
                          <span className="dv-api-token-title">From the login response</span>
                          <div className="dv-api-token">
                            <label className="sv-api-field">
                              <span className="sv-api-label">
                                Read token at
                                <InfoTip>Where the token sits in the login JSON, such as token or data.token.</InfoTip>
                              </span>
                              <input placeholder="token" spellCheck={false} value={auth.tokenPath} onChange={(e) => changeAuth({ tokenPath: e.target.value })} />
                            </label>
                            <ArrowRight size={16} className="dv-api-token-arrow" aria-hidden="true" />
                            <label className="sv-api-field">
                              <span>Save as variable</span>
                              <span className="dv-api-affix">
                                <span aria-hidden="true">{'{{'}</span>
                                <input
                                  placeholder="token"
                                  spellCheck={false}
                                  value={auth.tokenProperty}
                                  onChange={(e) => changeAuth({ tokenProperty: e.target.value })}
                                />
                                <span aria-hidden="true">{'}}'}</span>
                              </span>
                            </label>
                          </div>
                          <small className="sv-api-muted">
                            {trustViewDownload
                              ? `Sent as the token header on the download request, not as ?${tokenVar || 'token'}=.`
                              : form.method === 'GET'
                                ? `Sent with the request as ?${tokenVar || 'token'}=…, or place {{${tokenVar || 'token'}}} in the URL or a header yourself.`
                                : `Place {{${tokenVar || 'token'}}} in the request URL, body or a header.`}
                          </small>
                        </div>
                      </>
                    )}
                  </Section>
                </div>
              )}

              {tab === 'request' && (
                <div className="dv-api-panel" role="tabpanel" id="dv-api-panel-request" aria-labelledby="dv-api-tab-request">
                  {!reportOnly && (
                    <div className="dv-api-card">
                      <div className="dv-api-cardhead">
                        <h3>Endpoint</h3>
                        <span className="sv-api-muted">Shared endpoint for Device Master report downloads.</span>
                      </div>
                      <div className="dv-api-urlbar">
                        <div className={`dv-api-urlbar-method ${form.method === 'POST' ? 'is-post' : ''}`}>
                          <DynamicDropdown
                            variant="form"
                            required
                            isDarkMode={isDarkMode}
                            options={METHOD_OPTIONS}
                            value={form.method}
                            onChange={(method) => change({ method })}
                            minMenuWidth={100}
                          />
                        </div>
                        <input
                          type="url"
                          aria-label="Request URL"
                          spellCheck={false}
                          placeholder="https://api.example.com/records"
                          value={form.url}
                          aria-invalid={urlTouched && !form.url}
                          onBlur={() => setUrlTouched(true)}
                          onChange={(e) => change({ url: e.target.value })}
                        />
                      </div>
                      {urlTouched && !form.url && <small className="sv-api-status-error">Enter the URL to fetch from.</small>}
                      {urlPreview?.resolved && (
                        <p className="dv-api-resolved" title={urlPreview.resolved}>
                          <span>Resolves to</span> {urlPreview.resolved}
                        </p>
                      )}
                      {urlPreview?.headerToken && (
                        <div className="dv-api-params">
                          <span className="dv-api-params-label">Header</span>
                          <span className="dv-api-param">
                            <span className="dv-api-param-key">token</span>
                            <span className="dv-api-param-val">••••</span>
                          </span>
                        </div>
                      )}
                      {urlPreview?.params.length > 0 && (
                        <div className="dv-api-params">
                          <span className="dv-api-params-label">Query params</span>
                          {urlPreview.params.map(([name, value]) => (
                            <span key={name} className="dv-api-param">
                              <span className="dv-api-param-key">{name}</span>
                              <span className="dv-api-param-val">{value === SECRET_MASK_TEXT || value === 'from login' ? '••••' : value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {form.method === 'POST' && (
                        <label className="sv-api-field">
                          <span>JSON body</span>
                          <textarea rows={4} spellCheck={false} placeholder='{"page": 1}' value={form.body} onChange={(e) => change({ body: e.target.value })} />
                        </label>
                      )}
                    </div>
                  )}

                  <div className="dv-api-card">
                    <div className="dv-api-cardhead">
                      <h3 className="sv-api-label">
                        Variables
                        <InfoTip>
                          {reportOnly
                            ? 'Usually only type (and optional shift/date). Token and endpoint come from Param.'
                            : <>Named values for this API, like username, password, type, shift or date. Use them as {'{{NAME}}'} in the URL, login body, a header value or the data body.</>}
                        </InfoTip>
                      </h3>
                      <span className="sv-api-muted">
                        {showTrainingTypeVars
                          ? 'Set TrustView type values below. Fetch uses the one matching Param’s exam Aadhaar / Non Aadhaar. Leave currentshift blank (or bank) for every Param shift.'
                          : reportOnly
                            ? 'Set type yourself for this report. Leave currentshift blank (or bank) for every Param shift (ES when type is centre / pending_sync_status); set a shift id for one. Each call uses shift=… on the URL.'
                            : trustViewDownload
                              ? 'token is sent as the token header. Mark this exam as Aadhaar or Non Aadhaar below. Leave currentshift blank or bank to use every matching Param shift.'
                              : form.method === 'GET'
                                ? 'Filled values are sent as query parameters, or use {{name}} anywhere.'
                                : 'Use {{name}} in the URL, body or headers.'}
                      </span>
                      <button type="button" className="dv-api-addbtn" onClick={addProperty}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                    {showParamExamAadhaar && (
                      <div className="sv-api-field dv-api-aadhaar-select">
                        <span>Exam · Aadhaar / Non Aadhaar</span>
                        <DynamicDropdown
                          variant="form"
                          required
                          isDarkMode={isDarkMode}
                          options={AADHAAR_LABELS}
                          value={AADHAAR_LABEL_BY_KEY[examAadhaarKey] || 'Non Aadhaar'}
                          onChange={(label) => setExamAadhaar(AADHAAR_KEY_BY_LABEL[label] || 'non_aadhaar')}
                        />
                        <small className="sv-api-muted">
                          Applies to this exam. Training uses it to pick which type to fetch.
                        </small>
                      </div>
                    )}
                    {showTrainingTypeVars && (
                      <div className="dv-api-aadhaar-types">
                        <span className="sv-api-label">Fetch type variables</span>
                        <span className="sv-api-muted">
                          Param exam is {AADHAAR_LABEL_BY_KEY[examAadhaarKey]} → type={trainingTypeValue}
                        </span>
                        {[
                          { key: 'aadhaar', label: 'Aadhaar type', placeholder: FALLBACK_AADHAAR_TYPES.aadhaar },
                          { key: 'non_aadhaar', label: 'Non Aadhaar type', placeholder: FALLBACK_AADHAAR_TYPES.non_aadhaar },
                        ].map(({ key: modeKey, label, placeholder }) => {
                          const isActiveMode = examAadhaarKey === modeKey;
                          const isTestingThis = busy === `test:${modeKey}`;
                          return (
                            <div className="sv-api-field" key={modeKey}>
                              <span className="dv-api-aadhaar-label">
                                <span>{label}</span>
                                {isActiveMode && <span className="dv-api-active-pill">Active</span>}
                              </span>
                              <div className="dv-api-aadhaar-row">
                                <input
                                  aria-label={label}
                                  spellCheck={false}
                                  placeholder={placeholder}
                                  value={form.aadhaarTypes?.[modeKey] || ''}
                                  onChange={(e) => setAadhaarTypeField(modeKey, e.target.value)}
                                />
                                <Button
                                  icon={<FlaskConical size={14} />}
                                  onClick={() => test(modeKey)}
                                  disabled={loading || !!busy || !!blocker}
                                >
                                  {isTestingThis ? 'Testing…' : 'Test request'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {form.properties.length === 0 && !showTrainingTypeVars ? (
                      <button type="button" className="dv-api-empty" onClick={addProperty}>
                        <Plus size={14} /> Add a variable such as type, shift or date
                      </button>
                    ) : (
                      <div className="dv-api-table" role="table" aria-label="Variables">
                        <div className="dv-api-pair dv-api-pair--head" role="row">
                          <span role="columnheader">Name</span>
                          <span role="columnheader">Value</span>
                          <span />
                        </div>
                        {form.properties.map((p, i) => {
                          const fromLogin = tokenVar && p.name.trim() === tokenVar;
                          const nameLower = String(p.name || '').trim().toLowerCase();
                          const hideTokenRow = reportOnly && nameLower === 'token';
                          // Training: type is driven by Param exam mode + type map — hide freeform row.
                          const hideTypeRow = showTrainingTypeVars && nameLower === 'type';
                          if (hideTokenRow || hideTypeRow) return null;
                          return (
                            <div className="dv-api-pair" role="row" key={i}>
                              <input aria-label="Variable name" placeholder="name" spellCheck={false} value={p.name} onChange={(e) => setProperty(i, { name: e.target.value })} />
                              <input
                                aria-label="Variable value"
                                placeholder={fromLogin ? 'Filled by login on each run' : 'Value'}
                                value={fromLogin ? '' : p.value}
                                disabled={fromLogin}
                                autoComplete="off"
                                onChange={(e) => setProperty(i, { value: e.target.value })}
                              />
                              <button type="button" className="dv-api-del" onClick={() => removeProperty(i)} aria-label={`Remove variable ${p.name}`}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {missingVars.length > 0 && (
                      <small className="sv-api-status-error">
                        Used but not defined: {missingVars.map((v) => `{{${v}}}`).join(', ')}. Add {missingVars.length === 1 ? 'it' : 'them'}, or the request will fail.
                      </small>
                    )}
                  </div>

                  {!reportOnly && (
                    <div className="dv-api-card">
                      <div className="dv-api-cardhead">
                        <h3 className="sv-api-label">
                          Headers
                          <InfoTip>Saved values are hidden after saving. Leave a masked value as it is to keep it.</InfoTip>
                        </h3>
                        <span className="sv-api-muted">Optional, e.g. Authorization: Bearer {'{{token}}'}.</span>
                        <button type="button" className="dv-api-addbtn" onClick={addHeader}>
                          <Plus size={14} /> Add
                        </button>
                      </div>
                      {form.headers.length > 0 && (
                        <div className="dv-api-table" role="table" aria-label="Headers">
                          <div className="dv-api-pair dv-api-pair--head" role="row">
                            <span role="columnheader">Header</span>
                            <span role="columnheader">Value</span>
                            <span />
                          </div>
                          {form.headers.map((h, i) => (
                            <div className="dv-api-pair" role="row" key={i}>
                              <input aria-label="Header name" placeholder="Authorization" spellCheck={false} value={h.name} onChange={(e) => setHeader(i, { name: e.target.value })} />
                              <input
                                aria-label="Header value"
                                placeholder="Bearer {{token}}"
                                value={h.value}
                                autoComplete="off"
                                onChange={(e) => setHeader(i, { value: e.target.value })}
                              />
                              <button type="button" className="dv-api-del" onClick={() => removeHeader(i)} aria-label={`Remove header ${h.name}`}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'import' && (
                <div role="tabpanel" id="dv-api-panel-import" aria-labelledby="dv-api-tab-import">
                  <Section icon={Database} title="Import" hint="How the response becomes Device Master rows.">
                    <div className="sv-api-row sv-api-row--fields">
                      <label className="sv-api-field sv-api-grow">
                        <span className="sv-api-label">
                          Data path (optional)
                          <InfoTip>Where the list of records sits in the response, such as data.items. Leave empty if the response is the list.</InfoTip>
                        </span>
                        <input placeholder="data.items" value={form.dataPath} onChange={(e) => change({ dataPath: e.target.value })} />
                      </label>
                      <div className="sv-api-field sv-api-grow">
                        <span>When fetching</span>
                        <DynamicDropdown
                          variant="form"
                          required
                          isDarkMode={isDarkMode}
                          options={FETCH_MODE_LABELS}
                          value={FETCH_MODE_OPTIONS.find((o) => o.value === form.mode)?.label || FETCH_MODE_LABELS[0]}
                          onChange={(label) => {
                            const next = FETCH_MODE_OPTIONS.find((o) => o.label === label);
                            if (next) change({ mode: next.value });
                          }}
                          minMenuWidth={280}
                        />
                      </div>
                    </div>
                  </Section>
                </div>
              )}

              {tab === 'schedule' && (
                <div role="tabpanel" id="dv-api-panel-schedule" aria-labelledby="dv-api-tab-schedule">
                  <Section
                    icon={CalendarClock}
                    title="Automatic fetch"
                    hint={form.schedule.enabled ? 'The server fetches on its own, even with the page closed.' : 'Off: fetch manually only.'}
                    tip={
                      <>
                        The server runs the fetch by itself, even when nobody has the page open. Pick a repeating interval, a time
                        every day, or chosen days of the week at a set time (in the time zone of the browser that saved it). What
                        each run does depends on "When fetching". If the API fails or returns nothing usable, the existing rows
                        are kept. The shortest interval is {MIN_INTERVAL} minutes.
                      </>
                    }
                    action={<Switch label="Automatic fetch" checked={form.schedule.enabled} onChange={toggleSchedule} />}
                  >
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
                            <button type="button" className={`sv-api-chip ${custom ? 'is-active' : ''}`} aria-pressed={custom} onClick={() => setCustom(true)}>
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
                            <DynamicDropdown
                              variant="form"
                              required
                              className="sv-api-unit-dd"
                              isDarkMode={isDarkMode}
                              options={UNITS.map((u) => u.label)}
                              value={UNITS.find((u) => u.value === unit)?.label || UNITS[0].label}
                              onChange={(label) => {
                                const next = UNITS.find((u) => u.label === label);
                                if (!next) return;
                                setUnit(next.value);
                                changeSchedule({ intervalMinutes: Math.round(amount * next.value) });
                              }}
                              minMenuWidth={120}
                            />
                          </div>
                        )}
                        {intervalError ? (
                          <small className="sv-api-status-error" role="alert">
                            {intervalError}
                          </small>
                        ) : (
                          <small className="sv-api-muted">
                            {describeSchedule(sched)}, and {form.mode === 'replace' ? 'replaces all Device Master rows with the API data.' : 'adds the rows that are not in Device Master yet.'}
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
                  </Section>
                </div>
              )}

              {result && (
                <div className="sv-api-result" role="status">
                  <strong>
                    {result.testedLabel ? `${result.testedLabel} · ` : ''}
                    HTTP {result.status} · {result.itemCount} record{result.itemCount === 1 ? '' : 's'} · {result.importableRows} importable
                  </strong>
                  <div>Matched fields: {result.matchedKeys.length ? result.matchedKeys.join(', ') : 'none'}</div>
                  {result.unmatchedKeys.length > 0 && <div>Ignored (no matching device field): {result.unmatchedKeys.join(', ')}</div>}
                  {result.skippedShifts?.length > 0 && (
                    <div>Skipped shift {result.skippedShifts.join(', ')}. TrustView answered Invalid Request for those ids.</div>
                  )}
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

        <div className="exams-bulk-footer sv-api-footer dv-api-footer">
          {!loading && footerHint &&
            (hintTab && hintTab !== tab ? (
              <button type="button" className="dv-api-footer-hint is-error is-link" onClick={() => setTab(hintTab)}>
                {footerHint} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <span className={`dv-api-footer-hint ${blocker || intervalError ? 'is-error' : ''}`} role="status">
                {footerHint}
              </span>
            ))}
          <Button icon={<FlaskConical size={16} />} onClick={() => test()} disabled={loading || !!busy || !!blocker}>
            {busy === 'test' ? 'Testing…' : 'Test request'}
          </Button>
          <Button onClick={save} disabled={loading || !!busy || !!blocker || !!intervalError || !dirty}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="primary" icon={<CloudDownload size={16} />} onClick={fetchNow} disabled={loading || !!busy || !!blocker || dirty}>
            {busy === 'fetch' ? 'Fetching…' : 'Fetch data'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )}
    {reportOnly ? (
      <DeviceApiModal
        open={sharedOpen}
        onClose={() => {
          setSharedOpen(false);
          setReloadTick((n) => n + 1);
        }}
        onNotify={onNotify}
        examId={examId}
        view="devices"
        title="Param · Shared connection"
      />
    ) : null}
    </>
  );
};
