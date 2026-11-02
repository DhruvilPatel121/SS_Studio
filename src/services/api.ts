import { supabase } from '@/db/supabase';
import { useAuthStore } from '@/stores/auth.store';
import type {
  User, Event, Group, Photo, ProcessingJob,
  Notification, TeamMember, BrandingSettings, AuditLog,
  GuestProfile,
} from '@/types';

const PAGE_SIZE = 12;

// Helper function to handle errors gracefully
async function handleSupabaseError(promise: Promise<any>, errorMessage: string) {
  try {
    const result = await promise;
    if (result.error) {
      console.error(errorMessage, result.error);
      throw new Error(result.error.message);
    }
    return result;
  } catch (error: any) {
    console.error(errorMessage, error);
    throw error;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: async (payload: { name: string; email: string; password: string; studioName?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          name: payload.name,
          role: 'ADMIN',
          studio_name: payload.studioName ?? null,
        },
      },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  forgotPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },

  resetPassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  updateProfile: async (payload: { name?: string; phone?: string; studio_name?: string; avatar_url?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw new Error(error.message);
  },

  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },
};

// ─── Events ──────────────────────────────────────────────────────────────────
export const eventsApi = {
  list: async (params?: { page?: number; limit?: number; search?: string; status?: string; studioId?: string }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? PAGE_SIZE;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (params?.search) query = query.ilike('name', `%${params.search}%`);
    if (params?.status) query = query.eq('status', params.status);

    // Multi-tenant isolation: SuperAdmin sees all; Studio Admin/photographers only see their studio's events
    const currentUser = useAuthStore.getState().user;
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      const { data: studio } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${currentUser.id},name.ilike.${currentUser.studio_name ?? ''}`)
        .maybeSingle();

      if (studio?.id) {
        query = query.or(`user_id.eq.${studio.id},user_id.eq.${currentUser.id}`);
      } else {
        query = query.eq('user_id', currentUser.id);
      }
    } else if (params?.studioId) {
      query = query.eq('user_id', params.studioId);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      data: Array.isArray(data) ? data : [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  },

  get: async (id: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Event | null;
  },

  getBySlug: async (slug: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Event | null;
  },

  create: async (payload: Partial<Event>) => {
    const currentUser = useAuthStore.getState().user;
    const userId = currentUser?.id;
    if (!userId) throw new Error('Not authenticated');

    // Auto-resolve user_id for multi-tenant isolation
    let studioId = payload.user_id;
    if (!studioId) {
      const { data: studio } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${userId},name.ilike.${currentUser.studio_name ?? ''}`)
        .maybeSingle();
      studioId = studio?.id;
    }

    const slug = payload.slug || (payload.name ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    const { data, error } = await supabase
      .from('events')
      .insert({ ...payload, slug, user_id: userId, user_id: studioId ?? null })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Event;
  },

  update: async (id: string, payload: Partial<Event>) => {
    const { data, error } = await supabase
      .from('events')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Event;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  archive: async (id: string) => {
    const { error } = await supabase
      .from('events')
      .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  clone: async (id: string, newName: string) => {
    const { data: original, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !original) throw new Error(fetchErr?.message ?? 'Event not found');
    const { id: _id, created_at: _c, updated_at: _u, slug: _sl, ...rest } = original;
    const slug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    const { data, error } = await supabase
      .from('events')
      .insert({ ...rest, name: newName, slug, status: 'ACTIVE' })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Event;
  },

  stats: async (id: string) => {
    const [photos, guests] = await Promise.all([
      supabase.from('photos').select('id', { count: 'exact', head: true }).eq('event_id', id),
      supabase.from('guest_profiles').select('id', { count: 'exact', head: true }).eq('event_id', id),
    ]);
    return { photoCount: photos.count ?? 0, guestCount: guests.count ?? 0 };
  },

  // Upload a cover/thumbnail image for an event and persist the URL
  uploadCoverImage: async (eventId: string, file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const key = `event-covers/${eventId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('branding')
      .upload(key, file, { upsert: true, contentType: file.type });
    if (upErr) throw new Error(upErr.message);
    const { data } = supabase.storage.from('branding').getPublicUrl(key);
    await supabase.from('events')
      .update({ cover_image_url: data.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', eventId);
    return { cover_image_url: data.publicUrl };
  },

  // Fetch per-photo processing status for a given event (for the status panel)
  photoStatuses: async (eventId: string) => {
    const { data, error } = await supabase
      .from('photos')
      .select('id, original_name, processing_status, created_at, storage_key, thumbnail_key, file_size')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      original_name: string;
      processing_status: string;
      created_at: string;
      storage_key: string;
      thumbnail_key: string | null;
      file_size: number;
    }>;
  },
};

// ─── Photo Groups ─────────────────────────────────────────────────────────────
export const groupsApi = {
  list: async (eventId: string) => {
    const { data, error } = await supabase
      .from('photo_groups')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? (data as Group[]) : [];
  },

  get: async (groupId: string) => {
    const { data, error } = await supabase
      .from('photo_groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Group | null;
  },

  create: async (eventId: string, payload: Partial<Group>) => {
    const { data, error } = await supabase
      .from('photo_groups')
      .insert({ ...payload, event_id: eventId })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Group;
  },

  update: async (groupId: string, payload: Partial<Group>) => {
    const { data, error } = await supabase
      .from('photo_groups')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', groupId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Group;
  },

  delete: async (groupId: string) => {
    const { error } = await supabase.from('photo_groups').delete().eq('id', groupId);
    if (error) throw new Error(error.message);
  },
};

// ─── Photos ──────────────────────────────────────────────────────────────────
export const photosApi = {
  list: async (params?: { eventId?: string; groupId?: string; page?: number; limit?: number }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? PAGE_SIZE;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('photos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (params?.eventId) query = query.eq('event_id', params.eventId);
    if (params?.groupId) query = query.eq('group_id', params.groupId);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      data: Array.isArray(data) ? (data as Photo[]) : [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  },

  getStudioMediaStats: async (adminId?: string, studioName?: string) => {
    const currentUser = useAuthStore.getState().user;
    const targetAdminId = adminId || (currentUser?.role === 'ADMIN' ? currentUser.id : undefined);
    const targetStudioName = studioName || currentUser?.studio_name || undefined;

    try {
      const { data, error } = await supabase.rpc('get_profile_stats', {
        p_id: targetAdminId ?? null,
        p_studio_name: targetStudioName ?? null,
      });

      if (!error && data) {
        return data as {
          user_id?: string;
          quota_limit: number;
          active_media_count: number;
          remaining_capacity: number;
          percentage_used: number;
          is_exceeded: boolean;
        };
      }
    } catch {
      // fallback
    }

    return {
      quota_limit: 25000,
      active_media_count: 0,
      remaining_capacity: 25000,
      percentage_used: 0,
      is_exceeded: false,
    };
  },

  upload: async (
    file: File,
    eventId: string,
    groupId: string | undefined,
    onProgress?: (pct: number) => void
  ) => {
    const currentUser = useAuthStore.getState().user;
    const userId = currentUser?.id;
    if (!userId) throw new Error('Not authenticated');

    // ── Enforce combined photo & video storage quota ──
    const stats = await photosApi.getStudioMediaStats();
    if (stats.is_exceeded || (stats.active_media_count >= stats.quota_limit)) {
      throw new Error(
        `Media storage quota limit exceeded! You have reached your limit of ${stats.quota_limit.toLocaleString()} photos & videos. Please delete old media to free capacity or contact Super Admin to increase your quota.`
      );
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const key = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    onProgress?.(10);
    const { error: upErr } = await supabase.storage
      .from('event-photos')
      .upload(key, file, { contentType: file.type });
    if (upErr) throw new Error(upErr.message);
    onProgress?.(70);

    const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(key);

    const { data, error } = await supabase
      .from('photos')
      .insert({
        event_id: eventId,
        group_id: groupId ?? null,
        uploaded_by: userId,
        storage_key: key,
        original_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        processing_status: 'PENDING',
      })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    onProgress?.(100);
    return { photo: data as Photo, url: urlData.publicUrl };
  },

  delete: async (id: string) => {
    const { data: photo } = await supabase.from('photos').select('storage_key').eq('id', id).maybeSingle();
    if (photo?.storage_key) {
      await supabase.storage.from('event-photos').remove([photo.storage_key]);
    }
    const { error } = await supabase.from('photos').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getPublicUrl: (storageKey: string) => {
    const { data } = supabase.storage.from('event-photos').getPublicUrl(storageKey, {
      transform: { width: 400, height: 400, resize: 'cover', quality: 75 },
    });
    return data.publicUrl;
  },
};

// ─── Analytics ───────────────────────────────────────────────────────────────
// ─── QR Codes ─────────────────────────────────────────────────────────────────
export const qrApi = {
  list: async (eventId: string) => {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : ([] as any[]);
  },

  generate: async (eventId: string, groupId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('qr_codes')
      .insert({ event_id: eventId, group_id: groupId ?? null, created_by: user.id })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('qr_codes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    return data as User | null;
  },

  updateProfile: async (payload: { name?: string; phone?: string; studio_name?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as User;
  },

  updatePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    // Re-authenticate then update
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error('Not authenticated');
    // Verify current password by re-signing in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: payload.currentPassword,
    });
    if (signInErr) throw new Error('Current password is incorrect');
    const { error } = await supabase.auth.updateUser({ password: payload.newPassword });
    if (error) throw new Error(error.message);
  },

  uploadAvatar: async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const key = `avatars/${user.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('branding').upload(key, file, { upsert: true, contentType: file.type });
    if (upErr) throw new Error(upErr.message);
    const { data } = supabase.storage.from('branding').getPublicUrl(key);
    // Store avatar_url in profile
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
    return { avatar_url: data.publicUrl };
  },
};

export const analyticsApi = {
  photographer: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    const [events, photos, guests] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('photos').select('id', { count: 'exact', head: true })
        .in('event_id', (await supabase.from('events').select('id').eq('user_id', user.id)).data?.map(e => e.id) ?? []),
      supabase.from('guest_profiles').select('id', { count: 'exact', head: true })
        .in('event_id', (await supabase.from('events').select('id').eq('user_id', user.id)).data?.map(e => e.id) ?? []),
    ]);
    return {
      totalEvents: events.count ?? 0,
      totalPhotos: photos.count ?? 0,
      totalSearches: guests.count ?? 0,
      totalFaces: 0,
      totalDownloads: 0,
    };
  },

  event: async (eventId: string) => {
    const [photos, guests] = await Promise.all([
      supabase.from('photos').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('guest_profiles').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ]);
    return { photoCount: photos.count ?? 0, guestCount: guests.count ?? 0 };
  },
};

