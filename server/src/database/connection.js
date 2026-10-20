import mysql from 'mysql2/promise';
import env from '../config/env.js';
import { logger } from '../core/logger.js';

// Create the connection pool
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // Return dates as strings (YYYY-MM-DD HH:mm:ss) to keep UTC intact
});

/**
 * Tests the database connection with retry support.
 */
export async function testConnection(maxRetries = 5, retryDelayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await pool.getConnection();
      logger.info('✅ Successfully connected to MySQL Database');
      connection.release();
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error('❌ Failed to connect to MySQL Database after retries', error);
        process.exit(1);
      }
      logger.warn(`⚠️ MySQL connection attempt ${attempt}/${maxRetries} failed. Retrying in ${retryDelayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}
