import React, { useEffect, useState } from 'react';
import './FontLab.css';

/**
 * DEV ONLY. A floating "Aa" switcher to try heading fonts on the real pages.
 * It only changes `--font-display` (headings, branding, standalone screens). Body text, tables and popups
 * keep Inter. The choice is remembered in this browser. Not included in production builds.
 */
export const FONT_OPTIONS = [
  { name: 'Sora', query: 'Sora:wght@500;600;700;800', note: 'techy, wide' },
  { name: 'Bricolage Grotesque', query: 'Bricolage+Grotesque:opsz,wght@12..96,500..800', note: 'characterful' },
  { name: 'Fraunces', query: 'Fraunces:opsz,wght@9..144,500..800', note: 'soft serif' },
  { name: 'Outfit', query: 'Outfit:wght@500;600;700;800', note: 'friendly geometric' },
  { name: 'Plus Jakarta Sans', query: 'Plus+Jakarta+Sans:wght@500;600;700;800', note: 'subtle' },
  { name: 'Manrope', query: 'Manrope:wght@500;600;700;800', note: 'clean modern' },
  { name: 'Space Grotesk', query: 'Space+Grotesk:wght@500;600;700', note: 'quirky tech' },
  { name: 'Lexend', query: 'Lexend:wght@500;600;700;800', note: 'very readable' },
  { name: 'Playfair Display', query: 'Playfair+Display:wght@600;700;800', note: 'classic serif' },
  { name: 'DM Serif Display', query: 'DM+Serif+Display', note: 'bold serif' },
];

const STORAGE_KEY = 'devDisplayFont';
const FALLBACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const ensureLink = (query) => {
  const id = `fontlab-${query.split(':')[0]}`;
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
    document.head.appendChild(link);
  }
};

/** Point the display font variable at `option` (or back to the project default when null). */
export const applyDisplayFont = (option) => {
  const root = document.documentElement;
  if (!option) {
    root.style.removeProperty('--font-display');
    return;
  }
  ensureLink(option.query);
  root.style.setProperty('--font-display', `'${option.name}', ${FALLBACK}`);
};

const readSaved = () => {
  try {
    return FONT_OPTIONS.find((f) => f.name === localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
};

export const FontLab = () => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => readSaved());

  // Re-apply the remembered choice on load.
  useEffect(() => {
    applyDisplayFont(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load every option once the panel opens so each name previews in its own font.
  useEffect(() => {
    if (open) {
      FONT_OPTIONS.forEach((f) => ensureLink(f.query));
    }
  }, [open]);

  const choose = (option) => {
    setActive(option);
    applyDisplayFont(option);
    try {
      if (option) {
        localStorage.setItem(STORAGE_KEY, option.name);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage unavailable — the choice just lasts until reload
    }
  };

  return (
    <div className="fontlab">
      {open && (
        <div className="fontlab-panel" role="dialog" aria-label="Heading font switcher">
          <div className="fontlab-head">
            <strong>Heading font</strong>
            <span>dev only · tables and popups stay Inter</span>
          </div>
          <ul className="fontlab-list">
            <li>
              <button type="button" className={`fontlab-item ${!active ? 'on' : ''}`} onClick={() => choose(null)}>
                <span className="fontlab-name">Project default</span>
                <span className="fontlab-note">whatever index.css sets</span>
              </button>
            </li>
            {FONT_OPTIONS.map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  className={`fontlab-item ${active?.name === f.name ? 'on' : ''}`}
                  onClick={() => choose(f)}
                >
                  <span className="fontlab-name" style={{ fontFamily: `'${f.name}', ${FALLBACK}` }}>{f.name}</span>
                  <span className="fontlab-note">{f.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className="fontlab-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Try heading fonts"
        title="Try heading fonts (dev only)"
      >
        Aa
      </button>
    </div>
  );
};
