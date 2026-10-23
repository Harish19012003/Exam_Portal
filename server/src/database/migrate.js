import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import env from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🔄 Connecting to MySQL server at ' + env.DB_HOST + ':' + env.DB_PORT + '...');

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  console.log(`📦 Ensuring database "${env.DB_NAME}" exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\`;`);
  await connection.query(`USE \`${env.DB_NAME}\`;`);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`▶ Executing schema script: ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await connection.query(sql);
      console.log(`✅ Applied: ${file}`);
    } catch (err) {
      console.warn(`⚠️ Skipped or already applied (${file}): ${err.message}`);
    }
  }

  await connection.end();
  console.log('🎉 Database schema ready!');
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
