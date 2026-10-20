/**
 * main.js — Application entry point.
 * Boots the HTTP server and attaches Socket.IO.
 */
import { createServer } from 'http';
import app from './app.js';
import env from './config/env.js';
import { logger } from './core/logger.js';
import { testConnection } from './database/connection.js';
import { initializeSocket } from './core/socket.js';

const PORT = env.PORT;

const httpServer = createServer(app);

async function bootstrap() {
  try {
    // 1. Test database connection
    await testConnection();

    // 2. Attach Socket.IO
    initializeSocket(httpServer, env.CLIENT_URL);
    
    // 3. Start server
    httpServer.listen(PORT, () => {
      logger.info(`[server] Running on http://localhost:${PORT}`);
      logger.info(`[server] Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
let isShuttingDown = false;
const shutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[server] ${signal} received — shutting down gracefully`);

  // Close all open keep-alive and websocket connections immediately
  if (typeof httpServer.closeAllConnections === 'function') {
    httpServer.closeAllConnections();
  }

  httpServer.close(() => {
    logger.info('[server] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 1 second if connections are stubborn
  setTimeout(() => {
    logger.warn('[server] Forcefully exiting after shutdown timeout');
    process.exit(0);
  }, 1000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGUSR2', () => shutdown('SIGUSR2'));

bootstrap();
