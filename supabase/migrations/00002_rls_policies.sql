
-- ─── Enable RLS on all tables ────────────────────────────────────────────────
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES ────────────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to profiles" ON public.profiles
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users update own profile (no role change)" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role IS NOT DISTINCT FROM get_user_role(auth.uid()));

-- ─── STUDIOS ─────────────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to studios" ON public.studios
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN manages own studio" ON public.studios
  FOR ALL TO authenticated
  USING (admin_id = auth.uid() AND get_user_role(auth.uid()) = 'ADMIN'::public.user_role)
  WITH CHECK (admin_id = auth.uid() AND get_user_role(auth.uid()) = 'ADMIN'::public.user_role);

CREATE POLICY "Photographers/Staff view their studio" ON public.studios
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('PHOTOGRAPHER'::public.user_role, 'STAFF'::public.user_role)
    AND id IN (
      SELECT studio_id FROM public.events e
      JOIN public.team_members tm ON tm.event_id = e.id
      WHERE tm.user_id = auth.uid()
    )
  );

-- ─── EVENTS ──────────────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to events" ON public.events
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN full access to own events" ON public.events
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'ADMIN'::public.user_role
    AND photographer_id IN (
      SELECT id FROM public.profiles
      WHERE id = auth.uid()
        OR id IN (
          SELECT p2.id FROM public.profiles p2
          JOIN public.studios s ON s.admin_id = auth.uid()
          WHERE p2.id = s.admin_id
        )
    )
  )
  WITH CHECK (get_user_role(auth.uid()) = 'ADMIN'::public.user_role);

CREATE POLICY "ADMIN manages studio events" ON public.events
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'ADMIN'::public.user_role
  )
  WITH CHECK (get_user_role(auth.uid()) = 'ADMIN'::public.user_role);

CREATE POLICY "Photographers view/manage assigned events" ON public.events
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('PHOTOGRAPHER'::public.user_role, 'STAFF'::public.user_role)
    AND id IN (
      SELECT event_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Photographers own events" ON public.events
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'PHOTOGRAPHER'::public.user_role
    AND photographer_id = auth.uid()
  );

CREATE POLICY "Public events viewable by anon" ON public.events
  FOR SELECT TO anon
  USING (privacy = 'PUBLIC'::public.event_privacy AND status = 'ACTIVE'::public.event_status);

CREATE POLICY "Public events viewable by authenticated" ON public.events
  FOR SELECT TO authenticated
  USING (privacy = 'PUBLIC'::public.event_privacy AND status = 'ACTIVE'::public.event_status);

-- ─── PHOTO GROUPS ────────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to photo_groups" ON public.photo_groups
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN manages photo_groups" ON public.photo_groups
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN'::public.user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'ADMIN'::public.user_role);

CREATE POLICY "Photographer manages assigned event groups" ON public.photo_groups
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('PHOTOGRAPHER'::public.user_role, 'STAFF'::public.user_role)
    AND event_id IN (SELECT event_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Public groups viewable" ON public.photo_groups
  FOR SELECT TO anon
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE privacy = 'PUBLIC'::public.event_privacy AND status = 'ACTIVE'::public.event_status
  ));

-- ─── PHOTOS ──────────────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to photos" ON public.photos
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN manages photos" ON public.photos
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN'::public.user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'ADMIN'::public.user_role);

CREATE POLICY "Photographer manages assigned photos" ON public.photos
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('PHOTOGRAPHER'::public.user_role, 'STAFF'::public.user_role)
    AND event_id IN (SELECT event_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Public photos viewable" ON public.photos
  FOR SELECT TO anon
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE privacy = 'PUBLIC'::public.event_privacy AND status = 'ACTIVE'::public.event_status
  ));

-- ─── FACE EMBEDDINGS ─────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to face_embeddings" ON public.face_embeddings
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN/Photographer access face_embeddings" ON public.face_embeddings
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('ADMIN'::public.user_role, 'PHOTOGRAPHER'::public.user_role)
    AND photo_id IN (
      SELECT p.id FROM public.photos p
      JOIN public.events e ON e.id = p.event_id
      WHERE get_user_role(auth.uid()) = 'ADMIN'::public.user_role
        OR e.id IN (SELECT event_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Anon read face_embeddings for public events" ON public.face_embeddings
  FOR SELECT TO anon
  USING (photo_id IN (
    SELECT p.id FROM public.photos p
    JOIN public.events e ON e.id = p.event_id
    WHERE e.privacy = 'PUBLIC'::public.event_privacy AND e.status = 'ACTIVE'::public.event_status
  ));

-- ─── GUEST PROFILES ──────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to guest_profiles" ON public.guest_profiles
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN views guest_profiles for own events" ON public.guest_profiles
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'ADMIN'::public.user_role
    AND event_id IN (SELECT id FROM public.events WHERE photographer_id = auth.uid()
                     OR get_user_role(auth.uid()) = 'ADMIN'::public.user_role)
  );

CREATE POLICY "Anon insert guest_profiles" ON public.guest_profiles
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon select own guest_profile by token" ON public.guest_profiles
  FOR SELECT TO anon USING (true);

-- ─── BRANDING SETTINGS ───────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to branding" ON public.branding_settings
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "Users manage own branding" ON public.branding_settings
  FOR ALL TO authenticated
  USING (photographer_id = auth.uid())
  WITH CHECK (photographer_id = auth.uid());

-- ─── TEAM MEMBERS ────────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to team_members" ON public.team_members
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN manages team_members" ON public.team_members
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN'::public.user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'ADMIN'::public.user_role);

CREATE POLICY "Team members view own records" ON public.team_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE POLICY "Users manage own notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "SUPER_ADMIN full access to notifications" ON public.notifications
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

-- ─── PROCESSING JOBS ─────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to processing_jobs" ON public.processing_jobs
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "ADMIN views processing_jobs" ON public.processing_jobs
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('ADMIN'::public.user_role, 'PHOTOGRAPHER'::public.user_role));

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE POLICY "SUPER_ADMIN full access to audit_logs" ON public.audit_logs
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);

CREATE POLICY "Users view own audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── CONTACT SUBMISSIONS ─────────────────────────────────────────────────────
CREATE POLICY "Anyone can insert contact_submissions" ON public.contact_submissions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone authenticated can insert contact_submissions" ON public.contact_submissions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "SUPER_ADMIN reads contact_submissions" ON public.contact_submissions
  FOR SELECT TO authenticated USING (get_user_role(auth.uid()) = 'SUPER_ADMIN'::public.user_role);