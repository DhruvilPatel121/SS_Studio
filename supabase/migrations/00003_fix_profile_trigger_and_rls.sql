
-- ─── Fix profile auto-creation trigger ────────────────────────────────────────
-- Drop existing trigger/function and recreate with correct metadata handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_name text;
  v_studio_name text;
BEGIN
  -- Extract metadata, defaulting role to ADMIN for self-registered users
  v_role        := COALESCE(NEW.raw_user_meta_data->>'role', 'ADMIN');
  v_name        := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_studio_name := NEW.raw_user_meta_data->>'studio_name';

  INSERT INTO public.profiles (id, email, name, role, studio_name, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role::text,
    v_studio_name,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    name       = COALESCE(EXCLUDED.name, profiles.name),
    role       = COALESCE(EXCLUDED.role, profiles.role),
    studio_name = COALESCE(EXCLUDED.studio_name, profiles.studio_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Ensure contact_submissions allows anon inserts ───────────────────────────
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form"
  ON public.contact_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Super admins can read contact submissions
DROP POLICY IF EXISTS "Super admins can read contact submissions" ON public.contact_submissions;
CREATE POLICY "Super admins can read contact submissions"
  ON public.contact_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- ─── Fix audit_logs insert for service role ───────────────────────────────────
DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.audit_logs;
CREATE POLICY "Service role can manage audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);