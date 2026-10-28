export type FieldState = 'default' | 'error' | 'disabled' | 'readonly';

export interface FieldInputOptions {
  compact?: boolean;
  variant?: 'form' | 'editor';
}

export function fieldInputClass(
  isDarkMode: boolean,
  state: FieldState = 'default',
  options: FieldInputOptions = {},
): string {
  const { compact = false, variant = 'form' } = options;

  if (variant === 'editor') {
    const base = `w-full h-full px-2 py-1 text-[13px] font-medium outline-none rounded border
    border-[#13C296] focus:ring-1 focus:ring-[#13C296]/30
    ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`;
    return state === 'error' ? `${base} border-red-500` : base;
  }

  const size = compact ? 'px-2 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]';
  const base = `w-full rounded-lg border outline-none transition-colors focus:ring-0 ${size}`;

  if (state === 'disabled') {
    return `${base} ${isDarkMode ? 'bg-gray-800/60 border-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`;
  }
  if (state === 'readonly') {
    return `${base} ${isDarkMode ? 'bg-gray-800/40 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`;
  }
  if (state === 'error') {
    return `${base} border-red-500 focus:border-red-500 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`;
  }
  return `${base} ${isDarkMode ? 'bg-gray-900 border-gray-600 text-gray-100 focus:border-[#13C296]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#13C296]'}`;
}

/** @deprecated Use fieldInputClass with variant: 'editor' */
export function editorInputClass(
  isDarkMode: boolean,
  state: FieldState = 'default',
  options: Omit<FieldInputOptions, 'variant'> = {},
): string {
  return fieldInputClass(isDarkMode, state, { ...options, variant: 'editor' });
}
