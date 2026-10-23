import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useSummaryChipsStore } from './summaryChipsStore';

interface SummaryChipsChromeState {
  /** Chips feature is on and has at least one chip to show. */
  available: boolean;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  /** @deprecated Available is derived from the shared store; kept as a no-op for callers. */
  register: (available: boolean) => void;
}

const SummaryChipsChromeContext = createContext<SummaryChipsChromeState | null>(null);

export function SummaryChipsChromeProvider({ children }: { children: ReactNode }) {
  const store = useSummaryChipsStore();

  const value = useMemo(
    () => ({
      available: store.enabled && store.chips.length > 0,
      visible: store.visible,
      setVisible: store.setVisible,
      toggleVisible: store.toggleVisible,
      register: (_available: boolean) => {
        // no-op — availability comes from the shared summary chips store
      },
    }),
    [store.enabled, store.chips.length, store.visible, store.setVisible, store.toggleVisible],
  );

  return (
    <SummaryChipsChromeContext.Provider value={value}>{children}</SummaryChipsChromeContext.Provider>
  );
}

export function useSummaryChipsChrome() {
  return useContext(SummaryChipsChromeContext);
}

/** Eye control that sits beside the view switcher. */
export function SummaryChipsEyeToggle({ isDarkMode }: { isDarkMode: boolean }) {
  const chrome = useSummaryChipsChrome();
  if (!chrome?.available) return null;

  const eyeBtnCls = isDarkMode
    ? 'text-gray-500 hover:text-[#13C296] hover:bg-white/5'
    : 'text-gray-400 hover:text-[#13C296] hover:bg-teal-50';

  return (
    <button
      type="button"
      onClick={chrome.toggleVisible}
      className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${eyeBtnCls}`}
      aria-label={chrome.visible ? 'Hide summary chips' : 'Show summary chips'}
      title={chrome.visible ? 'Hide summary chips' : 'Show summary chips'}
    >
      {chrome.visible ? <Eye className="w-4 h-4" strokeWidth={2} /> : <EyeOff className="w-4 h-4" strokeWidth={2} />}
    </button>
  );
}
