DO $$
DECLARE
  v_role      user_role;
  v_role_raw  text := 'ADMIN';
BEGIN
  BEGIN
    v_role := v_role_raw::user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := 'ADMIN'::user_role;
  END;
  RAISE NOTICE 'Role cast OK: %', v_role;
END;
$$;