-- ============================================
-- CREATE RPC FUNCTION get_profile_by_email
-- ============================================
-- Run this in Supabase SQL Editor if get_profile_by_email is missing
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
