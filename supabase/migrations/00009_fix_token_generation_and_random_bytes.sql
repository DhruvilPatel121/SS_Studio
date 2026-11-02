
-- Fix 1: Use pgcrypto's gen_random_bytes properly (it needs pgcrypto extension)
-- Use replace(gen_random_uuid()::text,'-','') as a safer UUID-based token — no extension needed
CREATE OR REPLACE FUNCTION public.generate_event_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- Fix 2: Rebuild the trigger function using the safe helper
CREATE OR REPLACE FUNCTION public.fn_generate_event_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := public.generate_event_token();
  END IF;
  IF NEW.private_token IS NULL THEN
    NEW.private_token := public.generate_event_token();
  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_event_insert_generate_tokens ON public.events;
CREATE TRIGGER on_event_insert_generate_tokens
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.fn_generate_event_tokens();

-- Fix 3: Backfill any events that still have NULL tokens
UPDATE public.events
SET
  public_token  = COALESCE(public_token,  public.generate_event_token()),
  private_token = COALESCE(private_token, public.generate_event_token())
WHERE public_token IS NULL OR private_token IS NULL;

-- Fix 4: Also fix guest_profiles default — use uuid instead of gen_random_bytes
ALTER TABLE public.guest_profiles
  ALTER COLUMN session_token SET DEFAULT replace(gen_random_uuid()::text,'-','');

GRANT EXECUTE ON FUNCTION public.generate_event_token() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_generate_event_tokens() TO authenticated;