CREATE OR REPLACE FUNCTION public.get_profile_by_email(lookup_email text)
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE lower(email) = lower(trim(lookup_email)) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_email(text) TO anon, authenticated;