import React from 'react';
import { Skeleton, configureBoneyard } from 'boneyard-js/react';
import '../../bones/registry';
import './BoneSkeleton.css';

// Same look as boneyard.config.json (the CLI reads that file, the runtime reads this call).
configureBoneyard({
  color: '#e6e8ee',
  darkColor: '#1f2937',
  animate: 'shimmer',
  shimmerColor: '#f4f5f8',
  darkShimmerColor: '#2b3648',
  speed: '1.6s',
  transition: 150,
  // Bones are captured per viewport width, and the page sits inside the sidebar layout.
  select: 'viewport',
});

/** Generic placeholder when a panel passes no `fallback` of its own; used until the real layout has been captured (`pnpm --filter client bones`). */
const GenericFallback = ({ rows = 4 }) => (
  <div className="bone-fallback" aria-hidden="true">
    <span className="bone-fallback__bar bone-fallback__bar--title" />
    {Array.from({ length: rows }, (_, i) => (
      <span key={i} className="bone-fallback__bar" style={{ width: `${92 - (i % 3) * 14}%` }} />
    ))}
  </div>
);

/**
 * Skeleton for one part of a page. `name` must be unique: boneyard finds the element by that name,
 * snapshots the real rendered layout (all breakpoints) and shows it as grey shapes while `loading`.
 * Children must render with empty/default data — they are measured, never shown, while loading.
 */
export const BoneSkeleton = ({ name, loading, rows, fallback, children, className }) => (
  <Skeleton name={name} loading={loading} className={className} fallback={fallback ?? <GenericFallback rows={rows} />}>
    {children}
  </Skeleton>
);
