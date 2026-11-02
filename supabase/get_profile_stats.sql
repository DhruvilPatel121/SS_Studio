-- ============================================
-- CREATE RPC FUNCTION get_profile_stats
-- ============================================
-- Run this in Supabase SQL Editor
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
