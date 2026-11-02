-- 1. Ensure studios table has media_quota_limit
ALTER TABLE public.studios 
ADD COLUMN IF NOT EXISTS media_quota_limit INTEGER NOT NULL DEFAULT 25000;

-- 2. Populate studios from existing profiles where studio_name is not null
INSERT INTO public.studios (id, admin_id, name, media_quota_limit, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    p.id,
    COALESCE(p.studio_name, 'Studio ' || SUBSTRING(p.id::text, 1, 6)),
    25000,
    NOW(),
    NOW()
FROM public.profiles p
WHERE p.role = 'ADMIN'
AND NOT EXISTS (
    SELECT 1 FROM public.studios s WHERE s.admin_id = p.id OR LOWER(s.name) = LOWER(p.studio_name)
);

-- Link existing events to the appropriate studio_id if null
UPDATE public.events e
SET studio_id = s.id
FROM public.studios s
JOIN public.profiles p ON p.id = s.admin_id
WHERE e.photographer_id = p.id
AND e.studio_id IS NULL;

-- 3. RPC: create_studio_admin_account (SECURITY DEFINER)
-- Allows creating an Admin for a studio with custom media storage quota
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
SET search_path = public, auth, pg_temp
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

    -- Create or update in auth.users if available
    BEGIN
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
            aud
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
            'authenticated'
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at,
            email
        ) VALUES (
            v_user_id,
            v_user_id,
            jsonb_build_object('sub', v_user_id, 'email', v_clean_email, 'name', v_clean_name),
            'email',
            NOW(),
            NOW(),
            NOW(),
            v_clean_email
        );
    EXCEPTION WHEN OTHERS THEN
        -- If auth.users insert fails for any reason, continue to create profile
        NULL;
    END;

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
        ROUND((v_quota::numeric * 5.0) / 1024.0, 1), -- ~5MB average per photo
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

-- 4. RPC: get_studio_media_stats
-- Computes real-time active media count (photos + videos) and capacity for a studio or admin
CREATE OR REPLACE FUNCTION public.get_studio_media_stats(p_admin_id uuid DEFAULT NULL, p_studio_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_studio_id uuid;
    v_quota integer := 25000;
    v_active_count integer := 0;
    v_studio_rec record;
BEGIN
    -- Find the studio record
    IF p_admin_id IS NOT NULL THEN
        SELECT * INTO v_studio_rec FROM public.studios WHERE admin_id = p_admin_id LIMIT 1;
    ELSIF p_studio_name IS NOT NULL THEN
        SELECT * INTO v_studio_rec FROM public.studios WHERE lower(name) = lower(p_studio_name) LIMIT 1;
    END IF;

    IF v_studio_rec.id IS NOT NULL THEN
        v_studio_id := v_studio_rec.id;
        v_quota := COALESCE(v_studio_rec.media_quota_limit, 25000);
    ELSE
        -- Fallback: check admin_permissions max_photos
        IF p_admin_id IS NOT NULL THEN
            SELECT COALESCE(max_photos, 25000) INTO v_quota FROM public.admin_permissions WHERE admin_id = p_admin_id LIMIT 1;
        END IF;
    END IF;

    -- Count active photos and videos in events belonging to this studio or photographer
    SELECT COUNT(*) INTO v_active_count
    FROM public.photos p
    JOIN public.events e ON p.event_id = e.id
    WHERE (v_studio_id IS NOT NULL AND e.studio_id = v_studio_id)
       OR (p_admin_id IS NOT NULL AND (e.photographer_id = p_admin_id OR e.studio_id IN (SELECT id FROM public.studios WHERE admin_id = p_admin_id)))
       OR (p_studio_name IS NOT NULL AND e.studio_id IN (SELECT id FROM public.studios WHERE lower(name) = lower(p_studio_name)));

    RETURN jsonb_build_object(
        'studio_id', v_studio_id,
        'quota_limit', v_quota,
        'active_media_count', v_active_count,
        'remaining_capacity', GREATEST(0, v_quota - v_active_count),
        'percentage_used', CASE WHEN v_quota > 0 THEN ROUND((v_active_count::numeric / v_quota::numeric) * 100, 2) ELSE 0 END,
        'is_exceeded', (v_active_count >= v_quota)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_studio_media_stats TO anon, authenticated, service_role;

-- 5. RPC: create_studio_team_member
-- Allows a studio admin to create and manage team members (Photographer, Staff) for their own studio
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
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_studio text;
    v_user_id uuid;
    v_clean_email text := lower(trim(p_email));
    v_clean_name text := trim(p_name);
    v_clean_role text := upper(trim(p_role));
BEGIN
    -- Verify the admin's studio name
    SELECT studio_name INTO v_admin_studio FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_studio IS NULL THEN
        RAISE EXCEPTION 'Admin studio not found.';
    END IF;

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_clean_email) THEN
        RAISE EXCEPTION 'A user with email % already exists.', v_clean_email;
    END IF;

    v_user_id := gen_random_uuid();

    -- Create profile for team member in the admin's studio
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
        v_clean_role::user_role,
        v_admin_studio,
        true,
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', v_user_id,
        'email', v_clean_email,
        'name', v_clean_name,
        'role', v_clean_role,
        'studio_name', v_admin_studio
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_studio_team_member TO anon, authenticated, service_role;