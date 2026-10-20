import type { ConditionalFormatRule } from '../../types';
import { normalizeConditionalFormatRule, pushRecentColor } from '../../utils/conditionalFormat';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function createConditionalFormatHandlers(
  setConditionalFormats: SetState<ConditionalFormatRule[]>,
  setRecentFormatColors: SetState<string[]>,
) {
  return {
    handleAddConditionalFormat: (rule: ConditionalFormatRule) => {
      setConditionalFormats(prev => [...prev, normalizeConditionalFormatRule(rule)]);
    },
    handleUpdateConditionalFormat: (rule: ConditionalFormatRule) => {
      const normalized = normalizeConditionalFormatRule(rule);
      setConditionalFormats(prev => prev.map(r => (r.id === normalized.id ? normalized : r)));
    },
    handleDeleteConditionalFormat: (id: string) => {
      setConditionalFormats(prev => prev.filter(r => r.id !== id));
    },
    handleToggleConditionalFormat: (id: string) => {
      setConditionalFormats(prev =>
        prev.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
      );
    },
    handlePushRecentFormatColor: (hex: string) => {
      setRecentFormatColors(prev => pushRecentColor(prev, hex));
    },
  };
}
