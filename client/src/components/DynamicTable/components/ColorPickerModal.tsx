import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface ColorPickerModalProps {
  isOpen: boolean;
  currentColor: string;
  isDarkMode: boolean;
  onClose: () => void;
  onSelectColor: (color: string) => void;
}

const PRESET_COLORS = [
  '#13C296', // Teal
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#e11d48', // Red
  '#f97316', // Orange
  '#64748b', // Slate
];

export function ColorPickerModal({
  isOpen,
  currentColor,
  isDarkMode,
  onClose,
  onSelectColor,
}: ColorPickerModalProps) {
  const [hexInput, setHexInput] = useState(currentColor || '#13C296');

  useEffect(() => {
    setHexInput(currentColor || '#13C296');
  }, [currentColor]);

  if (!isOpen) return null;

  return (
    // Above RecordDesignSidebar / Construction sidebars (z-[9995–9999]) so
    // clicks hit the picker, not the parent backdrop that would close it.
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-xs rounded-2xl border p-5 shadow-2xl transition-all ${
          isDarkMode ? 'bg-[#111c18] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-700/30">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full border border-white/20 shadow-xs flex-shrink-0"
              style={{ backgroundColor: hexInput }}
            />
            <h3 className="text-sm font-bold tracking-tight">Choose Button Color</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${
              isDarkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette Grid */}
        <div className="py-4">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Preset Colors</div>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setHexInput(c);
                  onSelectColor(c);
                  onClose();
                }}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-xl transition-all hover:scale-110 shadow-xs flex items-center justify-center ${
                  hexInput.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-white dark:ring-gray-900 scale-105' : 'opacity-85 hover:opacity-100'
                }`}
              >
                {hexInput.toLowerCase() === c.toLowerCase() && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </button>
            ))}
          </div>

          {/* Hex Code Input */}
          <div className="mt-4 pt-3 border-t border-dashed border-gray-700/30">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Custom Hex Color</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hexInput}
                onChange={e => {
                  setHexInput(e.target.value);
                  onSelectColor(e.target.value);
                }}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
              />
              <input
                type="text"
                value={hexInput}
                onChange={e => {
                  setHexInput(e.target.value);
                  if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    onSelectColor(e.target.value);
                  }
                }}
                placeholder="#13C296"
                className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-mono font-semibold transition-all ${
                  isDarkMode
                    ? 'border-gray-700 bg-[#182d27] text-gray-200 focus:border-[#13C296]'
                    : 'border-gray-300 bg-white text-gray-800 focus:border-[#13C296]'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              onSelectColor(hexInput);
              onClose();
            }}
            className="w-full py-2 rounded-xl bg-[#13C296] text-white text-xs font-bold shadow-md hover:bg-[#0f9f7a] transition-all"
          >
            Apply Color
          </button>
        </div>
      </div>
    </div>
  );
}
