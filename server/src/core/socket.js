import { Server } from 'socket.io';
import { verifyAccessToken } from './jwt.js';
import { logger } from './logger.js';
import { SOCKET_EVENTS } from '@exam-view/shared';

let io;

/**
 * Initializes the Socket.IO server.
 * @param {import('http').Server} httpServer 
 */
export const initializeSocket = (httpServer, clientUrl) => {
  io = new Server(httpServer, {
    cors: {
      origin: clientUrl,
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }
      const user = verifyAccessToken(token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[socket] User connected: ${socket.user.id} (Socket ID: ${socket.id})`);

    // Join user-specific room for direct notifications
    socket.join(`user:${socket.user.id}`);

    // Join role-specific room (e.g., to broadcast to all admins)
    socket.join(`role:${socket.user.role}`);

    socket.on('disconnect', () => {
      logger.info(`[socket] User disconnected: ${socket.user.id} (Socket ID: ${socket.id})`);
    });
  });

  return io;
};

/**
 * Returns the initialized Socket.IO instance.
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};

/**
 * Utility to emit an event to a specific user.
 */
export const notifyUser = (userId, eventName, payload) => {
  if (io) {
    io.to(`user:${userId}`).emit(eventName, payload);
  }
};
