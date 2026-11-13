import React from 'react';

/** Sky and landscape: sun glow, drifting clouds, mountains, rolling hills and pines (stars at night). Purely visual. */
const SmallCloud = ({ className }) => (
  <svg className={`nf-cloud-float ${className}`} viewBox="0 0 170 74" aria-hidden="true" focusable="false">
    <path d="M18 66 C4 66 2 44 20 42 C20 22 46 14 58 28 C66 8 100 8 108 30 C128 20 150 34 146 52 C160 52 164 66 148 66 Z" />
  </svg>
);

/** A simple stacked pine, drawn once and reused at different sizes. */
const PINES = [
  [70, 190, 0.95], [128, 204, 0.7], [196, 212, 0.55], [372, 214, 0.5], [430, 206, 0.62],
  [1010, 214, 0.5], [1066, 206, 0.64], [1160, 200, 0.85], [1226, 212, 0.62], [1292, 196, 0.95],
];

export const NotFoundClouds = () => (
  <div className="nf-sky" aria-hidden="true">
    <span className="nf-sun" />
    <span className="nf-stars" />
    <SmallCloud className="nf-cloud-float--1" />
    <SmallCloud className="nf-cloud-float--2" />
    <SmallCloud className="nf-cloud-float--3" />
    <svg className="nf-bank" viewBox="0 0 1440 260" preserveAspectRatio="none" focusable="false">
      <defs>
        <path id="nf-pine" d="M0 -64 L-13 -34 H-6 L-18 -6 H-8 L-22 26 H22 L8 -6 H18 L6 -34 H13 Z M-4 26 H4 V38 H-4 Z" />
      </defs>
      {/* far mountains with snowy caps */}
      <path className="nf-bank-back" d="M0 150 L96 82 L178 128 L292 30 L392 124 L476 86 L572 144 L690 52 L790 130 L880 96 L986 146 L1100 40 L1210 126 L1296 84 L1380 130 L1440 100 V260 H0Z" />
      <path className="nf-snow" d="M292 30 L262 62 L280 58 L292 70 L306 56 L322 62 Z M690 52 L662 82 L678 78 L690 90 L704 76 L720 82 Z M1100 40 L1070 74 L1088 70 L1100 82 L1114 68 L1130 74 Z" />
      {/* rolling hills */}
      <path className="nf-bank-mid" d="M0 176 C120 142 240 150 340 172 C460 198 560 150 680 156 C800 162 880 204 1000 192 C1110 180 1190 140 1300 150 C1370 156 1410 172 1440 168 V260 H0Z" />
      <path className="nf-bank-front" d="M0 214 C140 186 260 196 380 210 C520 226 620 178 760 186 C900 194 980 230 1120 218 C1240 206 1340 182 1440 196 V260 H0Z" />
      {PINES.map(([x, y, scale]) => (
        <use key={`${x}-${y}`} className="nf-pine" href="#nf-pine" transform={`translate(${x} ${y}) scale(${scale})`} />
      ))}
    </svg>
  </div>
);