// ─── Branding ────────────────────────────────────────────────────────────────
export const brandingApi = {
  get: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    return data as BrandingSettings | null;
  },

  update: async (payload: Partial<BrandingSettings>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('branding_settings')
      .upsert({ ...payload, user_id: user.id, updated_at: new Date().toISOString() })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as BrandingSettings;
  },

  upsert: async (payload: Partial<BrandingSettings>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('branding_settings')
      .upsert({ ...payload, user_id: user.id, updated_at: new Date().toISOString() })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as BrandingSettings;
  },

  uploadLogo: async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() ?? 'png';
    const key = `logos/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('branding').upload(key, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('branding').getPublicUrl(key);
    return data.publicUrl;
  },
};

// ─── Team ────────────────────────────────────────────────────────────────────
export const teamApi = {
  list: async (eventId: string) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, user:user_id(id, name, email, avatar_url, role)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? (data as TeamMember[]) : [];
  },

  invite: async (eventId: string, userId: string, role: string) => {
    const { error } = await supabase
      .from('team_members')
      .insert({ event_id: eventId, user_id: userId, role, status: 'INVITED' });
    if (error) throw new Error(error.message);
  },

  remove: async (eventId: string, userId: string) => {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  },

  // Studio-level team member management for Studio Admins
  listStudioMembers: async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser?.studio_name) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('studio_name', currentUser.studio_name)
      .neq('id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as User[];
  },

  createStudioMember: async (name: string, email: string, role: string, password?: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('create_studio_team_member', {
      p_id: currentUser.id,
      p_name: name,
      p_email: email,
      p_role: role,
      p_password: password || 'CamSort@Team2026!',
    });
    if (error) throw new Error(error.message);
    return data;
  },

  removeStudioMember: async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (error) throw new Error(error.message);
  },
};

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationsApi = {
  list: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? (data as Notification[]) : [];
  },

  markRead: async (ids?: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (ids?.length) query = query.in('id', ids);
    const { error } = await query;
    if (error) throw new Error(error.message);
  },
};

// ─── Super-Admin ─────────────────────────────────────────────────────────────
export const adminApi = {
  users: async (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? PAGE_SIZE;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (params?.search) query = query.or(`name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
    if (params?.role) query = query.eq('role', params.role);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      data: Array.isArray(data) ? (data as User[]) : [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  },

  updateUser: async (id: string, payload: Partial<User>) => {
    const { error } = await supabase.from('profiles').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  },

  suspendUser: async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  allEvents: async (params?: { page?: number; limit?: number; search?: string }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? PAGE_SIZE;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('events')
      .select('*, photographer:user_id(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (params?.search) query = query.ilike('name', `%${params.search}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      data: Array.isArray(data) ? data : [],
      total: count ?? 0,
      page, limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  },

  jobs: async (params?: { page?: number; status?: string; type?: string }) => {
    const page = params?.page ?? 1;
    const limit = PAGE_SIZE;
    const from = (page - 1) * limit;

    let query = supabase
      .from('processing_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (params?.status) query = query.eq('status', params.status);
    if (params?.type) query = query.eq('type', params.type);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      data: Array.isArray(data) ? (data as ProcessingJob[]) : [],
      total: count ?? 0, page, limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  },

  auditLogs: async (params?: { page?: number; limit?: number; userId?: string; action?: string }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? PAGE_SIZE;
    const from = (page - 1) * limit;

    let query = supabase
      .from('audit_logs')
      .select('*, user:user_id(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (params?.userId) query = query.eq('user_id', params.userId);
    if (params?.action) query = query.ilike('action', `%${params.action}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      data: Array.isArray(data) ? (data as AuditLog[]) : [],
      total: count ?? 0, page, limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  },

  deleteUser: async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  retryJob: async (id: string) => {
    const { error } = await supabase
      .from('processing_jobs')
      .update({ status: 'PENDING', started_at: null, completed_at: null, error: null })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  systemSettings: async () => {
    // Platform settings stored in a special profile or key-value store
    // For now return sensible defaults from env/config
    return {
      appName: 'CamSort',
      maintenanceMode: false,
      defaultMatchThreshold: 0.45,
      maxUploadSizeMb: 50,
      rateLimit: 10,
      allowRegistration: true,
    };
  },

  updateSystemSettings: async (_payload: Record<string, unknown>) => {
    // System settings would be stored in a dedicated table or Supabase secrets
    // For this phase just return success
    return true;
  },

  health: async () => {
    // Check basic connectivity
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    return {
      api: 'ok',
      database: error ? 'down' : 'ok',
      redis: 'unknown',
      storage: 'ok',
      aiService: 'unknown',
      queue: 'unknown',
    };
  },

  systemStats: async () => {
    const [users, events, photos, jobs] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('photos').select('id', { count: 'exact', head: true }),
      supabase.from('processing_jobs').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ]);
    return {
      totalUsers: users.count ?? 0,
      totalEvents: events.count ?? 0,
      totalPhotos: photos.count ?? 0,
      pendingJobs: jobs.count ?? 0,
    };
  },

  createAdminUser: async (payload: {
    email: string;
    name: string;
    studio_name: string;
    quota_limit?: number;
    password?: string;
    notes?: string;
    role?: string;
  }) => {
    // Simple approach: Insert directly into profiles (user must be created in auth.users first)
    // Use Supabase auth API to create user, then add profile
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password || 'CamSort@Admin2026!',
      options: {
        data: {
          name: payload.name,
          role: payload.role || 'ADMIN',
          studio_name: payload.studio_name,
        },
      },
    });

    if (authError) {
      throw new Error(authError.message || 'Failed to create user');
    }

    if (authData.user) {
      // Profile will be auto-created by trigger, but let's ensure it has the right role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: payload.role || 'ADMIN',
          studio_name: payload.studio_name,
          is_active: true,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.warn('Profile update warning:', profileError);
      }

      return {
        email: payload.email,
        password: payload.password || 'CamSort@Admin2026!',
        name: payload.name,
        studio_name: payload.studio_name,
        quota_limit: payload.quota_limit || 25000,
      };
    }

    throw new Error('Failed to create studio admin account');
  },
};

// ─── Downloads ───────────────────────────────────────────────────────────────
export const downloadsApi = {
  single: async (photoId: string) => {
    const { data, error } = await supabase
      .from('photos')
      .select('storage_path, original_name')
      .eq('id', photoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Photo not found');
    const { data: urlData } = supabase.storage
      .from('event-photos')
      .getPublicUrl(data.storage_path ?? '');
    return { url: urlData?.publicUrl ?? '' };
  },

  requestZip: async (photoIds: string[], _eventId: string, _sessionToken?: string) => {
    // Placeholder: In production, this calls an Edge Function to generate a ZIP
    // For now returns a mock job ID — replace with real edge function call
    const jobId = `zip-${Date.now()}`;
    return { jobId };
  },

  zipStatus: async (jobId: string) => {
    // Placeholder: poll processing_jobs table for ZIP status
    const { data } = await supabase
      .from('processing_jobs')
      .select('status, output_data')
      .eq('id', jobId)
      .maybeSingle();
    if (data?.status === 'COMPLETED') {
      return { status: 'COMPLETED', url: (data.output_data as any)?.url ?? '' };
    }
    return { status: data?.status ?? 'PENDING', url: '' };
  },
};

// ─── Favorites ────────────────────────────────────────────────────────────────
export const favoritesApi = {
  toggle: async (photoId: string) => {
    // Favorites are tracked client-side via session in this phase
    return { photoId, toggled: true };
  },
};

// ─── Face / Search ────────────────────────────────────────────────────────────
export const faceApi = {
  /**
   * Upload selfie → update guest_profile.selfie_url → invoke face-search edge
   * function synchronously so the gallery can show results immediately.
   * Correct column: guest_profiles.selfie_url (not selfie_path)
   */
  searchBySelfie: async (
    file: File,
    eventId: string,
    sessionToken: string,
    onProgress?: (pct: number) => void
  ) => {
    onProgress?.(10);
    // 1. Upload selfie to Storage
    const ext = file.name.split('.').pop() ?? 'jpg';
    const key = `${sessionToken}-${Date.now()}.${ext}`;
    const { data: uploadData, error: upErr } = await supabase.storage
      .from('selfies')
      .upload(key, file, { contentType: file.type, upsert: true });
    if (upErr) throw new Error(upErr.message);
    onProgress?.(30);

    // Build the public/signed URL for the edge function
    const { data: urlData } = supabase.storage.from('selfies').getPublicUrl(key);
    const selfieUrl = urlData?.publicUrl ?? key;

    // 2. Upsert guest_profile with selfie_url (correct column name)
    const { data: existing } = await supabase
      .from('guest_profiles')
      .select('id')
      .eq('event_id', eventId)
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (existing) {
      await supabase.from('guest_profiles')
        .update({ selfie_url: selfieUrl })
        .eq('id', existing.id);
    } else {
      await supabase.from('guest_profiles')
        .insert({ event_id: eventId, session_token: sessionToken, selfie_url: selfieUrl });
    }
    onProgress?.(50);

    // 3. Invoke face-search edge function directly (synchronous match)
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('face-search', {
      body: { event_id: eventId, session_token: sessionToken, selfie_url: selfieUrl },
    });
    if (fnErr) throw new Error(fnErr.message);
    onProgress?.(100);
    return { queued: false, matched: (fnData as any)?.matched ?? 0 };
  },

  /**
   * Fetch face-matched photos for a guest session.
   * face_embeddings uses quality (not confidence) — expose as quality on result.
   */
  guestPhotos: async (eventId: string, sessionToken: string) => {
    const { data: guest } = await supabase
      .from('guest_profiles')
      .select('id')
      .eq('event_id', eventId)
      .eq('session_token', sessionToken)
      .maybeSingle();
    if (!guest) return [];

    const { data: faces } = await supabase
      .from('face_embeddings')
      .select('photo_id, quality')
      .eq('guest_profile_id', guest.id);

    const photoIds = (faces ?? []).map((f: { photo_id: string }) => f.photo_id);
    if (!photoIds.length) {
      // Strict face recognition: If no faces matched the guest's selfie, return empty array.
      // Never leak unrelated event photos of other attendees.
      return [];
    }

    // photos uses storage_key (not storage_path / public_url)
    const { data: photos } = await supabase
      .from('photos')
      .select('id, event_id, storage_key, thumbnail_key, original_name, mime_type, file_size, created_at')
      .in('id', photoIds)
      .order('created_at', { ascending: false });

    const qualityMap = Object.fromEntries(
      (faces ?? []).map((f: { photo_id: string; quality: number }) => [f.photo_id, f.quality])
    );

    // Build public URLs — event-photos bucket is public, no signed URL needed
    const photosWithUrls = (photos ?? []).map((p: any) => {
      const { data: s } = supabase.storage
        .from('event-photos')
        .getPublicUrl(p.thumbnail_key ?? p.storage_key);
      return { ...p, display_url: s?.publicUrl ?? '', quality: qualityMap[p.id] ?? null };
    });
    return photosWithUrls;
  },
};

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  /**
   * Compress then upload a single photo to Supabase Storage.
   * Compression is done browser-side via canvas (target ≤ 200 KB, quality binary-search).
   * The original filename + original size are stored in the DB for reference.
   * `onProgress` receives 0–100; the range is split: 0–20 = compressing, 20–100 = uploading.
   */
  photo: async (
    rawFile: File,
    eventId: string,
    groupId?: string,
    onProgress?: (pct: number) => void,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // ── Step 1: Compress browser-side ────────────────────────────────────
    onProgress?.(5);
    let uploadFile = rawFile;
    let storedMime = rawFile.type;
    let storedSize = rawFile.size;

    try {
      // Dynamic import so the canvas logic is only loaded when uploading
      const { compressImage } = await import('@/lib/imageCompression');
      const result = await compressImage(rawFile);
      uploadFile = result.file;
      storedMime = result.file.type;
      storedSize = result.compressedSize;
      onProgress?.(20);
    } catch {
      // Compression failed — fall back to raw file
      onProgress?.(20);
    }

    // ── Step 2: Upload to Storage ─────────────────────────────────────────
    // Always store as .jpg if compression ran (output is JPEG); keep original ext otherwise
    const ext = uploadFile.type === 'image/jpeg' ? 'jpg' : (rawFile.name.split('.').pop() ?? 'jpg');
    const baseName = rawFile.name.replace(/\.[^.]+$/, '');
    const key = `${user.id}/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${baseName.slice(0, 40)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('event-photos')
      .upload(key, uploadFile, { contentType: storedMime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    onProgress?.(80);

    // Signed URL (1-year) for immediate display
    // Get public URL (bucket is public — no signed URL needed)
    const { data: urlData } = supabase.storage
      .from('event-photos')
      .getPublicUrl(key);

    // ── Step 3: Insert DB record and immediately mark COMPLETED ──────────
    const sanitizedGroupId = (groupId && groupId !== 'none' && groupId.trim() !== '') ? groupId : null;
    const { error: dbErr } = await supabase.from('photos').insert({
      event_id:          eventId,
      group_id:          sanitizedGroupId,
      uploaded_by:       user.id,
      storage_key:       key,
      original_name:     rawFile.name,
      file_size:         storedSize,
      mime_type:         storedMime,
      processing_status: 'COMPLETED',   // mark done immediately — face indexing is async
    });
    if (dbErr) throw new Error(dbErr.message);
    onProgress?.(100);

    return { key, signedUrl: urlData?.publicUrl ?? '' };
  },
};

// ─── Guest ────────────────────────────────────────────────────────────────────
export const guestApi = {
  getEventBySlug: async (slug: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*, photographer:user_id(id, name, email, avatar_url, studio_name)')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Event not found');
    return data as Event & { photographer?: Partial<User> };
  },

  // Public token — selfie face-search access only
  getEventByPublicToken: async (token: string) => {
    const { data, error } = await supabase
      .rpc('get_event_by_public_token', { p_token: token });
    if (error) throw new Error(error.message);
    const ev = Array.isArray(data) ? data[0] : data;
    if (!ev) throw new Error('Event not found or link has expired');
    // Fetch photographer separately
    const { data: ph } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, studio_name')
      .eq('id', ev.user_id)
      .maybeSingle();
    return { ...ev, photographer: ph } as Event & { photographer?: Partial<User> };
  },

  // Private token — full gallery access without face-search requirement
  getEventByPrivateToken: async (token: string) => {
    const { data, error } = await supabase
      .rpc('get_event_by_private_token', { p_token: token });
    if (error) throw new Error(error.message);
    const ev = Array.isArray(data) ? data[0] : data;
    if (!ev) throw new Error('Event not found or link has expired');
    const { data: ph } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, studio_name')
      .eq('id', ev.user_id)
      .maybeSingle();
    return { ...ev, photographer: ph } as Event & { photographer?: Partial<User> };
  },

  createSession: async (eventId: string) => {
    const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { error } = await supabase
      .from('guest_profiles')
      .insert({ event_id: eventId, session_token: sessionToken });
    if (error) throw new Error(error.message);
    return { sessionToken };
  },

  // All photos for an event (private link — no face filter)
  // Builds signed display URLs from storage_key
  allPhotos: async (eventId: string, params?: { page?: number; limit?: number }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 24;
    const from = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('photos')
      .select('id, event_id, storage_key, thumbnail_key, original_name, mime_type, file_size, processing_status, created_at', { count: 'exact' })
      .eq('event_id', eventId)
      // Show ALL photos regardless of processing status so count matches reality
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw new Error(error.message);

    // Build public URLs (bucket is public — no signed URL needed)
    const photosWithUrls = await Promise.all(
      (data ?? []).map(async (p: any) => {
        const { data: s } = supabase.storage
          .from('event-photos')
          .getPublicUrl(p.thumbnail_key ?? p.storage_key);
        return { ...p, display_url: s?.publicUrl ?? '' };
      })
    );

    return {
      data: photosWithUrls,
      total: count ?? 0,
      page, limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  },
};

// ─── Contact ─────────────────────────────────────────────────────────────────
export const contactApi = {
  submit: async (payload: { name: string; email: string; subject: string; message: string }) => {
    const { error } = await supabase.from('contact_submissions').insert(payload);
    if (error) throw new Error(error.message);
  },
};

// ─── Admin Permissions ────────────────────────────────────────────────────────
export interface AdminPermissions {
  id: string;
  id: string;
  can_upload: boolean;
  can_analytics: boolean;
  can_branding: boolean;
  can_team: boolean;
  can_qr: boolean;
  can_settings: boolean;
  max_events: number;
  max_photos: number;
  max_storage_gb: number;
  notes: string | null;
  updated_at: string;
}

export const permissionsApi = {
  get: async (adminId: string): Promise<AdminPermissions | null> => {
    const { data, error } = await supabase
      .from('admin_permissions')
      .select('*')
      .eq('id', adminId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as AdminPermissions | null;
  },

  upsert: async (
    adminId: string,
    perms: Omit<AdminPermissions, 'id' | 'id' | 'updated_at'>
  ): Promise<void> => {
    const { error } = await supabase.rpc('upsert_admin_permissions', {
      p_id:       adminId,
      p_can_upload:     perms.can_upload,
      p_can_analytics:  perms.can_analytics,
      p_can_branding:   perms.can_branding,
      p_can_team:       perms.can_team,
      p_can_qr:         perms.can_qr,
      p_can_settings:   perms.can_settings,
      p_max_events:     perms.max_events,
      p_max_photos:     perms.max_photos,
      p_max_storage_gb: perms.max_storage_gb,
      p_notes:          perms.notes ?? null,
    });
    if (error) throw new Error(error.message);
  },
};

// ─── ZIP Download ─────────────────────────────────────────────────────────────
export const zipApi = {
  /**
   * Request a ZIP of matched photos (public/face-search flow).
   * Returns a signed URL valid for 1 hour.
   */
  generateForSession: async (eventId: string, sessionToken: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('generate-zip', {
      body: { event_id: eventId, session_token: sessionToken },
    });
    if (error) throw new Error(error.message);
    const url = (data as any)?.url;
    if (!url) throw new Error('No download URL returned');
    return url;
  },

  /**
   * Request a ZIP of ALL event photos (private/VIP flow).
   * Returns a signed URL valid for 1 hour.
   */
  generateAll: async (eventId: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('generate-zip', {
      body: { event_id: eventId },
    });
    if (error) throw new Error(error.message);
    const url = (data as any)?.url;
    if (!url) throw new Error('No download URL returned');
    return url;
  },

  /**
   * Request a ZIP for a specific subset of photo IDs (e.g. guest selection).
   */
  generateForPhotos: async (eventId: string, photoIds: string[]): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('generate-zip', {
      body: { event_id: eventId, photo_ids: photoIds },
    });
    if (error) throw new Error(error.message);
    const url = (data as any)?.url;
    if (!url) throw new Error('No download URL returned');
    return url;
  },
};

// ─── Google Drive Export ──────────────────────────────────────────────────────
export const googleDriveApi = {
  exportPhotos: async (payload: {
    eventId: string;
    folderName: string;
    photos: Array<{ name: string; url: string }>;
  }) => {
    const { data, error } = await supabase.functions.invoke('export-to-google-drive', {
      body: {
        event_id: payload.eventId,
        folder_name: payload.folderName,
        photos: payload.photos,
      },
    });
    if (error) {
      let msg = error.message;
      try {
        const bodyText = await (error as any)?.context?.text?.();
        if (bodyText) {
          const parsed = JSON.parse(bodyText);
          msg = parsed?.error?.message || parsed?.error || msg;
        }
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return data as { success: boolean; folderId: string; folderName: string; uploadedCount: number };
  },
};
