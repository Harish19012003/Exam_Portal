/** Transpose control icon — vertical + horizontal bars with a corner pivot. */
export function TransposeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Vertical bar (column) */}
      <rect
        x="2.75"
        y="7"
        width="6"
        height="14.25"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Horizontal bar (row) */}
      <rect
        x="10.5"
        y="2.75"
        width="10.75"
        height="6"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Corner pivot — suggests the swap */}
      <path
        d="M13.25 21.25V15.5a2 2 0 0 1 2-2H21.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
