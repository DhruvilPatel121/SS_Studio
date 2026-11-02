-- ============================================
-- COMPLETE FIX - RPC FUNCTION + RLS POLICIES + DEMO USERS
-- ============================================
-- Run this in Supabase SQL Editor to fix ALL issues
-- ============================================

-- ============================================
-- 1. CREATE MISSING RPC FUNCTION
-- ============================================
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
    (SELECT COUNT(*) FROM events) as total_events,
    (SELECT COUNT(*) FROM photos) as total_photos,
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT MAX(created_at) FROM audit_logs) as recent_activity;
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
-- 3. CREATE SIMPLE RLS POLICIES (NO COMPLEX CHECKS)
-- ============================================

-- Profiles - Simple policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Events - Simple policies (allow viewing own events)
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create events" ON events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (user_id = auth.uid());

-- Photos - Simple policies
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

-- Groups - Simple policies
CREATE POLICY "Users can view groups from own events" ON groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = groups.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can create groups in own events" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = groups.event_id AND events.user_id = auth.uid())
  );

-- Notifications - Simple policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Team members - Simple policies
CREATE POLICY "Users can view team members from own events" ON team_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = team_members.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can add team members to own events" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = team_members.event_id AND events.user_id = auth.uid())
  );

-- Processing jobs - Simple policies
CREATE POLICY "Users can view processing jobs from own photos" ON processing_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = processing_jobs.photo_id
      AND EXISTS (SELECT 1 FROM events WHERE events.id = photos.event_id AND events.user_id = auth.uid())
    )
  );

-- Guest profiles - Simple policies
CREATE POLICY "Users can view guest profiles from own events" ON guest_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = guest_profiles.event_id AND events.user_id = auth.uid())
  );

CREATE POLICY "Users can create guest profiles in own events" ON guest_profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = guest_profiles.event_id AND events.user_id = auth.uid())
  );

-- Audit logs - Simple policies
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Branding settings - Simple policies
CREATE POLICY "Users can view own branding settings" ON branding_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own branding settings" ON branding_settings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own branding settings" ON branding_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. ADD DEMO USERS
-- ============================================

-- First, check if profiles exist for demo emails
DO $$
DECLARE
  admin_exists BOOLEAN;
  superadmin_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE email = 'dhruvil.unofficial@gmail.com') INTO admin_exists;
  SELECT EXISTS(SELECT 1 FROM profiles WHERE email = 'superadminadmin@gmail.com') INTO superadmin_exists;
  
  IF NOT admin_exists THEN
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
  END IF;
  
  IF NOT superadmin_exists THEN
    INSERT INTO profiles (id, email, name, role, studio_name)
    SELECT 
      id,
      email,
      'Super Admin' as name,
      'SUPER_ADMIN' as role,
      'Dhvenue Studio' as studio_name
    FROM auth.users
    WHERE email = 'superadminadmin@gmail.com'
    ON CONFLICT (id) DO UPDATE SET
      role = 'SUPER_ADMIN',
      studio_name = 'Dhruvil Studio';
  END IF;
END $$;

-- ============================================
-- 5. VERIFICATION
-- ============================================
SELECT 'Setup Complete' as status;
SELECT 'get_profile_stats function created' as rpc_function;
SELECT 'RLS policies updated' as policies;
SELECT 'Demo users added/updated' as users;

-- Show all users
SELECT id, email, name, role, studio_name, created_at
FROM profiles
ORDER BY created_at DESC;

-- ============================================
-- DONE
-- ============================================
