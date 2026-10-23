import React from 'react';
import { Link2 } from 'lucide-react';
import {
  BOOLEAN_FIELD_TYPES,
  DATE_LINK_TYPES,
  getEffectiveDataType,
  resolveFieldOptions,
} from './examFieldTypes';
import { SearchableSelect } from './SearchableSelect';
import { MultiSelectDropdown } from './MultiSelectDropdown';

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
      />
    </div>
  );
};
