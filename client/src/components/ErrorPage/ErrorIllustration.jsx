import React, { useId } from 'react';

/**
 * Small hand-drawn style scene for each kind of error: a page character with a face and a badge.
 * Colours come from `--ea` (set per error kind in ErrorPage.css), so it follows the accent and theme.
 */
const FACES = {
  generic: { mouth: 'M154 134 q14 -13 28 0', eyes: 'normal' },   // sad
  stale: { mouth: 'M154 126 q14 13 28 0', eyes: 'normal' },      // happy
  notfound: { mouth: 'M153 130 q6.5 -7 13 0 t13 0', eyes: 'odd' }, // confused
  forbidden: { mouth: 'M156 130 h24', eyes: 'normal' },          // firm
};

const BADGE_TEXT = { generic: '!', stale: 'NEW', notfound: '404' };

export const ErrorIllustration = ({ kind = 'generic' }) => {
  const uid = useId().replace(/:/g, '');
  const body = `ei-body-${uid}`;
  const bit = `ei-bit-${uid}`;
  const face = FACES[kind] || FACES.generic;

  return (
    <svg className="app-error-illustration" viewBox="0 0 320 250" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ea)', stopOpacity: 0.16 }} />
          <stop offset="1" style={{ stopColor: 'var(--ea)', stopOpacity: 0.42 }} />
        </linearGradient>
        <linearGradient id={bit} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ea)', stopOpacity: 0.14 }} />
          <stop offset="1" style={{ stopColor: 'var(--ea)', stopOpacity: 0.3 }} />
        </linearGradient>
      </defs>

      {/* soft backdrop */}
      <path
        d="M48 152 C36 108 92 82 152 90 C216 98 272 84 288 130 C302 170 254 208 190 212 C120 218 58 198 48 152Z"
        style={{ fill: 'var(--ea)', opacity: 0.09 }}
      />
      <ellipse cx="166" cy="216" rx="64" ry="9" fill="#0f172a" opacity="0.08" />

      {/* floating bits */}
      <g className="app-error-float app-error-float--a">
        <rect x="58" y="108" width="36" height="44" rx="7" transform="rotate(-18 76 130)" fill={`url(#${bit})`} />
        <path d="M70 120 h14 M70 129 h10" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.4" strokeLinecap="round" transform="rotate(-18 76 130)" />
      </g>
      <g className="app-error-float app-error-float--b">
        <rect x="238" y="124" width="32" height="38" rx="7" transform="rotate(16 254 143)" fill={`url(#${bit})`} />
        <path d="M247 136 h13 M247 145 h9" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.4" strokeLinecap="round" transform="rotate(16 254 143)" />
      </g>
      <circle cx="266" cy="66" r="5" style={{ fill: 'var(--ea)', opacity: 0.28 }} />
      <circle cx="72" cy="182" r="6.5" fill="none" style={{ stroke: 'var(--ea)', strokeOpacity: 0.45 }} strokeWidth="2.2" />
      <circle cx="104" cy="60" r="3.5" style={{ fill: 'var(--ea)', opacity: 0.2 }} />

      {/* the page character */}
      <g className="app-error-page">
        {/* opaque base so the backdrop does not show through the tinted page */}
        <path d="M124 36 H190 L226 72 V178 a18 18 0 0 1 -18 18 H124 a18 18 0 0 1 -18 -18 V54 a18 18 0 0 1 18 -18Z" style={{ fill: 'var(--bg-card, #ffffff)' }} />
        <path d="M124 36 H190 L226 72 V178 a18 18 0 0 1 -18 18 H124 a18 18 0 0 1 -18 -18 V54 a18 18 0 0 1 18 -18Z" fill={`url(#${body})`} />
        <path d="M190 36 L226 72 H208 a18 18 0 0 1 -18 -18Z" style={{ fill: 'var(--ea)', opacity: 0.4 }} />
        {/* face */}
        <circle cx="148" cy="104" r={face.eyes === 'odd' ? 5.5 : 4.6} style={{ fill: 'var(--ea)', opacity: 0.85 }} />
        <circle cx="186" cy="104" r={face.eyes === 'odd' ? 3.6 : 4.6} style={{ fill: 'var(--ea)', opacity: 0.85 }} />
        <path d={face.mouth} fill="none" style={{ stroke: 'var(--ea)', strokeOpacity: 0.85 }} strokeWidth="3.2" strokeLinecap="round" />
        {kind === 'generic' && <path d="M140 92 q8 -5 16 -1 M178 91 q8 -4 16 1" fill="none" style={{ stroke: 'var(--ea)', strokeOpacity: 0.5 }} strokeWidth="2.4" strokeLinecap="round" />}

        {/* badge */}
        <g transform="translate(174 152)">
          <rect width="64" height="38" rx="11" style={{ fill: 'var(--ea)' }} />
          <rect width="64" height="38" rx="11" fill="#fff" opacity="0.08" />
          {kind === 'forbidden' ? (
            <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              <rect x="22" y="17" width="20" height="14" rx="3.5" fill="#fff" stroke="none" />
              <path d="M26 17 v-4 a6 6 0 0 1 12 0 v4" />
            </g>
          ) : (
            <text
              x="32"
              y="26"
              textAnchor="middle"
              fill="#fff"
              style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: kind === 'generic' ? 24 : 17 }}
            >
              {BADGE_TEXT[kind] || '!'}
            </text>
          )}
        </g>
      </g>
    </svg>
  );
};
