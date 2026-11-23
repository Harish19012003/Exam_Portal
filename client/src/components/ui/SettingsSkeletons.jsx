import React from 'react';
import './BoneSkeleton.css';

/**
 * Placeholder layouts for the Settings panels. They reuse each panel's own card / grid classes, so
 * spacing and breakpoints match the real page and nothing jumps when the data arrives.
 * Shown until boneyard has captured the real layout (`pnpm --filter client bones`).
 */
const Bar = ({ w = '100%', h = 14, r = 8, className = '' }) => (
  <span className={`sk-bar ${className}`} style={{ width: w, height: h, borderRadius: r }} />
);

/** A settings card: icon + title/description, then `fields` label + input pairs. */
const FormCard = ({ fields = 3, wide = false, action = false }) => (
  <section className={`ps-card ${wide ? 'ps-card--wide' : ''}`}>
    <header className="ps-card-head">
      <Bar w={36} h={36} r={10} className="sk-bar--static-w" />
      <div className="sk-stack">
        <Bar w="42%" h={16} />
        <Bar w="78%" h={11} />
      </div>
    </header>
    {Array.from({ length: fields }, (_, i) => (
      <React.Fragment key={i}>
        <Bar w={`${22 + ((i * 9) % 18)}%`} h={12} />
        <Bar h={44} r={8} />
      </React.Fragment>
    ))}
    {action && <Bar w={120} h={38} r={10} className="sk-bar--static-w" />}
  </section>
);

/** Platform panels (General, Email, Storage, Push): optional info note, a grid of form cards, save bar. */
export const FormCardsSkeleton = ({ cards = [3, 3], wideCard = 0, note = false }) => (
  <div className="platform-settings sk-root" aria-hidden="true">
    {note && <Bar h={40} r={10} />}
    <div className="ps-grid">
      {cards.map((fields, i) => (
        <FormCard key={i} fields={fields} />
      ))}
      {wideCard > 0 && <FormCard wide fields={wideCard} action />}
    </div>
    <div className="sk-savebar">
      <Bar w={110} h={40} r={10} className="sk-bar--static-w" />
    </div>
  </div>
);

/** Config dropdown lists / field presets: optional search + filter row, then a grid of cards. */
export const CardGridSkeleton = ({ count = 6, filters = false }) => (
  <div className="sk-root" aria-hidden="true">
    {filters && (
      <div className="sk-filters">
        <Bar w="min(100%, 260px)" h={38} r={10} />
        <Bar w={140} h={38} r={10} className="sk-bar--static-w" />
        <Bar w={140} h={38} r={10} className="sk-bar--static-w" />
      </div>
    )}
    <ul className="fpp-grid fpp-grid--compact">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="fpp-card">
          <div className="fpp-card-head">
            <Bar w={36} h={36} r={10} className="sk-bar--static-w" />
            <div className="sk-stack">
              <Bar w="60%" h={15} />
              <Bar w="38%" h={11} />
            </div>
          </div>
          <div className="sk-chips">
            <Bar w={64} h={22} r={6} className="sk-bar--static-w" />
            <Bar w={84} h={22} r={6} className="sk-bar--static-w" />
            <Bar w={52} h={22} r={6} className="sk-bar--static-w" />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

/** Message templates: list of templates on the left, editor on the right. */
export const TemplatesSkeleton = () => (
  <div className="msg-templates-container sk-root" aria-hidden="true">
    <div className="msg-studio-grid">
      <div className="msg-sidebar-card">
        <div className="msg-sidebar-header">
          <Bar w="50%" h={12} />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="msg-template-card">
            <Bar w="62%" h={14} />
            <Bar w="86%" h={11} />
          </div>
        ))}
      </div>
      <div className="msg-editor-card sk-editor">
        <Bar w="36%" h={20} />
        <Bar w="70%" h={12} />
        <Bar h={44} r={8} />
        <Bar h={220} r={10} />
        <Bar w={120} h={38} r={10} className="sk-bar--static-w" />
      </div>
    </div>
  </div>
);
