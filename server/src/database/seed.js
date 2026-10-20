import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/env.js';
import { DEFAULT_ROLE_PERMISSIONS } from '@exam-view/shared';

const defaultUsers = [
  {
    email: 'paramsir8@gmail.com',
    password: 'Param@2030',
    first_name: 'Param',
    last_name: 'Admin',
    role: 'super_admin',
    status: 'active',
    is_primary: true,
    two_factor_enabled: false,
    timezone: 'Asia/Kolkata',
    last_active_offset: 0,
  },
  {
    email: 'singhrawatharish1@gmail.com',
    password: '9315561677',
    first_name: 'Harish',
    last_name: 'Rawat',
    role: 'super_admin',
    status: 'active',
    is_primary: true,
    two_factor_enabled: true,
    timezone: 'Asia/Kolkata',
    last_active_offset: 0, // now
  },
  {
    email: 'superadmin@examview.com',
    password: 'Password@123',
    first_name: 'Super',
    last_name: 'Admin',
    role: 'super_admin',
    status: 'active',
    is_primary: false,
    two_factor_enabled: true,
    timezone: 'America/New_York',
    last_active_offset: 3600 * 1000, // 1 hour ago
  },
  {
    email: 'globaladmin@examview.com',
    password: 'Password@123',
    first_name: 'Global',
    last_name: 'Admin',
    role: 'global_admin',
    status: 'active',
    is_primary: false,
    two_factor_enabled: false,
    timezone: 'Europe/London',
    last_active_offset: 14400 * 1000, // 4 hours ago
  },
  {
    email: 'admin@examview.com',
    password: 'Password@123',
    first_name: 'Portal',
    last_name: 'Admin',
    role: 'admin',
    status: 'active',
    is_primary: false,
    two_factor_enabled: false,
    timezone: 'Asia/Kolkata',
    last_active_offset: 86400 * 1000, // 1 day ago
  },
  {
    email: 'user@examview.com',
    password: 'Password@123',
    first_name: 'Standard',
    last_name: 'User',
    role: 'user',
    status: 'active',
    is_primary: false,
    two_factor_enabled: false,
    timezone: 'UTC',
    last_active_offset: 345600 * 1000, // 4 days ago
  },
];

async function seedDatabase() {
  console.log(`🌱 Connecting to MySQL (${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME})...`);

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  console.log('👥 Seeding default users (Super Admin [PRIMARY], Global Admin, Admin, User)...');

  for (const user of defaultUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const id = uuidv4();

    const perms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];

    const lastActive = new Date(Date.now() - (user.last_active_offset || 0));

    const sql = `
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, is_primary, permissions, two_factor_enabled, timezone, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        role = VALUES(role),
        status = VALUES(status),
        is_primary = VALUES(is_primary),
        permissions = VALUES(permissions),
        two_factor_enabled = VALUES(two_factor_enabled),
        timezone = VALUES(timezone),
        last_active_at = VALUES(last_active_at)
    `;

    await connection.execute(sql, [
      id,
      user.email,
      passwordHash,
      user.first_name,
      user.last_name,
      user.role,
      user.status,
      user.is_primary ? 1 : 0,
      JSON.stringify(perms),
      user.two_factor_enabled ? 1 : 0,
      user.timezone || 'UTC',
      lastActive,
    ]);

    const tag = user.is_primary ? ' [PRIMARY ADMIN]' : '';
    console.log(`  ✅ [${user.role.toUpperCase()}${tag}] ${user.email} (Password: ${user.password})`);
  }

  await connection.end();
  console.log('🎉 Database seeding completed successfully!');
}

seedDatabase().catch((err) => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
