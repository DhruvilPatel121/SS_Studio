
-- 1. Add missing auth.identity for admin@camsort.io so login works
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  NOW(), NOW(), NOW()
FROM auth.users u
WHERE u.email = 'admin@camsort.io'
  AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

-- 2. Mark all existing PENDING/PROCESSING photos as COMPLETED
--    (already uploaded to storage — face indexing is secondary)
UPDATE photos
SET processing_status = 'COMPLETED'
WHERE processing_status IN ('PENDING', 'PROCESSING');

-- 3. Add photo_count column to events if missing
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_count integer NOT NULL DEFAULT 0;

-- 4. Backfill photo_count for all events
UPDATE events e
SET photo_count = (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id);

-- 5. Trigger function to keep photo_count in sync on insert/delete
CREATE OR REPLACE FUNCTION sync_event_photo_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_event_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_event_id := OLD.event_id;
  ELSE v_event_id := NEW.event_id;
  END IF;
  UPDATE events
  SET photo_count = (SELECT COUNT(*) FROM photos WHERE event_id = v_event_id)
  WHERE id = v_event_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_photo_count ON photos;
CREATE TRIGGER trg_sync_photo_count
AFTER INSERT OR DELETE ON photos
FOR EACH ROW EXECUTE FUNCTION sync_event_photo_count();