-- ============================================
-- DHDRVIL STUDIO - SUPABASE DATABASE SETUP
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "vector";

-- Set timezone to UTC
SET timezone = 'UTC';

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  studio_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'ADMIN',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  status TEXT DEFAULT 'ACTIVE',
  cover_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'MEMBER',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROCESSING JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING',
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GUEST PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS guest_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  access_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BRANDING SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  studio_name TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  font_family TEXT DEFAULT 'Inter',
  custom_css TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_by ON photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_groups_event_id ON groups(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_team_members_event_id ON team_members(event_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_photo_id ON processing_jobs(photo_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_guest_profiles_event_id ON guest_profiles(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_profiles_token ON guest_profiles(access_token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_branding_settings_user_id ON branding_settings(user_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist
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

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Events policies
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create events" ON events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (user_id = auth.uid());

-- Photos policies
CREATE POLICY "Users can view photos from own events" ON photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = photos.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload photos to own events" ON photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = photos.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own photos" ON photos
  FOR DELETE USING (uploaded_by = auth.uid());

-- Groups policies
CREATE POLICY "Users can view groups from own events" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = groups.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create groups in own events" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = groups.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Team members policies
CREATE POLICY "Users can view team members from own events" ON team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = team_members.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add team members to own events" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = team_members.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Processing jobs policies
CREATE POLICY "Users can view processing jobs from own photos" ON processing_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = processing_jobs.photo_id
      AND EXISTS (
        SELECT 1 FROM events
        WHERE events.id = photos.event_id
        AND events.user_id = auth.uid()
      )
    )
  );

-- Guest profiles policies
CREATE POLICY "Users can view guest profiles from own events" ON guest_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = guest_profiles.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create guest profiles in own events" ON guest_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = guest_profiles.event_id
      AND events.user_id = auth.uid()
    )
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
-- CREATE TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branding_settings_updated_at BEFORE UPDATE ON branding_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CREATE FUNCTION TO HANDLE NEW USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'ADMIN')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- CREATE RPC FUNCTION get_profile_by_email
-- ============================================
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
-- SETUP COMPLETE
-- ============================================
-- Your database is now ready for Dhruvil Studio!
-- ============================================
