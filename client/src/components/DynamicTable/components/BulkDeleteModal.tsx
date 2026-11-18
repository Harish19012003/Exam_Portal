import { useEffect, useRef, useState } from 'react';
import { CheckSquare, Filter, Table2, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { BulkUpdateScope } from './BulkUpdateModal';

export type BulkDeleteScope = BulkUpdateScope;

interface BulkDeleteModalProps {
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  /** When true, Filtered/All only cover currently loaded rows (legacy). */
  serverPaginated?: boolean;
  /** When true, Filtered/All hit the database (not just the loaded page). */
  dbScoped?: boolean;
  onConfirm: (scope: BulkDeleteScope) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export function BulkDeleteModal({
  selectedCount,
  filteredCount,
  totalCount,
  serverPaginated = false,
  dbScoped = false,
  onConfirm,
  onClose,
  isDarkMode,
}: BulkDeleteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<BulkDeleteScope>(() =>
    selectedCount > 0 ? 'selected' : filteredCount > 0 ? 'filtered' : 'all',
  );
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (scope === 'selected' && selectedCount === 0) {
      setScope(filteredCount > 0 ? 'filtered' : 'all');
    }
  }, [scope, selectedCount, filteredCount]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const scopeCount =
    scope === 'selected' ? selectedCount : scope === 'filtered' ? filteredCount : totalCount;

  const scopeOptions: {
    id: BulkDeleteScope;
    label: string;
    icon: LucideIcon;
    count: number;
    disabled: boolean;
    description: string;
    hint?: string;
  }[] = [
    {
      id: 'selected',
      label: 'Selected',
      icon: CheckSquare,
      count: selectedCount,
      disabled: selectedCount === 0,
      description:
        selectedCount === 0
          ? 'Tick rows in the table to use this option.'
          : 'Only rows with a checked checkbox.',
    },
    {
      id: 'filtered',
      label: 'Filtered',
      icon: Filter,
      count: filteredCount,
      disabled: filteredCount === 0,
      description: dbScoped
        ? 'Every database row that matches the current search and column filters.'
        : 'Every loaded row that matches your current search and filters.',
      hint: dbScoped
        ? 'Applies across the full table in the database'
        : serverPaginated
          ? 'Loaded rows matching filters'
          : undefined,
    },
    {
      id: 'all',
      label: 'All rows',
      icon: Table2,
      count: totalCount,
      disabled: totalCount === 0,
      description: dbScoped
        ? 'Every record in this table in the database (ignores filters).'
        : 'Every loaded row in this table, ignoring filters.',
      hint: dbScoped
        ? 'Full table in the database'
        : serverPaginated
          ? 'Loaded rows only'
          : undefined,
    },
  ];

  const activeOption = scopeOptions.find((o) => o.id === scope);
  const needsTypeConfirm = scope === 'all' && scopeCount > 0;
  const typeOk = !needsTypeConfirm || confirmText.trim().toUpperCase() === 'DELETE';
  const canSubmit = scopeCount > 0 && typeOk;

  const scopeNoun =
    scope === 'selected' ? 'selected' : scope === 'filtered' ? 'filtered' : '';
  const title =
    scopeCount === 1
      ? 'Delete 1 row?'
      : `Delete ${scopeCount.toLocaleString()} rows?`;
  const message =
    scopeCount === 1
      ? `This will permanently remove ${scopeNoun ? `the ${scopeNoun} ` : 'this '}row.`
      : `This will permanently remove ${scopeCount.toLocaleString()} ${
          scopeNoun ? `${scopeNoun} ` : ''
        }rows.`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      onConfirm(scope);
    } catch (err) {
      console.error('Bulk delete confirm failed', err);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] p-4">
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
        className={`w-full max-w-[440px] max-h-[90vh] max-h-[85dvh] flex flex-col rounded-2xl shadow-2xl border animate-[slideUp_0.2s_ease-out] overflow-hidden
          ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex items-start gap-3.5 px-5 pt-5 pb-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                isDarkMode ? 'bg-red-500/15' : 'bg-red-500/10'
              }`}
            >
              <Trash2 className="h-5 w-5 text-red-600" strokeWidth={2.25} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3
                id="bulk-delete-title"
                className={`text-[15px] font-semibold leading-snug ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                {title}
              </h3>
              <p
                className={`mt-1.5 text-[13px] leading-relaxed ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {message}
              </p>
              <p
                className={`mt-2 text-[12px] leading-snug opacity-80 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                This action cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`-mr-1 -mt-1 flex min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                isDarkMode
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-3">
            <p
              className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Rows to delete
            </p>
            <div
              role="radiogroup"
              aria-label="Rows to delete"
              className={`grid grid-cols-3 gap-0.5 p-0.5 rounded-xl border ${
                isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-100 border-gray-200'
              }`}
            >
              {scopeOptions.map((opt) => {
                const active = scope === opt.id;
                const OptionIcon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${opt.label}: ${opt.count.toLocaleString()} ${
                      opt.count === 1 ? 'row' : 'rows'
                    }. ${opt.description}`}
                    disabled={opt.disabled}
                    onClick={() => {
                      setScope(opt.id);
                      setConfirmText('');
                    }}
                    title={`${opt.label} — ${opt.description}`}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-h-[52px] sm:min-h-[44px] px-1.5 sm:px-2.5 rounded-[10px] text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed
                      ${
                        active
                          ? isDarkMode
                            ? 'bg-gray-900 text-red-400 shadow-sm ring-1 ring-red-500/40'
                            : 'bg-white text-red-700 shadow-sm ring-1 ring-red-200'
                          : isDarkMode
                            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                  >
                    <OptionIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
                    <span
                      className={`text-[11px] font-semibold leading-none tabular-nums ${
                        active ? 'opacity-90' : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {opt.count.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
            {activeOption?.hint ? (
              <p
                className={`text-[11px] font-medium mt-2 ${
                  isDarkMode ? 'text-amber-400/90' : 'text-amber-700'
                }`}
                aria-live="polite"
              >
                {activeOption.hint}
              </p>
            ) : null}
          </div>

          {needsTypeConfirm ? (
            <div className="px-5 pb-3">
              <label
                className={`block text-[12px] font-medium mb-1.5 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
                htmlFor="bulk-delete-confirm-input"
              >
                Type <span className="font-bold tracking-wide">DELETE</span> to confirm deleting the
                entire table
              </label>
              <input
                id="bulk-delete-confirm-input"
                type="text"
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className={`w-full min-h-[44px] rounded-xl border px-3 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
                  isDarkMode
                    ? 'bg-gray-950 border-gray-700 text-gray-100 placeholder:text-gray-600'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                }`}
              />
            </div>
          ) : null}

          <div
            className={`mt-auto flex gap-3 px-5 py-4 border-t ${
              isDarkMode ? 'border-gray-800' : 'border-gray-100'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`min-h-[44px] flex-1 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold border transition-colors ${
                isDarkMode
                  ? 'border-gray-700 bg-gray-900 text-gray-100 hover:bg-gray-800'
                  : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-[44px] flex-1 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {scopeCount === 1 ? 'Delete row' : `Delete ${scopeCount.toLocaleString()} rows`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
