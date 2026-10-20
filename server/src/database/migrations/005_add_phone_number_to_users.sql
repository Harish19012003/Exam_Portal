-- Migration: 005_add_phone_number_to_users
-- Description: Adds phone_number column to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) DEFAULT NULL AFTER last_name;
