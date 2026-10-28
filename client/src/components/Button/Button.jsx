import React from 'react';
import './Button.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * The app's one button. `variant`: primary | secondary | ghost. Pass an icon element
 * via `icon`; the label goes in `children`.
 */
export const Button = ({ variant = 'secondary', icon, children, className, type = 'button', ...rest }) => (
  <button type={type} className={cx('ui-btn', `ui-btn--${variant}`, className)} {...rest}>
    {icon}
    {children ? <span>{children}</span> : null}
  </button>
);

/** Square icon-only button, same height as Button. `label` is the accessible name and tooltip. */
export const IconButton = ({ variant = 'secondary', label, children, className, type = 'button', ...rest }) => (
  <button
    type={type}
    className={cx('ui-icon-btn', `ui-btn--${variant}`, className)}
    aria-label={label}
    title={label}
    {...rest}
  >
    {children}
  </button>
);
