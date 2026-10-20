import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:7002';

let socket = null;

export const initializeSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'], // fallback to polling if ws fails
  });

  socket.on('connect', () => {
    console.log('[socket] Connected to realtime server');
  });

  socket.on('disconnect', () => {
    console.log('[socket] Disconnected from realtime server');
  });

  socket.on('connect_error', (error) => {
    console.error('[socket] Connection Error:', error.message);
  });

  return socket;
};

export const getSocket = () => socket;
