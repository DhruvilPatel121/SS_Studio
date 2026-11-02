
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DROP all events policies that cause or risk recursion
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ADMIN full access to own events"            ON public.events;
DROP POLICY IF EXISTS "ADMIN manages studio events"                ON public.events;
DROP POLICY IF EXISTS "Owner manages own events"                   ON public.events;
DROP POLICY IF EXISTS "Photographers own events"                   ON public.events;
DROP POLICY IF EXISTS "Photographers view/manage assigned events"  ON public.events;
DROP POLICY IF EXISTS "Public events viewable by anon"             ON public.events;
DROP POLICY IF EXISTS "Public events viewable by authenticated"    ON public.events;
DROP POLICY IF EXISTS "Public read active events"                  ON public.events;
DROP POLICY IF EXISTS "SUPER_ADMIN full access to events"          ON public.events;
DROP POLICY IF EXISTS "SUPER_ADMIN full events access"             ON public.events;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Clean flat policies for events — NO sub-queries on events itself
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "sa_full_events"
  ON public.events FOR ALL TO authenticated
  USING  (get_user_role(auth.uid()) = 'SUPER_ADMIN')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "owner_full_events"
  ON public.events FOR ALL TO authenticated
  USING  (photographer_id = auth.uid())
  WITH CHECK (photographer_id = auth.uid());

