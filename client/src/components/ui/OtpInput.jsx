import React, { useEffect, useRef } from 'react';
import './OtpInput.css';

/**
 * 6-digit segmented OTP input with paste, mobile autofill, and keyboard navigation.
 */
export const OtpInput = ({
  id,
  length = 6,
  value = '',
  onChange,
  autoFocus = false,
  disabled = false,
  hasError = false,
  ariaLabel = 'Verification code',
}) => {
  const inputRefs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const focusAt = (index) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    const el = inputRefs.current[clamped];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const applyDigits = (startIndex, rawText) => {
    const clean = String(rawText || '').replace(/\D/g, '');
    if (!clean) return;

    const next = [...digits];
    // Full-code paste (or multi-digit paste from the first box) replaces from index 0
    const begin = clean.length >= length ? 0 : startIndex;
    let cursor = begin;

    for (let i = 0; i < clean.length && cursor < length; i += 1) {
      next[cursor] = clean[i];
      cursor += 1;
    }

    onChange(next.join('').slice(0, length));
    focusAt(Math.min(cursor, length - 1));
  };

  const handleChange = (index, e) => {
    const raw = e.target.value;
    const clean = raw.replace(/\D/g, '');

    // Handle mobile SMS/email autofill or multi-character input
    if (clean.length > 1) {
      applyDigits(index, clean);
      return;
    }

    const next = [...digits];
    next[index] = clean;
    onChange(next.join(''));

    if (clean && index < length - 1) {
      focusAt(index + 1);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        onChange(next.join(''));
      } else if (index > 0) {
        next[index - 1] = '';
        onChange(next.join(''));
        focusAt(index - 1);
      }
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      const next = [...digits];
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (index > 0) focusAt(index - 1);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (index < length - 1) focusAt(index + 1);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      focusAt(length - 1);
    }
  };

  const handlePaste = (index, e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    const clean = pasted.replace(/\D/g, '');
    if (!clean) return;
    e.preventDefault();
    applyDigits(index, clean);
  };

  return (
    <div
      className={`otp-boxes${length === 6 ? ' otp-boxes--grouped' : ''}${hasError ? ' is-error' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {digits.map((digit, index) => (
        <React.Fragment key={index}>
          {length === 6 && index === 3 && (
            <span className="otp-sep" aria-hidden="true" />
          )}
          <input
            id={index === 0 ? id : undefined}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={`otp-box${digit ? ' is-filled' : ''}`}
            value={digit}
            placeholder="•"
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
            onFocus={(e) => e.target.select()}
          />
        </React.Fragment>
      ))}
    </div>
  );
};
