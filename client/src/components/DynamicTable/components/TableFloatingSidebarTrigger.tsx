import { DynamicIcon } from './DynamicIcon';
import { cornerFabClass, ViewCornerFabStack } from '../../DynamicData/ViewCornerFabs';

interface TableFloatingSidebarTriggerProps {
  isOpen: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
}

export function TableFloatingSidebarTrigger({
  isOpen,
  onToggle,
  isDarkMode,
}: TableFloatingSidebarTriggerProps) {
  return (
    <ViewCornerFabStack expanded={isOpen}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Close table sidebar' : 'Open table sidebar'}
        aria-expanded={isOpen}
        className={cornerFabClass(isDarkMode, isOpen)}
      >
        <DynamicIcon iconName="material-symbols:construction" className="h-6 w-6" />
      </button>
    </ViewCornerFabStack>
  );
}
