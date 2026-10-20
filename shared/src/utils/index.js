/**
 * Shared utilities used by both server and client.
 * Only pure functions — no Node.js or browser APIs.
 */

/**
 * Pauses execution for a given number of milliseconds.
 * @param {number} ms
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns true if the value is a non-null object (not an array).
 * @param {unknown} value
 */
export const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Safely parses JSON — returns null on failure instead of throwing.
 * @param {string} str
 * @returns {unknown | null}
 */
export const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

/**
 * Picks specific keys from an object.
 * @template T
 * @param {T} obj
 * @param {(keyof T)[]} keys
 * @returns {Partial<T>}
 */
export const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/**
 * Omits specific keys from an object.
 * @template T
 * @param {T} obj
 * @param {(keyof T)[]} keys
 * @returns {Partial<T>}
 */
export const omit = (obj, keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
