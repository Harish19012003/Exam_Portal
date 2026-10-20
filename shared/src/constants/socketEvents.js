/**
 * WebSocket / Socket.IO event names — single source of truth.
 * Both server handlers and client listeners import from here.
 * Format: NAMESPACE:ACTION or NAMESPACE:ENTITY_ACTION
 */
export const SOCKET_EVENTS = Object.freeze({
  // --- Connection lifecycle ---
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // --- Generic data change signal ---
  // Server emits these; client invalidates matching React Query keys.
  // Full data is NOT pushed — only the signal.
  DATA_CHANGED: 'data:changed',

  // --- Users ---
  USER_CHANGED: 'user:changed',

  // --- Announcements ---
  ANNOUNCEMENT_CHANGED: 'announcement:changed',

  // --- Notifications ---
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',

  // --- Settings ---
  SETTINGS_CHANGED: 'settings:changed',

  // --- Network / health ---
  PING: 'ping',
  PONG: 'pong',
});
