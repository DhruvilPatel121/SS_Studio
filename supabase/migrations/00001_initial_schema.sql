
-- ─── ENUMS ──────────────────────────────────────────────────────────────────
CREATE TYPE public.user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PHOTOGRAPHER', 'STAFF', 'GUEST');
CREATE TYPE public.event_status AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE public.event_privacy AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');
CREATE TYPE public.photo_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE public.job_type AS ENUM ('PHOTO_THUMBNAIL', 'FACE_DETECTION', 'ZIP_GENERATION');
CREATE TYPE public.job_status AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED');
CREATE TYPE public.watermark_type AS ENUM ('NONE', 'TEXT', 'LOGO');
CREATE TYPE public.watermark_position AS ENUM ('TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'CENTER');

-- ─── PROFILES ────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text,
  name          text NOT NULL DEFAULT '',
  role          public.user_role NOT NULL DEFAULT 'ADMIN',
  studio_name   text,
  phone         text,
  avatar_url    text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-sync new auth users to profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, studio_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'ADMIN'::public.user_role),
    NEW.raw_user_meta_data->>'studio_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Security definer helper — prevents RLS self-loop
CREATE OR REPLACE FUNCTION get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION get_user_is_active(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT is_active FROM public.profiles WHERE id = uid;
$$;

-- ─── STUDIOS ─────────────────────────────────────────────────────────────────
CREATE TABLE public.studios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  logo_url      text,
  primary_color text DEFAULT '#8B1E1E',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── EVENTS ──────────────────────────────────────────────────────────────────
CREATE TABLE public.events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       uuid REFERENCES public.studios(id) ON DELETE CASCADE,
  photographer_id uuid NOT NULL REFERENCES public.profiles(id),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  description     text,
  location        text,
  event_date      date,
  cover_image_url text,
  privacy         public.event_privacy NOT NULL DEFAULT 'PUBLIC',
  status          public.event_status NOT NULL DEFAULT 'ACTIVE',
  ai_enabled      boolean NOT NULL DEFAULT true,
  match_threshold numeric(4,3) NOT NULL DEFAULT 0.45,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── PHOTO GROUPS ────────────────────────────────────────────────────────────
CREATE TABLE public.photo_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  cover_image_url text,
  ai_enabled      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── PHOTOS ──────────────────────────────────────────────────────────────────
CREATE TABLE public.photos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id          uuid REFERENCES public.photo_groups(id) ON DELETE SET NULL,
  uploaded_by       uuid NOT NULL REFERENCES public.profiles(id),
  storage_key       text NOT NULL,
  thumbnail_key     text,
  original_name     text NOT NULL,
  mime_type         text NOT NULL,
  file_size         bigint NOT NULL DEFAULT 0,
  width             int,
  height            int,
  sha256_hash       text,
  face_count        int NOT NULL DEFAULT 0,
  processing_status public.photo_status NOT NULL DEFAULT 'PENDING',
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX photos_event_sha256_idx ON public.photos (event_id, sha256_hash) WHERE sha256_hash IS NOT NULL;

-- ─── FACE EMBEDDINGS ─────────────────────────────────────────────────────────
CREATE TABLE public.face_embeddings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id         uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  guest_profile_id uuid,
  bbox             jsonb,
  quality          numeric(5,4) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── GUEST PROFILES ──────────────────────────────────────────────────────────
CREATE TABLE public.guest_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  selfie_url          text,
  matched_photo_count int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.face_embeddings
  ADD CONSTRAINT face_embeddings_guest_profile_fk
  FOREIGN KEY (guest_profile_id) REFERENCES public.guest_profiles(id) ON DELETE SET NULL;

-- ─── BRANDING SETTINGS ───────────────────────────────────────────────────────
CREATE TABLE public.branding_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id     uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logo_url            text,
  primary_color       text DEFAULT '#8B1E1E',
  secondary_color     text DEFAULT '#B08A2E',
  watermark_type      public.watermark_type NOT NULL DEFAULT 'NONE',
  watermark_text      text,
  watermark_position  public.watermark_position NOT NULL DEFAULT 'BOTTOM_RIGHT',
  watermark_opacity   numeric(3,2) NOT NULL DEFAULT 0.5,
  footer_text         text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── TEAM MEMBERS ────────────────────────────────────────────────────────────
CREATE TABLE public.team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('PHOTOGRAPHER','STAFF')),
  status     text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED','ACCEPTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  type       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── PROCESSING JOBS ─────────────────────────────────────────────────────────
CREATE TABLE public.processing_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       public.job_type NOT NULL,
  status     public.job_status NOT NULL DEFAULT 'PENDING',
  photo_id   uuid REFERENCES public.photos(id) ON DELETE CASCADE,
  event_id   uuid REFERENCES public.events(id) ON DELETE CASCADE,
  error      text,
  attempts   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  resource    text NOT NULL,
  resource_id text,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── CONTACT SUBMISSIONS ─────────────────────────────────────────────────────
CREATE TABLE public.contact_submissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  subject    text NOT NULL,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── updated_at TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated_at   BEFORE UPDATE ON public.profiles          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_studios_updated_at    BEFORE UPDATE ON public.studios           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated_at     BEFORE UPDATE ON public.events            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_groups_updated_at     BEFORE UPDATE ON public.photo_groups      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_branding_updated_at   BEFORE UPDATE ON public.branding_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_jobs_updated_at       BEFORE UPDATE ON public.processing_jobs   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX events_photographer_idx ON public.events(photographer_id);
CREATE INDEX events_studio_idx       ON public.events(studio_id);
CREATE INDEX photos_event_idx        ON public.photos(event_id);
CREATE INDEX photos_group_idx        ON public.photos(group_id);
CREATE INDEX team_members_user_idx   ON public.team_members(user_id);
CREATE INDEX audit_logs_user_idx     ON public.audit_logs(user_id);
CREATE INDEX notifications_user_idx  ON public.notifications(user_id);