CREATE POLICY "team_select_events"
  ON public.events FOR SELECT TO authenticated
  USING (
    id IN (SELECT event_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- Anon + authenticated: read any ACTIVE event (guest token access)
CREATE POLICY "public_read_active_events"
  ON public.events FOR SELECT
  USING (status = 'ACTIVE');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix photos policies — use correct column names (uploaded_by, storage_key)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public photos viewable"              ON public.photos;
DROP POLICY IF EXISTS "Anon read photos for active events"  ON public.photos;
DROP POLICY IF EXISTS "Photographer manages assigned photos" ON public.photos;
DROP POLICY IF EXISTS "ADMIN manages photos"                ON public.photos;
DROP POLICY IF EXISTS "Photographer owns photos"            ON public.photos;
DROP POLICY IF EXISTS "owner_manage_photos"                 ON public.photos;
DROP POLICY IF EXISTS "public_read_photos"                  ON public.photos;

CREATE POLICY "public_read_photos"
  ON public.photos FOR SELECT
  USING (
    event_id IN (SELECT id FROM public.events WHERE status = 'ACTIVE')
  );

CREATE POLICY "owner_manage_photos"
  ON public.photos FOR ALL TO authenticated
  USING  (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- SA full access (already existed — recreate cleanly)
DROP POLICY IF EXISTS "SUPER_ADMIN full access to photos" ON public.photos;
CREATE POLICY "sa_full_photos"
  ON public.photos FOR ALL TO authenticated
  USING  (get_user_role(auth.uid()) = 'SUPER_ADMIN')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix face_embeddings policies
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon read face_embeddings for public events" ON public.face_embeddings;
DROP POLICY IF EXISTS "Anon read face_embeddings"                   ON public.face_embeddings;
DROP POLICY IF EXISTS "public_read_face_embeddings"                 ON public.face_embeddings;
DROP POLICY IF EXISTS "Anon insert face_embeddings"                 ON public.face_embeddings;
DROP POLICY IF EXISTS "anon_insert_face_embeddings"                 ON public.face_embeddings;
DROP POLICY IF EXISTS "ADMIN/Photographer access face_embeddings"   ON public.face_embeddings;
DROP POLICY IF EXISTS "SUPER_ADMIN full access to face_embeddings"  ON public.face_embeddings;

CREATE POLICY "public_read_face_embeddings"
  ON public.face_embeddings FOR SELECT
  USING (
    photo_id IN (
      SELECT p.id FROM public.photos p
      WHERE p.event_id IN (SELECT id FROM public.events WHERE status = 'ACTIVE')
    )
  );

CREATE POLICY "service_insert_face_embeddings"
  ON public.face_embeddings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service_delete_face_embeddings"
  ON public.face_embeddings FOR DELETE
  USING (true);

CREATE POLICY "sa_full_face_embeddings"
  ON public.face_embeddings FOR ALL TO authenticated
  USING  (get_user_role(auth.uid()) = 'SUPER_ADMIN')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN');

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. processing_jobs: anon INSERT + SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon insert processing_jobs"       ON public.processing_jobs;
DROP POLICY IF EXISTS "Anon select own processing_jobs"   ON public.processing_jobs;
DROP POLICY IF EXISTS "anon_insert_processing_jobs"       ON public.processing_jobs;
DROP POLICY IF EXISTS "anon_select_processing_jobs"       ON public.processing_jobs;

CREATE POLICY "anon_insert_processing_jobs"
  ON public.processing_jobs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anon_select_processing_jobs"
  ON public.processing_jobs FOR SELECT
  USING (true);

CREATE POLICY "service_update_processing_jobs"
  ON public.processing_jobs FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. admin_permissions table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_upload     boolean NOT NULL DEFAULT true,
  can_analytics  boolean NOT NULL DEFAULT true,
  can_branding   boolean NOT NULL DEFAULT true,
  can_team       boolean NOT NULL DEFAULT true,
  can_qr         boolean NOT NULL DEFAULT true,
  can_settings   boolean NOT NULL DEFAULT false,
  max_events     integer NOT NULL DEFAULT 50,
  max_photos     integer NOT NULL DEFAULT 10000,
  max_storage_gb numeric(6,2) NOT NULL DEFAULT 50,
  notes          text,
  updated_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(admin_id)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_full_admin_permissions"
  ON public.admin_permissions FOR ALL TO authenticated
  USING  (get_user_role(auth.uid()) = 'SUPER_ADMIN')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "owner_read_own_permissions"
  ON public.admin_permissions FOR SELECT TO authenticated
  USING (admin_id = auth.uid());

-- Auto-insert default permissions when ADMIN profile created
CREATE OR REPLACE FUNCTION public.create_default_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'ADMIN' THEN
    INSERT INTO public.admin_permissions(admin_id)
    VALUES (NEW.id)
    ON CONFLICT (admin_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_admin_profile_created ON public.profiles;
CREATE TRIGGER on_admin_profile_created
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_permissions();

INSERT INTO public.admin_permissions(admin_id)
SELECT id FROM public.profiles WHERE role = 'ADMIN'
ON CONFLICT (admin_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: upsert_admin_permissions (SA only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_admin_permissions(
  p_admin_id       uuid,
  p_can_upload     boolean,
  p_can_analytics  boolean,
  p_can_branding   boolean,
  p_can_team       boolean,
  p_can_qr         boolean,
  p_can_settings   boolean,
  p_max_events     integer,
  p_max_photos     integer,
  p_max_storage_gb numeric,
  p_notes          text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF get_user_role(auth.uid()) != 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  INSERT INTO public.admin_permissions(
    admin_id, can_upload, can_analytics, can_branding, can_team,
    can_qr, can_settings, max_events, max_photos, max_storage_gb,
    notes, updated_by, updated_at
  ) VALUES (
    p_admin_id, p_can_upload, p_can_analytics, p_can_branding, p_can_team,
    p_can_qr, p_can_settings, p_max_events, p_max_photos, p_max_storage_gb,
    p_notes, auth.uid(), now()
  )
  ON CONFLICT (admin_id) DO UPDATE SET
    can_upload     = EXCLUDED.can_upload,
    can_analytics  = EXCLUDED.can_analytics,
    can_branding   = EXCLUDED.can_branding,
    can_team       = EXCLUDED.can_team,
    can_qr         = EXCLUDED.can_qr,
    can_settings   = EXCLUDED.can_settings,
    max_events     = EXCLUDED.max_events,
    max_photos     = EXCLUDED.max_photos,
    max_storage_gb = EXCLUDED.max_storage_gb,
    notes          = EXCLUDED.notes,
    updated_by     = EXCLUDED.updated_by,
    updated_at     = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_admin_permissions(uuid,boolean,boolean,boolean,boolean,boolean,boolean,integer,integer,numeric,text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Storage buckets
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('selfies',      'selfies',      false, 20971520,  ARRAY['image/jpeg','image/png','image/webp']),
  ('event-photos', 'event-photos', false, 52428800,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('zips',         'zips',         false, 524288000, ARRAY['application/zip','application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies (drop + recreate to avoid duplicates)
DROP POLICY IF EXISTS "anon_upload_selfies"         ON storage.objects;
DROP POLICY IF EXISTS "service_read_selfies"        ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_event_photos"    ON storage.objects;
DROP POLICY IF EXISTS "public_read_event_photos"    ON storage.objects;
DROP POLICY IF EXISTS "service_write_zips"          ON storage.objects;
DROP POLICY IF EXISTS "public_read_zips"            ON storage.objects;

CREATE POLICY "anon_upload_selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'selfies');

CREATE POLICY "service_read_selfies"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'selfies');

CREATE POLICY "auth_upload_event_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-photos');

CREATE POLICY "public_read_event_photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-photos');

CREATE POLICY "service_write_zips"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'zips');

CREATE POLICY "public_read_zips"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'zips');