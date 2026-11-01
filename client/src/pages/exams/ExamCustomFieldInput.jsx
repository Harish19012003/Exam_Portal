import React, { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  BOOLEAN_FIELD_TYPES,
  DATE_LINK_TYPES,
  getEffectiveDataType,
  resolveFieldOptions,
  resolvePhoneValidation,
} from './examFieldTypes';
import { SearchableSelect } from './SearchableSelect';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { TableLookupSelect } from './TableLookupSelect';
import { listAssignableUsers } from './assigneeApi';
import {
  MISSING_LABEL,
  isFromExamField,
  isLinkedField,
  isTableSourceField,
  isUserTagsField,
  resolveLookupRows,
} from './tableLookupApi';

/** Multi-assign people filtered by the field's user tags (create / edit form). */
const UserAssigneeField = ({ field, value, onChange }) => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const selected = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  const tagIds = field.userTagIds || [];

  useEffect(() => {
    let cancelled = false;
    if (!tagIds.length) {
      setPeople([]);
      return undefined;
    }
    setLoading(true);
    listAssignableUsers(tagIds)
      .then((rows) => {
        if (!cancelled) setPeople(rows);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tagIds)]);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(next);
  };

  return (
    <div className="exams-form-group">
      <span className="exams-audit-label">
        {field.label}
        {field.required ? ' *' : ''}
      </span>
      <p className="exams-config-empty-hint">Assign one or more people with the tags configured on this field.</p>
      {loading && <p className="exams-config-empty-hint">Loading people…</p>}
      {!loading && people.length === 0 && (
        <p className="exams-config-empty-hint">No people match the selected tags.</p>
      )}
      <div className="exams-fill-grid" style={{ maxHeight: 220, overflowY: 'auto' }}>
        {people.map((p) => (
          <label key={p.id} className="exams-check-row" style={{ minHeight: 40 }}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
            <span>
              {p.name}
              {p.email ? ` · ${p.email}` : ''}
            </span>
          </label>
        ))}
      </div>
      <p className="exams-config-empty-hint">{selected.length} selected</p>
    </div>
  );
};

/** Read-only value mirrored from the parent exam record. */
const FromExamValueField = ({ field, examValue, examSourceDataType }) => {
  let text = '—';
  if (examValue != null && examValue !== '') {
    if (Array.isArray(examValue)) {
      text = examValue.map(String).filter(Boolean).join(', ') || '—';
    } else if (examSourceDataType === 'date' || examSourceDataType === 'datetime') {
      text = formatLinkedDateValue(examValue, examSourceDataType, '—');
    } else if (typeof examValue === 'boolean') {
      text = examValue ? 'Yes' : 'No';
    } else {
      text = String(examValue);
    }
  }
  return (
    <div className="exams-form-group">
      <span className="exams-audit-label">{field.label}</span>
      <div className="exams-audit-value" title="Copied from the exam (read-only)">
        {text}
      </div>
    </div>
  );
};

/** Read-only value of a column from the row picked in another (table column) field. */
const LinkedValueField = ({ field, sourceField, sourceValue }) => {
  const [text, setText] = useState('');
  const id = Array.isArray(sourceValue) ? sourceValue[0] : sourceValue;
  const { column } = field.linkedFrom || {};
  const table = sourceField?.tableSource?.table;

  useEffect(() => {
    if (!id || !table || !column) {
      setText('');
      return undefined;
    }
    let cancelled = false;
    resolveLookupRows({ table, columns: [column], ids: [String(id)] })
      .then((found) => {
        if (!cancelled) setText(found?.[id] ? found[id].values?.[column] ?? '' : MISSING_LABEL);
      })
      .catch(() => {
        if (!cancelled) setText('');
      });
    return () => {
      cancelled = true;
    };
  }, [id, table, column]);

  return (
    <div className="exams-form-group">
      <span className="exams-audit-label">{field.label}</span>
      <div className="exams-audit-value" title={sourceField ? `Read from ${sourceField.label}` : undefined}>
        {id ? text || '…' : '—'}
      </div>
    </div>
  );
};

