import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_ROLE_PERMISSIONS } from '@exam-view/shared';
import { initOrm, closeOrm, getEm } from './connection.js';
import { User } from './entities/index.js';
import env from '../config/env.js';

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
    last_active_offset: 0,
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
    last_active_offset: 3600 * 1000,
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
    last_active_offset: 14400 * 1000,
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
    last_active_offset: 86400 * 1000,
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
    last_active_offset: 345600 * 1000,
  },
];

async function seedDatabase() {
  console.log(`🌱 Connecting to MongoDB (${env.MONGODB_URI}/${env.MONGODB_DB_NAME})...`);
  await initOrm();
  const em = getEm();

  console.log('👥 Seeding default users...');

  for (const user of defaultUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const perms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    const lastActive = new Date(Date.now() - (user.last_active_offset || 0));

    let entity = await em.findOne(User, { email: user.email });
    if (entity) {
      em.assign(entity, {
        password_hash: passwordHash,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status,
        is_primary: Boolean(user.is_primary),
        permissions: perms,
        two_factor_enabled: Boolean(user.two_factor_enabled),
        timezone: user.timezone || 'UTC',
        last_active_at: lastActive,
      });
    } else {
      entity = em.create(User, {
        _id: uuidv4(),
        email: user.email,
        password_hash: passwordHash,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status,
        is_primary: Boolean(user.is_primary),
        permissions: perms,
        two_factor_enabled: Boolean(user.two_factor_enabled),
        timezone: user.timezone || 'UTC',
        last_active_at: lastActive,
      });
      em.persist(entity);
    }

    const tag = user.is_primary ? ' [PRIMARY ADMIN]' : '';
    console.log(`  ✅ [${user.role.toUpperCase()}${tag}] ${user.email} (Password: ${user.password})`);
  }

  await em.flush();
  await closeOrm();
  console.log('🎉 Database seeding completed successfully!');
}

seedDatabase().catch(async (err) => {
  console.error('❌ Seeding failed:', err.message);
  try {
    await closeOrm();
  } catch {
    // ignore
  }
  process.exit(1);
});
