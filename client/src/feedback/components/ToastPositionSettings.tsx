import { useEffect, useState } from 'react';
import {
  FEEDBACK_POSITION_LABELS,
  FEEDBACK_POSITION_OPTIONS,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from '../feedbackPosition';

interface PositionSettingsPanelProps {
  title: string;
  description: string;
  settings: FeedbackPositionSettings;
  onChange: (settings: FeedbackPositionSettings) => void;
  isDarkMode: boolean;
}

function PositionGroup({
  label,
  value,
  onSelect,
  isDarkMode,
}: {
  label: string;
  value: FeedbackPosition;
  onSelect: (pos: FeedbackPosition) => void;
  isDarkMode: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {FEEDBACK_POSITION_OPTIONS.map(pos => {
          const active = value === pos;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => onSelect(pos)}
              className={`px-3 py-2 rounded-lg border text-left text-[12px] font-medium transition-colors
                ${active
                  ? isDarkMode
                    ? 'bg-[#13C296]/10 border-[#13C296]/60 text-[#13C296]'
                    : 'bg-[#13C296]/5 border-[#13C296] text-[#0f9f7a]'
                  : isDarkMode
                    ? 'border-gray-700 text-gray-300 hover:border-gray-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {FEEDBACK_POSITION_LABELS[pos]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PositionSettingsPanel({
  title,
  description,
  settings,
  onChange,
  isDarkMode,
}: PositionSettingsPanelProps) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 space-y-4
        ${isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}
    >
      <div>
        <h3 className={`text-[14px] font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        <p className={`text-[12px] mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {description}
        </p>
      </div>
      <PositionGroup
        label="Normal screen (desktop)"
        value={settings.desktop}
        onSelect={desktop => onChange({ ...settings, desktop })}
        isDarkMode={isDarkMode}
      />
      <PositionGroup
        label="Mobile / tablet"
        value={settings.mobile}
        onSelect={mobile => onChange({ ...settings, mobile })}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

/** @deprecated Use PositionSettingsPanel */
export function ToastPositionSettingsPanel({
  settings,
  onChange,
  isDarkMode,
}: {
  settings: FeedbackPositionSettings;
  onChange: (settings: FeedbackPositionSettings) => void;
  isDarkMode: boolean;
}) {
  return (
    <PositionSettingsPanel
      title="Toast position"
      description="Choose where toasts appear on screen. Settings apply app-wide and are saved automatically."
      settings={settings}
      onChange={onChange}
      isDarkMode={isDarkMode}
    />
  );
}

/** Hook: reactive mobile viewport (≤1023px) */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}
