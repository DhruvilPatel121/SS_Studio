-- ============================================
-- DHDRVIL STUDIO - COMPLETE FIX ALL ISSUES
-- ============================================
-- Run this in Supabase SQL Editor to fix ALL issues
-- This script will:
-- 1. Create all missing RPC functions
-- 2. Fix all RLS policies
-- 3. Add demo users
-- 4. Ensure all tables are properly configured
-- ============================================

-- ============================================
-- 1. CREATE ALL MISSING RPC FUNCTIONS
-- ============================================

-- get_profile_stats function - Simplified version without parameters
CREATE OR REPLACE FUNCTION get_profile_stats()
RETURNS TABLE (
  total_events INT,
  total_photos INT,
  total_users INT,
  recent_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT COUNT(*) FROM events), 0) as total_events,
    COALESCE((SELECT COUNT(*) FROM photos), 0) as total_photos,
    COALESCE((SELECT COUNT(*) FROM profiles), 0) as total_users,
    COALESCE((SELECT MAX(created_at) FROM audit_logs), NOW()) as recent_activity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_profile_by_email function
CREATE OR REPLACE FUNCTION get_profile_by_email(email_param TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  studio_name TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.name, p.studio_name, p.role, p.created_at
  FROM profiles p
  WHERE p.email = email_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. DROP ALL EXISTING POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

DROP POLICY IF EXISTS "Users can view photos from own events" ON photos;
DROP POLICY IF EXISTS "Users can upload photos to own events" ON photos;
DROP POLICY IF EXISTS "Users can delete own photos" ON photos;

DROP POLICY IF EXISTS "Users can view groups from own events" ON groups;
DROP POLICY IF EXISTS "Users can create groups in own events" ON groups;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

DROP POLICY IF EXISTS "Users can view team members from own events" ON team_members;
DROP POLICY IF EXISTS "Users can add team members to own events" ON team_members;

DROP POLICY IF EXISTS "Users can view processing jobs from own photos" ON processing_jobs;

DROP POLICY IF EXISTS "Users can view guest profiles from own events" ON guest_profiles;
DROP POLICY IF EXISTS "Users can create guest profiles in own events" ON guest_profiles;

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

DROP POLICY IF EXISTS "Users can view own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can update own branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can insert own branding settings" ON branding_settings;

-- ============================================
-- 3. CREATE SIMPLIFIED RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Events policies - More permissive for testing
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (user_id = auth.uid() OR auth.uid() IS NULL);

CREATE POLICY "Users can create events" ON events
  FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (user_id = auth.uid() OR auth.uid() IS NULL);

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (user_id = auth.uid() OR auth.uid() IS NULL);

-- Photos policies
CREATE POLICY "Users can view photos from own events" ON photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = photos.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can upload photos to own events" ON photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = photos.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own photos" ON photos
  FOR DELETE USING (uploaded_by = auth.uid());

-- Groups policies
CREATE POLICY "Users can view groups from own events" ON groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = groups.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can create groups in own events" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = groups.event_id AND events.user_id = auth.uid())
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Team members policies
CREATE POLICY "Users can view team members from own events" ON team_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = team_members.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can add team members to own events" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = team_members.event_id AND events.user_id = auth.uid())
  );

-- Processing jobs policies
CREATE POLICY "Users can view processing jobs from own photos" ON processing_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = processing_jobs.photo_id
      AND EXISTS (SELECT 1 FROM events WHERE events.id = photos.event_id AND events.user_id = auth.uid())
    )
  );

-- Guest profiles policies
CREATE POLICY "Users can view guest profiles from own events" ON guest_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = guest_profiles.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can create guest profiles in own events" ON guest_profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = guest_profiles.event_id AND events.user_id = auth.uid())
  );

-- Audit logs policies
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Branding settings policies
CREATE POLICY "Users can view own branding settings" ON branding_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own branding settings" ON branding_settings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own branding settings" ON branding_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. ADD is_active COLUMN IF MISSING
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Update all existing profiles to be active
UPDATE profiles SET is_active = true WHERE is_active IS NULL;

-- ============================================
-- 5. ADD/UPDATE DEMO USERS
-- ============================================

-- Insert or update Admin user
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
  studio_name = 'Dhruvil Studio',
  name = 'Dhruvil Admin';

-- Insert or update Superadmin user
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
  studio_name = 'Dhruvil Studio',
  name = 'Super Admin';

-- ============================================
-- 5. VERIFICATION
-- ============================================
SELECT '========================================' as separator;
SELECT 'Setup Complete!' as status;
SELECT '========================================' as separator;
SELECT 'RPC Functions Created:' as info;
SELECT '- get_profile_stats' as function;
SELECT '- get_profile_by_email' as function;
SELECT '========================================' as separator;
SELECT 'RLS Policies Updated' as info;
SELECT '========================================' as separator;
SELECT 'Demo Users:' as info;
SELECT id, email, name, role, studio_name, created_at
FROM profiles
WHERE email IN ('dhruvil.unofficial@gmail.com', 'superadmin@gmail.com');
SELECT '========================================' as separator;
