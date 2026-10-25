// Shared record avatar for the Dynamic* views. Replaces the near-identical
// local copies in Card/List/Kanban/Tree/Calendar.
import { getInitials, avatarColor } from '../DynamicTable/utils';

export type RecordAvatarShape = 'circle' | 'rounded' | 'square';

export interface RecordAvatarProps {
  url?: string;
  name: string;
  size?: number;
  shape?: RecordAvatarShape;
  isDarkMode: boolean;
  /** Ring width in px. The views use 2.5 for rows and 3 for cards. */
  ringWidth?: number;
}

const SHAPE_RADIUS: Record<RecordAvatarShape, string> = {
  circle: '9999px',
  rounded: '14px',
  square: '4px',
};

export function RecordAvatar({
  url,
  name,
  size = 40,
  shape = 'circle',
  isDarkMode,
  ringWidth = 2.5,
}: RecordAvatarProps) {
  const bg = avatarColor(name || 'record');
  const border = isDarkMode ? '#111827' : '#ffffff';
  const radius = SHAPE_RADIUS[shape];

  // Use `border` for the ring — CSS `outline` ignores border-radius in print
  // and leaves square avatar-colored corners behind the circle.
  return (
    <div
      className="flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-bold select-none"
      style={{
        backgroundColor: bg,
        width: size,
        height: size,
        fontSize: size * 0.32,
        borderRadius: radius,
        border: `${ringWidth}px solid ${border}`,
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          style={{ borderRadius: radius }}
        />
      ) : (
        getInitials(name || '?')
      )}
    </div>
  );
}
