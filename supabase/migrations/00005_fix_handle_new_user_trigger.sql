
-- Drop and recreate the trigger function with correct enum cast + SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                    -- runs as the function owner (postgres), bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_role      user_role;
  v_name      text;
  v_studio_name text;
  v_role_raw  text;
BEGIN
  -- Extract metadata
  v_role_raw    := COALESCE(NEW.raw_user_meta_data->>'role', 'ADMIN');
  v_name        := COALESCE(
                     NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
                     split_part(NEW.email, '@', 1)
                   );
  v_studio_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'studio_name', '')), '');

  -- Safe cast: validate against enum, fall back to ADMIN if invalid
  BEGIN
    v_role := v_role_raw::user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := 'ADMIN'::user_role;
  END;

  INSERT INTO public.profiles (
    id, email, name, role, studio_name,
    is_active, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role,
    v_studio_name,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email       = EXCLUDED.email,
    name        = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name),
    role        = COALESCE(EXCLUDED.role, profiles.role),
    studio_name = COALESCE(EXCLUDED.studio_name, profiles.studio_name),
    updated_at  = NOW();

  RETURN NEW;
END;
$$;

-- Make sure the trigger is still wired up correctly (re-create idempotently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant execute to postgres role (owner) explicitly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;