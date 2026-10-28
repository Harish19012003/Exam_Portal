import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load variables from server/.env into process.env reliably
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('7002'),
  CLIENT_URL: z.string().url().default('http://localhost:7001'),

  /** MongoDB connection URI (local or Atlas). */
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017'),
  MONGODB_DB_NAME: z.string().min(1).default('exam_view'),
  /** Future engine switch: mongo | postgres (postgres adapter not shipped yet). */
  DB_DRIVER: z.enum(['mongo', 'postgres']).default('mongo'),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['smtp', 'google', 'outlook']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@examview.com'),

  WHATSAPP_API_URL: z.string().url().default('https://wa.officall.ceoitbox.com'),
  WHATSAPP_API_KEY: z.string().optional(),

  GOOGLE_MAPS_API_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default('common'),
  MICROSOFT_CALLBACK_URL: z.string().url().optional(),

  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export default parsed.data;
