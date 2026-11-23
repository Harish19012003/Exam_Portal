import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Apply several query updates in one navigation. Empty / null / undefined removes the key.
 * Use this when clearing multiple filters at once — consecutive setSearchParams calls can race.
 */
export const useUrlParamsPatch = () => {
  const [, setSearchParams] = useSearchParams();
  return useCallback(
    (patch, { replace = true } = {}) => {
      if (!patch || typeof patch !== 'object') return;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, next]) => {
            if (next == null || next === '') params.delete(key);
            else params.set(key, String(next));
          });
          return params;
        },
        { replace },
      );
    },
    [setSearchParams],
  );
};

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
