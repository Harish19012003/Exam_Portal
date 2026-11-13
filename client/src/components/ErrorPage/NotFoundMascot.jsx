import React, { useId } from 'react';

/**
 * 404 illustration: a puzzled owl perched on a signpost whose arrows point opposite ways.
 * Flat, natural shapes with soft gradients (no filters), so it stays crisp at any size.
 * The owl's eyes follow the pointer (the parent sets `--lx` / `--ly`), its head tilts and it blinks.
 */
export const NotFoundMascot = () => {
  const uid = useId().replace(/:/g, '');
  const id = (name) => `nfo-${name}-${uid}`;

  return (
    <svg className="nf-mascot" viewBox="0 0 360 400" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id('wood')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfa070" />
          <stop offset="0.55" stopColor="#a8784a" />
          <stop offset="1" stopColor="#80583a" />
        </linearGradient>
        <linearGradient id={id('board')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6c298" />
          <stop offset="1" stopColor="#c28f5a" />
        </linearGradient>
        <linearGradient id={id('owl')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b58f70" />
          <stop offset="1" stopColor="#7d5c45" />
        </linearGradient>
        <radialGradient id={id('belly')} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff8ea" />
          <stop offset="1" stopColor="#f0d8b4" />
        </radialGradient>
        <radialGradient id={id('eye')} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#f5a524" />
        </radialGradient>
        <radialGradient id={id('ground')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1e2b3a" stopOpacity="0.3" />
          <stop offset="1" stopColor="#1e2b3a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="180" cy="388" rx="112" ry="12" fill={`url(#${id('ground')})`} />

      {/* grass, stones and mushrooms at the foot of the post */}
      <ellipse cx="150" cy="388" rx="15" ry="7" fill="#b9b4d8" />
      <ellipse cx="222" cy="390" rx="12" ry="6" fill="#c9c4e6" />
      <g fill="#5fae98">
        <path d="M120 390 Q116 366 106 354 Q124 362 128 390Z" />
        <path d="M134 390 Q134 360 144 346 Q150 366 146 390Z" />
        <path d="M206 390 Q204 362 196 350 Q214 358 216 390Z" />
        <path d="M232 390 Q236 364 248 352 Q248 372 242 390Z" />
        <path d="M250 390 Q256 372 268 366 Q264 382 258 390Z" />
      </g>
      <g fill="#3f8f7a">
        <path d="M128 390 Q128 372 120 360 Q134 368 136 390Z" />
        <path d="M222 390 Q222 370 214 360 Q228 366 230 390Z" />
      </g>
      <g>
        <rect x="94" y="368" width="9" height="20" rx="4" fill="#f6e8d6" />
        <path d="M80 372 Q98 346 116 372 Z" fill="#ec6666" />
        <circle cx="92" cy="364" r="2.8" fill="#fff" />
        <circle cx="103" cy="360" r="2.2" fill="#fff" />
        <circle cx="108" cy="368" r="1.8" fill="#fff" />
        <rect x="266" y="376" width="7" height="13" rx="3" fill="#f6e8d6" />
        <path d="M255 380 Q269 360 283 380 Z" fill="#f59e0b" />
        <circle cx="263" cy="374" r="2" fill="#fff" />
        <circle cx="274" cy="372" r="1.7" fill="#fff" />
      </g>

      {/* the post */}
      <rect x="167" y="212" width="27" height="178" rx="7" fill={`url(#${id('wood')})`} />
      <path d="M175 232 V372 M187 226 V380" stroke="#4a2f17" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" />

      {/* board 1, pointing left */}
      <g transform="rotate(-2.5 180 268)">
        <path d="M80 268 L108 250 H244 Q254 250 254 260 V278 Q254 288 244 288 H108 Z" fill={`url(#${id('board')})`} stroke="#8d6034" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M120 258 H236" stroke="#fff" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" />
        <circle cx="240" cy="261" r="2.8" fill="#6b4a2b" />
        <circle cx="240" cy="277" r="2.8" fill="#6b4a2b" />
        <text x="174" y="279" textAnchor="middle" fontSize="26" fontWeight="800" fill="#6a4528" style={{ fontFamily: 'inherit' }}>?</text>
      </g>
      {/* board 2, pointing right */}
      <g transform="rotate(2.5 180 312)">
        <path d="M280 312 L252 294 H116 Q106 294 106 304 V322 Q106 332 116 332 H252 Z" fill={`url(#${id('board')})`} stroke="#8d6034" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M124 302 H240" stroke="#fff" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" />
        <circle cx="122" cy="305" r="2.8" fill="#6b4a2b" />
        <circle cx="122" cy="321" r="2.8" fill="#6b4a2b" />
        <text x="186" y="323" textAnchor="middle" fontSize="26" fontWeight="800" fill="#6a4528" style={{ fontFamily: 'inherit' }}>?</text>
      </g>

      {/* the owl: feet, wings, body, belly */}
      <g>
        <ellipse cx="163" cy="217" rx="14" ry="7" fill="#f5a524" />
        <ellipse cx="197" cy="217" rx="14" ry="7" fill="#f5a524" />
        <path d="M156 220 v5 M163 221 v6 M170 220 v5 M190 220 v5 M197 221 v6 M204 220 v5" stroke="#d98a10" strokeWidth="3" strokeLinecap="round" />

        <ellipse cx="116" cy="152" rx="21" ry="56" transform="rotate(10 116 152)" fill="#6a4d3a" />
        <ellipse cx="244" cy="152" rx="21" ry="56" transform="rotate(-10 244 152)" fill="#6a4d3a" />
        <path d="M108 128 q-8 22 -2 46 M252 128 q8 22 2 46" fill="none" stroke="#8a6a52" strokeWidth="3" strokeLinecap="round" opacity="0.7" />

        <ellipse cx="180" cy="144" rx="66" ry="80" fill={`url(#${id('owl')})`} />
        <ellipse cx="180" cy="176" rx="42" ry="52" fill={`url(#${id('belly')})`} />
        <g fill="none" stroke="#cfae85" strokeWidth="3" strokeLinecap="round">
          <path d="M156 154 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0" />
          <path d="M150 170 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0" />
          <path d="M156 186 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0" />
          <path d="M162 202 q6 7 12 0 q6 7 12 0 q6 7 12 0" />
        </g>
      </g>

      {/* head: tufts, face, eyes, beak (tilts curiously) */}
      <g className="nf-owl-head">
        <path d="M126 72 L110 24 L158 56 Z" fill="#6a4d3a" />
        <path d="M234 72 L250 24 L202 56 Z" fill="#6a4d3a" />
        <path d="M124 62 L116 40 L140 56 Z" fill="#a58468" />
        <path d="M236 62 L244 40 L220 56 Z" fill="#a58468" />
        <ellipse cx="180" cy="98" rx="66" ry="54" fill={`url(#${id('owl')})`} />
        <circle cx="150" cy="104" r="37" fill="#fff3df" stroke="#dcc29c" strokeWidth="2" />
        <circle cx="210" cy="100" r="39" fill="#fff3df" stroke="#dcc29c" strokeWidth="2" />
        {/* a lowered and a raised brow: puzzled */}
        <path d="M122 84 Q148 70 172 84" fill="none" stroke="#5a3f30" strokeWidth="8" strokeLinecap="round" />
        <path d="M190 72 Q214 50 240 68" fill="none" stroke="#5a3f30" strokeWidth="8" strokeLinecap="round" />

        <circle cx="150" cy="106" r="23" fill={`url(#${id('eye')})`} />
        <circle cx="210" cy="102" r="26" fill={`url(#${id('eye')})`} />
        <g className="nf-pupils">
          <g className="nf-look" style={{ transform: 'translate(var(--lx, 0px), var(--ly, 0px))' }}>
            <circle cx="147" cy="109" r="11.5" fill="#1f1630" />
            <circle cx="207" cy="105" r="13" fill="#1f1630" />
            <circle cx="143" cy="104" r="3.8" fill="#ffffff" />
            <circle cx="202" cy="99" r="4.2" fill="#ffffff" />
            <circle cx="152" cy="114" r="1.9" fill="#ffffff" opacity="0.85" />
            <circle cx="213" cy="111" r="2.1" fill="#ffffff" opacity="0.85" />
          </g>
        </g>
        {/* blink */}
        <ellipse className="nf-lid" cx="150" cy="106" rx="24" ry="24" fill="#8a6a52" />
        <ellipse className="nf-lid" cx="210" cy="102" rx="27" ry="27" fill="#8a6a52" />

        <path d="M171 122 Q180 117 189 122 L180 146 Z" fill="#f59e0b" />
        <path d="M175 124 Q180 121 185 124" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* fireflies (shown at night) */}
      <g className="nf-fireflies">
        <circle className="nf-firefly" cx="86" cy="232" r="9" fill="#ffe58a" opacity="0.28" />
        <circle className="nf-firefly" cx="86" cy="232" r="3" fill="#fff6c9" />
        <circle className="nf-firefly nf-firefly--b" cx="286" cy="206" r="9" fill="#ffe58a" opacity="0.28" />
        <circle className="nf-firefly nf-firefly--b" cx="286" cy="206" r="3" fill="#fff6c9" />
        <circle className="nf-firefly nf-firefly--c" cx="64" cy="320" r="9" fill="#ffe58a" opacity="0.28" />
        <circle className="nf-firefly nf-firefly--c" cx="64" cy="320" r="3" fill="#fff6c9" />
      </g>

      {/* confused question marks */}
      <text className="nf-q nf-q--a" x="272" y="62" fontSize="38" fontWeight="800" fill="#5c43fa" fillOpacity="0.6" style={{ fontFamily: 'inherit' }}>?</text>
      <text className="nf-q nf-q--b" x="62" y="70" fontSize="26" fontWeight="800" fill="#5c43fa" fillOpacity="0.5" style={{ fontFamily: 'inherit' }}>?</text>
    </svg>
  );
};
