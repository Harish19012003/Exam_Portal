import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useFeedback } from '../../../feedback';
import { matchLookupRowExact } from '../../../pages/exams/tableLookupApi';
import type { CellEditorProps } from '../types';
import { setLookupDisplayOverrides } from './lookupDisplayOverrides';
import { setLookupPick } from './lookupPicks';
import { seedLookupRow } from './lookupSeeds';
import { editorBase, asFieldColumn } from './shared';

type TipPos = { top: number; left: number; placeAbove: boolean };

export function PhoneEditor({
  value,
  row,
  column,
  onSave,
  onSaveBatch,
  onCancel,
  isDarkMode,
  autoFocus,
}: CellEditorProps) {
  const field = asFieldColumn(column);
  const lookup = field?.lookup;
  const feedback = useFeedback();
  const [val, setVal] = useState(String(value ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<TipPos | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const commitGen = useRef(0);

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

  // Cell wrappers use overflow:hidden, so in-cell absolute tips are clipped —
  // measure the input and portal the message above/below it instead.
  useLayoutEffect(() => {
    if ((!error && !lookingUp) || !ref.current) {
      setTipPos(null);
      return;
    }
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const placeAbove = r.bottom + 28 > window.innerHeight - 8;
      setTipPos({
        top: placeAbove ? r.top - 6 : r.bottom + 4,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 220)),
        placeAbove,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [error, lookingUp, val]);

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

  const clearLinkedPatch = () => {
    const patch: Record<string, unknown> = { [column.key]: '' };
    (lookup?.syncFields || []).forEach((sf) => {
      if (sf.key !== column.key) patch[sf.key] = '';
    });
    return patch;
  };

  const applyLookupHit = (trimmed: string, item: { id: string; label: string; detail?: string; values?: Record<string, string> }) => {
    const rowId = String(row.rowId);
    const table = lookup!.table;
    const colKey = lookup!.column;
    const detailKey = lookup!.detailColumn || '';
    const syncFields = lookup!.syncFields || [];

    setLookupPick(rowId, column.key, item.id);
    const instant: Record<string, string> = {
      [colKey]: item.label,
      ...(item.values || {}),
    };
    if (detailKey) instant[detailKey] = item.detail ?? '';
    seedLookupRow(table, item.id, instant);

    const sourceVal = (sourceCol?: string) => {
      if (!sourceCol) return '';
      if (sourceCol === colKey) return item.label;
      if (sourceCol === detailKey) return item.detail ?? '';
      return item.values?.[sourceCol] ?? instant[sourceCol] ?? '';
    };

    const displayPhone = item.label || trimmed;
    const patch: Record<string, unknown> = { [column.key]: displayPhone };
    syncFields.forEach((sf) => {
      if (sf.key === column.key) return;
      patch[sf.key] = sourceVal(sf.column);
    });

    const displayPatch: Record<string, string> = {};
    Object.entries(patch).forEach(([k, v]) => {
      displayPatch[k] = v == null ? '' : String(v);
    });
    setLookupDisplayOverrides(rowId, displayPatch);

    flushSync(() => {
      if (onSaveBatch && Object.keys(patch).length > 1) onSaveBatch(patch);
      else onSave(displayPhone);
    });
  };

  const commit = async () => {
    const trimmed = val.trim();
    const err = validate(trimmed);
    if (err) {
      setError(err);
      return;
    }

    // No phone-lookup config — save the typed number as before.
    if (!lookup?.table || !lookup?.column) {
      onSave(trimmed);
      return;
    }

    const rowId = String(row.rowId);
    if (!trimmed) {
      setLookupPick(rowId, column.key, '');
      const patch = clearLinkedPatch();
      const displayPatch: Record<string, string> = {};
      Object.entries(patch).forEach(([k, v]) => {
        displayPatch[k] = v == null ? '' : String(v);
      });
      setLookupDisplayOverrides(rowId, displayPatch);
      flushSync(() => {
        if (onSaveBatch && Object.keys(patch).length > 1) onSaveBatch(patch);
        else onSave('');
      });
      return;
    }

    const gen = ++commitGen.current;
    setLookingUp(true);
    setError(null);
    try {
      const extra = [
        ...(lookup.resolveColumns || []),
        ...(lookup.syncFields || []).map((sf) => sf.column),
      ].filter(Boolean);
      const hit = await matchLookupRowExact({
        table: lookup.table,
        column: lookup.column,
        value: trimmed,
        columns: [...new Set(extra)],
      });
      if (gen !== commitGen.current) return;
      if (!hit) {
        // Keep the typed number; clear any previous SeqView link and dependents.
        setLookupPick(rowId, column.key, trimmed);
        const patch = clearLinkedPatch();
        patch[column.key] = trimmed;
        const displayPatch: Record<string, string> = {};
        Object.entries(patch).forEach(([k, v]) => {
          displayPatch[k] = v == null ? '' : String(v);
        });
        setLookupDisplayOverrides(rowId, displayPatch);
        flushSync(() => {
          if (onSaveBatch && Object.keys(patch).length > 1) onSaveBatch(patch);
          else onSave(trimmed);
        });
        feedback.show('toast.warning', {
          title: 'Not found',
          message: 'No matching row in the source table — related fields left blank.',
          duration: 4000,
        });
        return;
      }
      applyLookupHit(trimmed, hit);
    } catch {
      if (gen !== commitGen.current) return;
      setError('Could not look up this number');
    } finally {
      if (gen === commitGen.current) setLookingUp(false);
    }
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

  const tipText = error || (lookingUp ? 'Looking up…' : null);

  return (
    <div className="relative w-full h-full">
      <input
        ref={ref}
        type="tel"
        value={val}
        onChange={handleChange}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={() => {
          void commit();
        }}
        disabled={lookingUp}
        className={
          editorBase(isDarkMode) +
          (error ? ' border-orange-500 ring-1 ring-orange-500' : '')
        }
        placeholder={mode === 'india_mobile' ? 'e.g. 9876543210' : 'Phone number'}
        aria-label={`Edit ${column.label}`}
        aria-invalid={error ? true : undefined}
        title={error || message || undefined}
      />
      {tipText &&
        tipPos &&
        createPortal(
          <span
            role="tooltip"
            className="fixed z-[9999] max-w-[min(280px,90vw)] px-2 py-1 rounded-md text-[11px] leading-snug text-white bg-orange-500 shadow-lg font-medium pointer-events-none"
            style={{
              top: tipPos.top,
              left: tipPos.left,
              transform: tipPos.placeAbove ? 'translateY(-100%)' : undefined,
            }}
          >
            {tipText}
          </span>,
          document.body,
        )}
    </div>
  );
}
