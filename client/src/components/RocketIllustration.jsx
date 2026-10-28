import React from 'react';

export const RocketIllustration = ({ className = 'login-rocket' }) => (
  <svg className={className} viewBox="0 0 320 300" role="img" aria-label="Rocket illustration">
    <defs>
      <linearGradient id="lr-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff8a5c" />
        <stop offset="1" stopColor="#e8431f" />
      </linearGradient>
      <radialGradient id="lr-cloud" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#dbe7ff" />
      </radialGradient>
    </defs>
    <g fill="url(#lr-cloud)">
      <ellipse cx="38" cy="190" rx="34" ry="24" />
      <ellipse cx="78" cy="205" rx="42" ry="28" />
      <ellipse cx="120" cy="215" rx="30" ry="22" />
      <ellipse cx="60" cy="225" rx="30" ry="18" />
      <ellipse cx="95" cy="22" rx="20" ry="13" />
      <ellipse cx="108" cy="26" rx="14" ry="10" />
      <ellipse cx="262" cy="262" rx="24" ry="14" />
      <ellipse cx="278" cy="266" rx="16" ry="10" />
    </g>
    <g transform="rotate(28 190 160)">
      <path d="M190 40 C235 80 238 170 218 235 L162 235 C142 170 145 80 190 40 Z" fill="url(#lr-body)" />
      <path d="M190 40 C205 55 214 72 219 92 L161 92 C166 72 175 55 190 40 Z" fill="#fff4ee" />
      <circle cx="190" cy="130" r="17" fill="#fff" />
      <circle cx="190" cy="130" r="11" fill="#2b9cff" />
      <path d="M162 190 L125 245 L162 232 Z" fill="#2a2f45" />
      <path d="M218 190 L255 245 L218 232 Z" fill="#2a2f45" />
      <path d="M172 235 L190 275 L208 235 Z" fill="#ffc94d" />
    </g>
    <g transform="translate(170 62) rotate(28)">
      <circle cx="0" cy="0" r="11" fill="#2a2f45" />
      <rect x="-12" y="8" width="24" height="34" rx="10" fill="#ff7a59" />
      <rect x="-8" y="38" width="7" height="24" rx="3" fill="#3b4cca" />
      <rect x="2" y="38" width="7" height="24" rx="3" fill="#3b4cca" />
    </g>
  </svg>
);
