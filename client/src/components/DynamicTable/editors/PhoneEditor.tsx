import { useEffect, useRef, useState } from 'react';
import type { CellEditorProps } from '../types';
import { editorBase, asFieldColumn } from './shared';

export function PhoneEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);
  const [val, setVal] = useState(String(value ?? ''));
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [autoFocus]);

  const pv = field?.phoneValidation;
  const mode = pv?.mode || 'none';
  let pattern = pv?.pattern;
  let message = pv?.message;

  if (mode === 'india_mobile') {
    pattern = pattern || '^[6-9]\\d{9}$';
    message = message || 'Enter a 10-digit Indian mobile number';
  } else if (mode === 'india_e164') {
    pattern = pattern || '^(?:\\+91[\\s-]?)?[6-9]\\d{9}$';
    message = message || 'Enter a valid Indian mobile number';
  } else if (mode === 'e164') {
    pattern = pattern || '^\\+[1-9]\\d{7,14}$';
    message = message || 'Use + and country code, e.g. +919876543210';
  } else if (mode === 'digits_10_15') {
    pattern = pattern || '^\\d{10,15}$';
    message = message || 'Enter 10–15 digits';
  }

  const validate = (v: string): string | null => {
    const trimmed = v.trim();
    if (!trimmed) {
      if (field?.required) return 'Required';
      return null;
    }

    if (pattern) {
      try {
        if (!new RegExp(pattern).test(trimmed)) {
          return message || 'Invalid phone number';
        }
      } catch {
        // ignore regex compilation issues
      }
    } else {
      // General phone check: disallow letters/gibberish
      if (!/^[\d+\-()\s]{3,20}$/.test(trimmed) || !/\d/.test(trimmed)) {
        return 'Enter a valid phone number';
      }
    }

    return null;
  };

  const commit = () => {
    const trimmed = val.trim();
    const err = validate(trimmed);
    if (err) {
      setError(err);
      return;
    }
    onSave(trimmed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let nextVal = e.target.value;
    // For pure digit presets, filter out non-digits directly on input
    if (mode === 'india_mobile') {
      nextVal = nextVal.replace(/[^\d]/g, '').slice(0, 10);
    } else if (mode === 'digits_10_15') {
      nextVal = nextVal.replace(/[^\d]/g, '').slice(0, 15);
    } else if (mode === 'e164' || mode === 'india_e164') {
      // Only digits, leading +, spaces, hyphens
      nextVal = nextVal.replace(/[^\d+\s-]/g, '');
    } else if (mode === 'none' || !pattern) {
      // Disallow alphabets for phone fields
      nextVal = nextVal.replace(/[a-zA-Z]/g, '');
    }
    setVal(nextVal);
    setError(null);
  };

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type="tel"
        value={val}
        onChange={handleChange}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
        className={editorBase(isDarkMode) + (error ? ' border-red-500 ring-1 ring-red-500' : '')}
        placeholder={mode === 'india_mobile' ? 'e.g. 9876543210' : 'Phone number'}
        aria-label={`Edit ${column.label}`}
      />
      {error && (
        <span className="absolute -bottom-6 left-0 z-50 px-1.5 py-0.5 rounded text-[10px] text-white bg-red-600 shadow font-medium whitespace-nowrap">
          {error}
        </span>
      )}
    </div>
  );
}
