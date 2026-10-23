import { Plus, Trash2 } from 'lucide-react';
import type { ColumnConfig } from '../DynamicTable/types';
import { isFieldColumn } from '../DynamicTable/types';
import { useQuickFiltersStore } from './quickFiltersStore';
import { FieldCombobox } from '../DynamicTable/components/FieldCombobox';

export interface QuickFiltersEditorProps {
  isDarkMode: boolean;
  columns: ColumnConfig[];
  compact?: boolean;
}

export function QuickFiltersEditor({ isDarkMode, columns, compact }: QuickFiltersEditorProps) {
  const { fieldKeys, setFieldKeys } = useQuickFiltersStore();
  const fieldColumns = columns.filter(isFieldColumn).filter(c => c.visible !== false);
  const unused = fieldColumns.filter(c => !fieldKeys.includes(c.key));

  const updateAt = (index: number, key: string) => {
    const next = [...fieldKeys];
    next[index] = key;
    setFieldKeys(next);
  };

  const removeAt = (index: number) => {
    setFieldKeys(fieldKeys.filter((_, i) => i !== index));
  };

  const addField = () => {
    if (!unused[0]) return;
    setFieldKeys([...fieldKeys, unused[0].key]);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {!compact && (
        <p className={`text-[11px] leading-snug ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Choose fields for the filter bar under summary chips. Separate from the table header filters.
        </p>
      )}

      <div className="space-y-1.5">
        {fieldKeys.map((key, index) => {
          const available = fieldColumns.filter(
            c => c.key === key || !fieldKeys.includes(c.key),
          );
          return (
            <div key={`${key}-${index}`} className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <FieldCombobox
                  value={key}
                  fields={available}
                  isDarkMode={isDarkMode}
                  onChange={next => updateAt(index, next)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeAt(index)}
                className={`flex-shrink-0 rounded-lg p-1.5 transition-colors ${
                  isDarkMode
                    ? 'text-gray-500 hover:bg-white/10 hover:text-rose-400'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-rose-500'
                }`}
                aria-label="Remove filter field"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {unused.length > 0 && (
        <button
          type="button"
          onClick={addField}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-2.5 py-2 text-[12px] font-semibold transition-colors ${
            isDarkMode
              ? 'border-gray-700 text-gray-400 hover:border-[#13C296]/40 hover:text-[#13C296]'
              : 'border-gray-200 text-gray-500 hover:border-[#13C296]/40 hover:text-[#0f9f7a]'
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Add filter field
        </button>
      )}

      {fieldKeys.length === 0 && (
        <p className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          No fields yet — add the filters you want on the bar.
        </p>
      )}
    </div>
  );
}
