export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PHOTOGRAPHER' | 'STAFF' | 'GUEST';

// DB column name aliases (snake_case from Supabase)
export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studio_name?: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// All interfaces use snake_case to match Supabase DB column names directly.
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  studio_name?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EventPrivacy = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type EventTheme = 'DEFAULT' | 'WEDDING' | 'CORPORATE' | 'BIRTHDAY' | 'SPORTS' | 'GRADUATION';
export type EventStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

export interface Event {
  id: string;
  name: string;
  slug: string;
  description?: string;
  location?: string;
  event_date?: string;
  privacy: EventPrivacy;
  theme: EventTheme;
  status: EventStatus;
  cover_image_url?: string;
  user_id: string;
  user_id?: string;
  photographer?: Partial<User>;
  photo_count?: number;
  guest_count?: number;
  face_count?: number;
  download_count?: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  ai_enabled?: boolean;
  match_threshold?: number;
  // Dual-access tokens
  public_token?: string;
  private_token?: string;
}

export interface Group {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  ai_enabled: boolean;
  photo_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  event_id: string;
  group_id?: string;
  group?: Partial<Group>;
  storage_key: string;
  thumbnail_key?: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  face_count?: number;
  processing_status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  is_favorited?: boolean;
  uploaded_by: string;
  created_at: string;
  signed_url?: string;
  thumbnail_url?: string;
}

export interface FaceEmbedding {
  id: string;
  photo_id: string;
  guest_profile_id?: string;
  bbox: number[];
  quality: number;
  created_at: string;
}

export interface GuestProfile {
  id: string;
  event_id: string;
  session_token: string;
  selfie_url?: string;
  matched_photo_count?: number;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  type: 'PHOTO_THUMBNAIL' | 'FACE_DETECTION' | 'ZIP_GENERATION';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  photo_id?: string;
  event_id?: string;
  error?: string;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type?: string;
  read_at?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  event_id: string;
  user_id: string;
  role: 'PHOTOGRAPHER' | 'STAFF';
  status?: 'INVITED' | 'ACCEPTED';
  user?: Partial<User>;
  email?: string;
}

export interface BrandingSettings {
  id: string;
  user_id: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  watermark_type?: 'NONE' | 'TEXT' | 'LOGO';
  watermark_text?: string;
  watermark_position?: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CENTER';
  watermark_opacity?: number;
  footer_text?: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user?: Partial<User>;
  action: string;
  resource: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}