const formatLinkedDateValue = (value, dataType, emptyLabel = '—') => {
  if (!value) return emptyLabel;
  const raw = String(value);
  if (dataType === 'date' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  if (dataType === 'datetime' && /^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const [datePart, timePart = ''] = raw.split('T');
    const [y, m, d] = datePart.split('-');
    const time = timePart.slice(0, 5);
    return time ? `${d}/${m}/${y} ${time}` : `${d}/${m}/${y}`;
  }
  return raw;
};

export const ExamCustomFieldInput = ({
  field,
  value,
  onChange,
  sameAsChecked = false,
  linkedSourceField = null,
  linkedSourceValue = undefined,
  examValue = undefined,
  examSourceDataType = undefined,
  sameAsSourceLabel = '',
  onSameAsToggle,
}) => {
  const id = `exam-field-${field.key}`;
  const isAuto = field.autoFill && field.autoFill !== 'none';
  const dataType = getEffectiveDataType(field);
  const options = resolveFieldOptions(field);
  const selectOptions = options.map((opt) => ({ value: opt, label: opt }));
  const showSameAs =
    Boolean(field.sameAsFieldKey) &&
    DATE_LINK_TYPES.has(dataType) &&
    typeof onSameAsToggle === 'function';
  const lockedBySameAs = showSameAs && sameAsChecked;
  const sameAsTitle = sameAsSourceLabel
    ? `Same as ${sameAsSourceLabel}`
    : 'Same as linked date';

  const renderDateField = (inputType) => (
    <div className={`exams-form-group exams-date-field${lockedBySameAs ? ' is-same-as-locked' : ''}`}>
      <div className="exams-date-field-header">
        <label htmlFor={id}>
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        {showSameAs && (
          <label
            className="exams-same-as-toggle"
            htmlFor={`${id}-same-as`}
            title={sameAsTitle}
          >
            <input
              id={`${id}-same-as`}
              type="checkbox"
              checked={sameAsChecked}
              onChange={(e) => onSameAsToggle(e.target.checked)}
            />
            <span>Same</span>
          </label>
        )}
      </div>
      {lockedBySameAs ? (
        <div className="exams-date-linked" aria-live="polite" title={sameAsTitle}>
          <Link2 size={14} strokeWidth={2} aria-hidden="true" />
          <span className="exams-date-linked-value">
            {formatLinkedDateValue(value, dataType, '—')}
          </span>
        </div>
      ) : (
        <input
          id={id}
          type={inputType}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      )}
    </div>
  );

  if (isFromExamField(field)) {
    return (
      <FromExamValueField
        field={field}
        examValue={examValue}
        examSourceDataType={examSourceDataType}
      />
    );
  }

  if (isLinkedField(field)) {
    return <LinkedValueField field={field} sourceField={linkedSourceField} sourceValue={linkedSourceValue} />;
  }

  if (isAuto || dataType === 'formula' || dataType === 'composite') {
    return (
      <div className="exams-form-group">
        <span className="exams-audit-label">{field.label}</span>
        <div className="exams-audit-value" title="Captured automatically">
          {dataType === 'formula'
            ? field.formula || '—'
            : dataType === 'composite'
              ? 'Composite'
              : value || '—'}
        </div>
      </div>
    );
  }

  if (BOOLEAN_FIELD_TYPES.has(dataType)) {
    return (
      <label className="exams-check-row" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          {field.label}
          {field.required ? ' *' : ''}
        </span>
      </label>
    );
  }

  if (isUserTagsField(field)) {
    return <UserAssigneeField field={field} value={value} onChange={onChange} />;
  }

  // Options read live from a column of the Vendor / SeqView table; the value is that row's id.
  if (
    isTableSourceField(field) &&
    (dataType === 'dropdown' || dataType === 'status' || dataType === 'multiselect')
  ) {
    return (
      <TableLookupSelect
        id={id}
        label={field.label}
        required={field.required}
        source={field.tableSource}
        multiple={dataType === 'multiselect'}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (dataType === 'dropdown' || dataType === 'status') {
    return (
      <SearchableSelect
        id={id}
        label={`${field.label}${field.required ? ' *' : ''}`}
        value={value ?? ''}
        options={[{ value: '', label: 'Select…' }, ...selectOptions]}
        placeholder="Select…"
        searchPlaceholder="Search…"
        onChange={onChange}
      />
    );
  }

  if (dataType === 'multiselect' || dataType === 'tags') {
    return (
      <MultiSelectDropdown
        id={id}
        label={field.label}
        value={Array.isArray(value) ? value : []}
        options={options}
        onChange={onChange}
        required={field.required}
        placeholder="Select…"
      />
    );
  }

  const label = (
    <label htmlFor={id}>
      {field.label}
      {field.required ? ' *' : ''}
    </label>
  );

  if (dataType === 'date') {
    return renderDateField('date');
  }

  if (dataType === 'datetime') {
    return renderDateField('datetime-local');
  }

  if (dataType === 'time') {
    return (
      <div className="exams-form-group">
        {label}
        <input
          id={id}
          type="time"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </div>
    );
  }

  if (
    dataType === 'number' ||
    dataType === 'currency' ||
    dataType === 'progress' ||
    dataType === 'rating'
  ) {
    return (
      <div className="exams-form-group">
        {label}
        <input
          id={id}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          min={dataType === 'progress' || dataType === 'rating' ? 0 : undefined}
          max={dataType === 'progress' ? 100 : dataType === 'rating' ? 5 : undefined}
          step={dataType === 'currency' ? '0.01' : '1'}
        />
      </div>
    );
  }

  if (dataType === 'attachment') {
    return (
      <div className="exams-form-group">
        {label}
        <input
          id={id}
          type="file"
          onChange={(e) => onChange(e.target.files?.[0]?.name || '')}
          required={field.required}
        />
      </div>
    );
  }

  const inputType =
    dataType === 'email'
      ? 'email'
      : dataType === 'phone'
        ? 'tel'
        : dataType === 'link' || dataType === 'image'
          ? 'url'
          : 'text';

  const phoneRule =
    dataType === 'phone' ? resolvePhoneValidation(field) : { pattern: '', message: '' };

  return (
    <div className="exams-form-group">
      {label}
      <input
        id={id}
        type={inputType}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        placeholder={field.label}
        pattern={phoneRule.pattern || undefined}
        title={phoneRule.message || undefined}
      />
      {phoneRule.pattern ? (
        <p className="exams-field-key-hint">{phoneRule.message}</p>
      ) : null}
    </div>
  );
};
