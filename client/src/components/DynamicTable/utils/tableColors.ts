import type { CSSProperties } from 'react';
import type { TableColorSet, TableColorsConfig } from '../types';

export interface TableColorPreset {
  id: string;
  label: string;
  light: TableColorSet;
  dark: TableColorSet;
}

/** Matched light + dark colour sets. "default" applies no overrides (the built-in violet look). */
export const TABLE_COLOR_PRESETS: TableColorPreset[] = [
  { id: 'default', label: 'Default', light: {}, dark: {} },
  {
    id: 'ocean',
    label: 'Ocean',
    light: { headerBg: '#dbeafe', headerText: '#1e3a8a', stripeBg: '#f1f7ff', footerBg: '#eff6ff', footerText: '#1e3a8a' },
    dark: { headerBg: '#172554', headerText: '#bfdbfe', stripeBg: '#0f1d3a', footerBg: '#0b1730', footerText: '#bfdbfe' },
  },
  {
    id: 'forest',
    label: 'Forest',
    light: { headerBg: '#d1fae5', headerText: '#065f46', stripeBg: '#f0fdf7', footerBg: '#ecfdf5', footerText: '#065f46' },
    dark: { headerBg: '#064e3b', headerText: '#a7f3d0', stripeBg: '#0b2a22', footerBg: '#06221b', footerText: '#a7f3d0' },
  },
  {
    id: 'slate',
    label: 'Slate',
    light: { headerBg: '#e5e7eb', headerText: '#111827', stripeBg: '#f6f8fb', footerBg: '#f3f4f6', footerText: '#1f2937' },
    dark: { headerBg: '#111827', headerText: '#e5e7eb', stripeBg: '#151f31', footerBg: '#030712', footerText: '#d1d5db' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    light: { headerBg: '#ffedd5', headerText: '#9a3412', stripeBg: '#fff8f1', footerBg: '#fff7ed', footerText: '#9a3412' },
    dark: { headerBg: '#431407', headerText: '#fed7aa', stripeBg: '#2a1109', footerBg: '#220e07', footerText: '#fed7aa' },
  },
  {
    id: 'rose',
    label: 'Rose',
    light: { headerBg: '#ffe4e6', headerText: '#9f1239', stripeBg: '#fff5f6', footerBg: '#fff1f2', footerText: '#9f1239' },
    dark: { headerBg: '#4c0519', headerText: '#fecdd3', stripeBg: '#2d0a14', footerBg: '#250811', footerText: '#fecdd3' },
  },
  {
    id: 'mono',
    label: 'Mono',
    light: { headerBg: '#111827', headerText: '#f9fafb', stripeBg: '#f5f5f5', footerBg: '#f3f4f6', footerText: '#111827' },
    dark: { headerBg: '#f3f4f6', headerText: '#111827', stripeBg: '#1c1c1f', footerBg: '#27272a', footerText: '#f4f4f5' },
  },
];

export const resolveTableColors = (
  config: TableColorsConfig | undefined,
  isDarkMode: boolean,
): { set: TableColorSet; stripe: boolean } => {
  const mode = isDarkMode ? 'dark' : 'light';
  const preset = config?.preset || 'default';
  const set =
    preset === 'custom'
      ? config?.[mode] ?? {}
      : TABLE_COLOR_PRESETS.find(p => p.id === preset)?.[mode] ?? {};
  const stripe = Boolean(config?.stripe);
  // Zebra rows need a colour even on "Default": fall back to a soft neutral.
  const stripeBg = set.stripeBg || (stripe ? (isDarkMode ? '#161e2c' : '#f7f8fb') : undefined);
  return { set: { ...set, stripeBg }, stripe };
};

/** CSS variables + data attributes consumed by the `.dt-themed` rules in stickyCells.css. */
export const tableColorStyle = (set: TableColorSet): CSSProperties => ({
  ['--dt-head-bg' as string]: set.headerBg,
  ['--dt-head-text' as string]: set.headerText,
  ['--dt-stripe-bg' as string]: set.stripeBg,
  ['--dt-foot-bg' as string]: set.footerBg,
  ['--dt-foot-text' as string]: set.footerText,
});
