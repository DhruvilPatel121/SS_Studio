DO $$
DECLARE
    v_id uuid := gen_random_uuid();
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
        aud,
        is_sso_user,
        is_anonymous
    ) VALUES (
        v_id,
        '00000000-0000-0000-0000-000000000000',
        'test_probe@example.com',
        crypt('test', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"name":"Test"}'::jsonb,
        false,
        'authenticated',
        'authenticated',
        false,
        false
    );
END $$;