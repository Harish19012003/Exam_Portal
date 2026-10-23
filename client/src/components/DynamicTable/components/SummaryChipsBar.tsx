import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ColumnConfig, DataRow, SummaryChipConfig } from '../types';
import { isFieldColumn } from '../types';
import { computeAggregationValue } from '../utils/computeAggregation';
import { formatSummaryChipParts } from '../utils/formatAggregation';

interface SummaryChipsBarProps {
  chips: SummaryChipConfig[];
  columns: ColumnConfig[];
  rows: DataRow[];
  isDarkMode: boolean;
  visible: boolean;
  onToggleVisible?: () => void;
  /** When true, eye control is rendered elsewhere (e.g. beside view tabs). */
  hideToggle?: boolean;
}

export function SummaryChipsBar({
  chips,
  columns,
  rows,
  isDarkMode,
  visible,
  onToggleVisible,
  hideToggle = false,
}: SummaryChipsBarProps) {
  const [activeByChip, setActiveByChip] = useState<Record<string, number>>({});

  const resolved = chips
    .map(chip => {
      const col = columns.find(c => c.key === chip.fieldKey);
      if (!col || !isFieldColumn(col)) return null;
      const aggregations = (chip.aggregations ?? []).slice(0, 3);
      if (aggregations.length === 0) return null;
      return {
        id: chip.id,
        label: col.label || col.key,
        stats: aggregations.map(agg => {
          const raw = computeAggregationValue(col, rows, agg, columns);
          const parts = formatSummaryChipParts(col, raw, agg);
          return { agg, primary: parts.primary, unit: parts.unit, title: parts.title };
        }),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (resolved.length === 0) return null;

  const pillCls = isDarkMode
    ? 'border-gray-700 bg-[#0e1a17]/80 hover:border-gray-600'
    : 'border-gray-200 bg-white hover:border-gray-300';
  const labelCls = isDarkMode ? 'text-gray-500' : 'text-gray-400';
  const valueCls = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const unitCls = isDarkMode ? 'text-[#13C296]' : 'text-[#0f9f7a]';
  const eyeBtnCls = isDarkMode
    ? 'text-gray-500 hover:text-[#13C296] hover:bg-white/5'
    : 'text-gray-400 hover:text-[#13C296] hover:bg-teal-50';

  if (!visible) {
    if (hideToggle || !onToggleVisible) return null;
    return (
      <div className="flex justify-end py-1">
        <button
          type="button"
          onClick={onToggleVisible}
          className={`p-1.5 rounded-lg transition-colors ${eyeBtnCls}`}
          aria-label="Show summary chips"
          title="Show summary chips"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const cycleChip = (chipId: string, count: number) => {
    if (count < 2) return;
    setActiveByChip(prev => ({
      ...prev,
      [chipId]: ((prev[chipId] ?? 0) + 1) % count,
    }));
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex flex-1 min-w-0 items-center gap-2 overflow-x-auto custom-scrollbar py-0.5">
        {resolved.map(chip => {
          const canCycle = chip.stats.length > 1;
          const activeIdx = Math.min(activeByChip[chip.id] ?? 0, chip.stats.length - 1);
          const stat = chip.stats[activeIdx]!;
          const nextUnit = canCycle
            ? chip.stats[(activeIdx + 1) % chip.stats.length]!.unit
            : null;

          const body = (
            <>
              <span className="flex items-center justify-between gap-2 min-w-0">
                <span className={`text-[10.5px] font-medium leading-none truncate ${labelCls}`}>
                  {chip.label}
                </span>
                {canCycle ? (
                  <span className="flex items-center gap-0.5 flex-shrink-0" aria-hidden="true">
                    {chip.stats.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 rounded-full transition-all ${
                          i === activeIdx
                            ? 'w-2.5 bg-[#13C296]'
                            : isDarkMode
                              ? 'w-1 bg-gray-700'
                              : 'w-1 bg-gray-200'
                        }`}
                      />
                    ))}
                  </span>
                ) : null}
              </span>
              <span className="flex items-baseline gap-1.5 min-w-0">
                <span
                  className={`text-[15px] font-semibold tabular-nums leading-none tracking-tight ${valueCls}`}
                >
                  {stat.primary}
                </span>
                {stat.unit ? (
                  <span className={`text-[10.5px] font-semibold lowercase leading-none ${unitCls}`}>
                    {stat.unit}
                  </span>
                ) : null}
              </span>
            </>
          );

          if (canCycle) {
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => cycleChip(chip.id, chip.stats.length)}
                className={`flex flex-shrink-0 flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors min-w-[96px] max-w-[140px] ${pillCls}`}
                title={`${stat.title} · click for ${nextUnit ?? 'next'}`}
                aria-label={`${chip.label}: ${stat.title}. Click to cycle.`}
              >
                {body}
              </button>
            );
          }

          return (
            <div
              key={chip.id}
              className={`flex flex-shrink-0 flex-col gap-1 rounded-xl border px-3 py-2 min-w-[96px] max-w-[140px] ${
                isDarkMode ? 'border-gray-700 bg-[#0e1a17]/80' : 'border-gray-200 bg-white'
              }`}
              title={stat.title}
            >
              {body}
            </div>
          );
        })}
      </div>

      {!hideToggle && onToggleVisible && (
        <button
          type="button"
          onClick={onToggleVisible}
          className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${eyeBtnCls}`}
          aria-label="Hide summary chips"
          title="Hide summary chips"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
