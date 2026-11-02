-- ============================================
-- ADD DEMO USERS - ADMIN & SUPERADMIN
-- ============================================
-- Run this in Supabase SQL Editor to add demo users
-- ============================================

-- First, insert into auth.users (Supabase manages this table)
-- We'll use Supabase's auth functions to create these users
-- For demo purposes, we'll directly insert into profiles after auth is done

-- ============================================
-- OPTION 1: Create users via Supabase Auth UI (Recommended)
-- ============================================
-- Since auth.users is managed by Supabase, the best way is:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" for each user below
-- 3. Enter email and password
-- 4. Then run the SQL below to set their roles

-- ============================================
-- OPTION 2: Set roles for existing users
-- ============================================
-- If users already exist in auth.users, this will set their roles

-- Update Admin user role
UPDATE profiles
SET role = 'ADMIN'
WHERE email = 'dhruvil.unofficial@gmail.com';

-- Update Superadmin user role
UPDATE profiles
SET role = 'SUPER_ADMIN'
WHERE email = 'superadminadmin@gmail.com';

-- ============================================
-- OPTION 3: If profiles don't exist, create them
-- ============================================
-- Note: This requires the auth.users to exist first

-- Insert Admin profile (if not exists)
INSERT INTO profiles (id, email, name, role, studio_name)
SELECT 
  id,
  email,
  'Dhruvil Admin' as name,
  'ADMIN' as role,
  'Dhruvil Studio' as studio_name
FROM auth.users
WHERE email = 'dhruvil.unofficial@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'ADMIN',
  studio_name = 'Dhruvil Studio';

-- Insert Superadmin profile (if not exists)
INSERT INTO profiles (id, email, name, role, studio_name)
SELECT
  id,
  email,
  'Super Admin' as name,
  'SUPER_ADMIN' as role,
  'Dhruvil Studio' as studio_name
FROM auth.users
WHERE email = 'superadmin@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'SUPER_ADMIN',
  studio_name = 'Dhruvil Studio';

-- ============================================
-- Verification Query
-- ============================================
-- Run this to verify the users were created/updated correctly
SELECT id, email, name, role, studio_name, created_at
FROM profiles
WHERE email IN ('dhruvil.unofficial@gmail.com', 'superadminadmin@gmail.com');
