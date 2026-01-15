-- Migration script to update old roles to new role system
-- Run this BEFORE deploying the new Prisma schema
--
-- Old roles → New roles:
-- - AGENT → PRODIGY (70%)
-- - TEAM_LEADER → GA (100%)
-- - ADMIN → AO (130%)

-- Step 1: Add new enum values to UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PRODIGY';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MGA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARTNER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AO';

-- Step 2: Update existing users with old roles to new roles
UPDATE users SET role = 'PRODIGY', commission_level = 70 WHERE role = 'AGENT';
UPDATE users SET role = 'GA', commission_level = 100 WHERE role = 'TEAM_LEADER';
UPDATE users SET role = 'AO', commission_level = 130 WHERE role = 'ADMIN';

-- Step 3: Update default value for role column
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'PRODIGY';

-- Note: Old enum values (AGENT, TEAM_LEADER, ADMIN) will remain in the enum
-- but won't be used. PostgreSQL doesn't allow removing enum values easily.
-- This is fine - they just won't be used.

-- Verify migration
SELECT role, commission_level, COUNT(*) as count
FROM users
GROUP BY role, commission_level
ORDER BY commission_level;
