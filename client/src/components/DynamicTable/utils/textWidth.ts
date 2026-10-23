import { isFieldColumn } from '../types';
import type { ColumnConfig } from '../types';

let canvas: HTMLCanvasElement | null = null;

export function getTextWidth(text: string, font = '13px Inter, system-ui, sans-serif'): number {
  if (typeof window === 'undefined') return text.length * 8;
  if (!canvas) {
    canvas = document.createElement('canvas');
  }
  const context = canvas.getContext('2d');
  if (!context) return text.length * 8;
  context.font = font;
  const metrics = context.measureText(text);
  return Math.ceil(metrics.width);
}

export function calculateAutoFitColumnWidth(
  columnKey: string,
  columnLabel: string,
  rows: Array<Record<string, unknown>>,
  columns?: ColumnConfig[],
  minWidth = 70,
  maxWidth = 320,
): number {
  let maxW = getTextWidth(columnLabel, 'bold 13px Inter, system-ui, sans-serif') + 48; // include header padding & icons

  const col = columns?.find(c => c.key === columnKey);
  const dataType = col && isFieldColumn(col) ? col.dataType : undefined;

  // Cap maximum auto-fit width appropriately per data type
  const maxCap = dataType === 'attachment' ? 220 : dataType === 'url' ? 240 : maxWidth;

  for (let i = 0; i < Math.min(rows.length, 100); i++) {
    const val = rows[i]?.values
      ? (rows[i].values as Record<string, unknown>)[columnKey]
      : rows[i]?.[columnKey];

    if (val !== undefined && val !== null) {
      let displayText = '';

      if (Array.isArray(val)) {
        // Attachment array or multi-select tag array
        displayText = val
          .map(item =>
            typeof item === 'object' && item !== null
              ? (item as Record<string, unknown>).name || (item as Record<string, unknown>).fileName || 'File'
              : String(item),
          )
          .join(', ');
      } else if (typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        displayText = String(obj.name || obj.label || obj.title || 'Object');
      } else {
        displayText = String(val);
      }

      // If it's a URL, shorten for display text measurement
      if (dataType === 'url' || displayText.startsWith('http://') || displayText.startsWith('https://')) {
        displayText = displayText.replace(/^https?:\/\/(www\.)?/, '');
        if (displayText.length > 28) {
          displayText = displayText.substring(0, 28) + '...';
        }
      }

      const cellW = getTextWidth(displayText, '13px Inter, system-ui, sans-serif') + 36; // cell padding
      if (cellW > maxW) {
        maxW = cellW;
      }
    }
  }

  return Math.max(minWidth, Math.min(maxCap, maxW));
}
