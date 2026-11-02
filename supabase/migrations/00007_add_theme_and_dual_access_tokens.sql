
-- 1. Add theme column to events (enum + column)
DO $$ BEGIN
  CREATE TYPE event_theme AS ENUM ('DEFAULT','WEDDING','CORPORATE','BIRTHDAY','SPORTS','GRADUATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS theme event_theme NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN IF NOT EXISTS public_token  text UNIQUE,
  ADD COLUMN IF NOT EXISTS private_token text UNIQUE;

-- 2. Generate tokens for all existing events
UPDATE public.events
SET
  public_token  = COALESCE(public_token,  encode(gen_random_bytes(16), 'hex')),
  private_token = COALESCE(private_token, encode(gen_random_bytes(16), 'hex'))
WHERE public_token IS NULL OR private_token IS NULL;

-- 3. Auto-generate tokens on insert via trigger
CREATE OR REPLACE FUNCTION public.generate_event_tokens()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token  := encode(gen_random_bytes(16), 'hex');
  END IF;
  IF NEW.private_token IS NULL THEN
    NEW.private_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_insert_generate_tokens ON public.events;
CREATE TRIGGER on_event_insert_generate_tokens
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.generate_event_tokens();

-- 4. Fix RLS on events: admins only see their own events
-- Drop old permissive policies first
DROP POLICY IF EXISTS "Photographers manage own events" ON public.events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Public events viewable" ON public.events;

-- Recreate with proper isolation
CREATE POLICY "Owner manages own events"
  ON public.events FOR ALL
  USING (photographer_id = auth.uid())
  WITH CHECK (photographer_id = auth.uid());

CREATE POLICY "SUPER_ADMIN full events access"
  ON public.events FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN');

-- Public read for guest event access (by slug or token)
CREATE POLICY "Public read active events"
  ON public.events FOR SELECT
  USING (status = 'ACTIVE');

-- 5. Fix RLS on profiles: admins only see their own profile (plus SUPER_ADMIN sees all)
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "SUPER_ADMIN full access to profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "SUPER_ADMIN full access to profiles"
  ON public.profiles FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN');

-- 6. Guest access by token: read event by public or private token (no auth needed)
CREATE OR REPLACE FUNCTION public.get_event_by_public_token(p_token text)
RETURNS SETOF public.events LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.events WHERE public_token = p_token AND status = 'ACTIVE' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_event_by_private_token(p_token text)
RETURNS SETOF public.events LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.events WHERE private_token = p_token AND status = 'ACTIVE' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_by_public_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_by_private_token(text) TO anon, authenticated;