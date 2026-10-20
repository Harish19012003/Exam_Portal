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

  await connection.query(`CREATE TABLE IF NOT EXISTS \`_migrations\` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);

  const [appliedRows] = await connection.query(`SELECT name FROM \`_migrations\`;`);
  const appliedSet = new Set(appliedRows.map((r) => r.name));

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏭ Skipping already applied migration: ${file}`);
      continue;
    }
    console.log(`▶ Running migration: ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await connection.query(sql);
    await connection.query(`INSERT INTO \`_migrations\` (name) VALUES (?);`, [file]);
    console.log(`✅ Applied: ${file}`);
  }

  await connection.end();
  console.log('🎉 All migrations applied successfully!');
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
