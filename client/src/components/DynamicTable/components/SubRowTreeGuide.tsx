interface SubRowTreeGuideProps {
  isLastChild?: boolean;
  isDarkMode: boolean;
}

/**
 * Visual connector guide line for parent-to-child nested sub-rows.
 */
export function SubRowTreeGuide({ isDarkMode }: SubRowTreeGuideProps) {
  const lineStyle = isDarkMode ? 'border-teal-500/40' : 'border-teal-500/40';

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[32px] select-none">
      {/* Curved / L-shaped tree branch indicator */}
      <div className={`w-3 h-4 border-l-2 border-b-2 rounded-bl-md ${lineStyle} -mt-3 ml-1`} />
    </div>
  );
}
