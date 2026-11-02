-- Fix create_studio_admin_account and create_studio_team_member to include provider_id in auth.identities
CREATE OR REPLACE FUNCTION public.create_studio_admin_account(
    p_email text,
    p_password text,
    p_name text,
    p_studio_name text,
    p_quota_limit integer DEFAULT 25000,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id uuid;
    v_studio_id uuid;
    v_clean_email text := lower(trim(p_email));
    v_clean_studio text := trim(p_studio_name);
    v_clean_name text := trim(p_name);
    v_quota integer := COALESCE(p_quota_limit, 25000);
BEGIN
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_clean_email) THEN
        RAISE EXCEPTION 'A user with email % already exists.', v_clean_email;
    END IF;

    -- Generate UUID for the new user
    v_user_id := gen_random_uuid();

    -- Insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud,
        is_sso_user,
        is_anonymous
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        v_clean_email,
        crypt(p_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('name', v_clean_name, 'role', 'ADMIN', 'studio_name', v_clean_studio),
        false,
        'authenticated',
        'authenticated',
        false,
        false
    );

    -- Insert into auth.identities with provider_id required
    INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at,
        email
    ) VALUES (
        v_user_id,
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id, 'email', v_clean_email, 'name', v_clean_name),
        'email',
        NOW(),
        NOW(),
        NOW(),
        v_clean_email
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        studio_name,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_clean_email,
        v_clean_name,
        'ADMIN',
        v_clean_studio,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = 'ADMIN',
        studio_name = EXCLUDED.studio_name,
        is_active = true,
        updated_at = NOW();

    -- Create studio record
    INSERT INTO public.studios (
        id,
        admin_id,
        name,
        media_quota_limit,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        v_clean_studio,
        v_quota,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_studio_id;

    -- Insert admin permissions with specified quota limit
    INSERT INTO public.admin_permissions (
        id,
        admin_id,
        can_upload,
        can_analytics,
        can_branding,
        can_team,
        can_qr,
        can_settings,
        max_events,
        max_photos,
        max_storage_gb,
        notes,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        true,
        true,
        true,
        true,
        true,
        false,
        50,
        v_quota,
        ROUND((v_quota::numeric * 5.0) / 1024.0, 1),
        p_notes,
        NOW(),
        NOW()
    )
    ON CONFLICT (admin_id) DO UPDATE SET
        max_photos = v_quota,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_email,
        'password', p_password,
        'name', v_clean_name,
        'studio_name', v_clean_studio,
        'studio_id', v_studio_id,
        'quota_limit', v_quota
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_studio_admin_account TO anon, authenticated, service_role;

-- Also fix create_studio_team_member
CREATE OR REPLACE FUNCTION public.create_studio_team_member(
    p_admin_id uuid,
    p_name text,
    p_email text,
    p_role text,
    p_password text DEFAULT 'CamSort@Team2026!'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id uuid;
    v_studio_name text;
    v_clean_email text := lower(trim(p_email));
    v_clean_name text := trim(p_name);
    v_role text := UPPER(trim(p_role));
BEGIN
    -- Get studio name from admin
    SELECT studio_name INTO v_studio_name FROM public.profiles WHERE id = p_admin_id;
    IF v_studio_name IS NULL THEN
        v_studio_name := 'Studio Team';
    END IF;

    -- Check if user already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_clean_email) THEN
        RAISE EXCEPTION 'A user with email % already exists.', v_clean_email;
    END IF;

    v_user_id := gen_random_uuid();

    -- Insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud,
        is_sso_user,
        is_anonymous
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        v_clean_email,
        crypt(p_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('name', v_clean_name, 'role', v_role, 'studio_name', v_studio_name),
        false,
        'authenticated',
        'authenticated',
        false,
        false
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at,
        email
    ) VALUES (
        v_user_id,
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id, 'email', v_clean_email, 'name', v_clean_name),
        'email',
        NOW(),
        NOW(),
        NOW(),
        v_clean_email
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        studio_name,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_clean_email,
        v_clean_name,
        v_role,
        v_studio_name,
        true,
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', v_user_id,
        'email', v_clean_email,
        'name', v_clean_name,
        'role', v_role,
        'studio_name', v_studio_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_studio_team_member TO anon, authenticated, service_role;