import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps a page's active inner tab in the URL (?key=value) so it survives refresh and the back button.
 * The default value is kept out of the URL. Other query params are left alone.
 * `valid` (optional) lists the allowed values; anything else falls back to the default.
 */
export const useUrlState = (key, defaultValue, valid) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const value = raw && (!valid || valid.includes(raw)) ? raw : defaultValue;

  const setValue = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (!next || next === defaultValue) params.delete(key);
          else params.set(key, next);
          return params;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setSearchParams],
  );

  return [value, setValue];
};
