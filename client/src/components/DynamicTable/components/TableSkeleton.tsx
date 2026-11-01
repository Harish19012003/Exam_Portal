import './TableSkeleton.css';

type TableSkeletonProps = {
  /** Number of shimmer body rows */
  rows?: number;
  /** Approximate column count for header/cell bars */
  columns?: number;
  isDarkMode?: boolean;
  className?: string;
};

/** Placeholder chrome matching DynamicTable while rows/layout load. */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  isDarkMode = false,
  className = '',
}: TableSkeletonProps) {
  const cols = Math.max(3, Math.min(columns, 8));

  return (
    <div
      className={`dt-skeleton${isDarkMode ? ' is-dark' : ''} ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading table"
    >
      <span className="sr-only">Loading table…</span>

      <div className="dt-skeleton__toolbar">
        <div className="dt-skeleton__search dt-skeleton__bar" />
        <div className="dt-skeleton__tools">
          <div className="dt-skeleton__icon dt-skeleton__bar" />
          <div className="dt-skeleton__icon dt-skeleton__bar" />
          <div className="dt-skeleton__icon dt-skeleton__bar" />
          <div className="dt-skeleton__icon dt-skeleton__bar" />
        </div>
      </div>

      <div className="dt-skeleton__table" aria-hidden="true">
        <div className="dt-skeleton__head">
          <div className="dt-skeleton__check dt-skeleton__bar" />
          {Array.from({ length: cols }, (_, i) => (
            <div
              key={`h-${i}`}
              className="dt-skeleton__cell dt-skeleton__bar"
              style={{ width: `${56 + ((i * 17) % 28)}%` }}
            />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={`r-${r}`} className={`dt-skeleton__row${r % 2 ? ' is-alt' : ''}`}>
            <div className="dt-skeleton__check dt-skeleton__bar" />
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={`c-${r}-${c}`}
                className="dt-skeleton__cell dt-skeleton__bar"
                style={{ width: `${48 + ((r * 11 + c * 19) % 40)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
