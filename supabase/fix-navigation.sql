# ============================================
-- FIX NAVIGATION AND ALL PAGES
-- ============================================
-- Run this after COMPLETE_FIX.sql if needed
-- ============================================

-- Add is_active column to profiles if it doesn't exist
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
-- DONE
-- ============================================
