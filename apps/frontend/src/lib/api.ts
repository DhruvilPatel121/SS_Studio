import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    })

    // Request interceptor — attach JWT from localStorage
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('medo_token')
        if (token) config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Response interceptor — auto-refresh on 401
    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true
          try {
            const refreshToken = localStorage.getItem('medo_refresh_token')
            if (refreshToken) {
              const { data } = await this.client.post('/auth/refresh', { refreshToken })
              localStorage.setItem('medo_token', data.data.token)
              localStorage.setItem('medo_refresh_token', data.data.refreshToken)
              original.headers.Authorization = `Bearer ${data.data.token}`
              return this.client(original)
            }
          } catch {
            localStorage.removeItem('medo_token')
            localStorage.removeItem('medo_refresh_token')
            if (typeof window !== 'undefined') window.location.href = '/login'
          }
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password })
    if (data.data?.token) {
      localStorage.setItem('medo_token', data.data.token)
      localStorage.setItem('medo_refresh_token', data.data.refreshToken)
    }
    return data.data
  }

  async register(email: string, password: string, name: string) {
    const { data } = await this.client.post('/auth/register', { email, password, name })
    return data.data
  }

  async logout(refreshToken?: string) {
    await this.client.post('/auth/logout', { refreshToken })
    localStorage.removeItem('medo_token')
    localStorage.removeItem('medo_refresh_token')
  }

  async getMe() {
    const { data } = await this.client.get('/auth/me')
    return data.data
  }

  async forgotPassword(email: string) {
    const { data } = await this.client.post('/auth/forgot-password', { email })
    return data
  }

  async resetPassword(token: string, password: string) {
    const { data } = await this.client.post('/auth/reset-password', { token, password })
    return data
  }

  // Events
  async getEvents(params?: Record<string, unknown>) {
    const { data } = await this.client.get('/events', { params })
    return data
  }

  async getEvent(id: string) {
    const { data } = await this.client.get(`/events/${id}`)
    return data.data
  }

  async createEvent(payload: Record<string, unknown>) {
    const { data } = await this.client.post('/events', payload)
    return data.data
  }

  async updateEvent(id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.patch(`/events/${id}`, payload)
    return data.data
  }

  async deleteEvent(id: string) {
    await this.client.delete(`/events/${id}`)
  }

  async archiveEvent(id: string) {
    await this.client.post(`/events/${id}/archive`)
  }

  async getEventStats(id: string) {
    const { data } = await this.client.get(`/events/${id}/stats`)
    return data.data
  }

  // Groups
  async getGroups(eventId: string) {
    const { data } = await this.client.get(`/events/${eventId}/groups`)
    return data.data
  }

  async createGroup(eventId: string, payload: Record<string, unknown>) {
    const { data } = await this.client.post(`/events/${eventId}/groups`, payload)
    return data.data
  }

  async updateGroup(eventId: string, groupId: string, payload: Record<string, unknown>) {
    const { data } = await this.client.patch(`/events/${eventId}/groups/${groupId}`, payload)
    return data.data
  }

  async deleteGroup(eventId: string, groupId: string) {
    await this.client.delete(`/events/${eventId}/groups/${groupId}`)
  }

  // Photos
  async getPhotos(params: Record<string, unknown>) {
    const { data } = await this.client.get('/photos', { params })
    return data
  }

  async getPhoto(photoId: string) {
    const { data } = await this.client.get(`/photos/${photoId}`)
    return data.data
  }

  async getSignedUrl(photoId: string, type: 'original' | 'thumbnail' | 'preview' = 'preview') {
    const { data } = await this.client.get(`/photos/${photoId}/signed-url`, { params: { type } })
    return data.data.url
  }

  async deletePhoto(photoId: string) {
    await this.client.delete(`/photos/${photoId}`)
  }

  async bulkDeletePhotos(photoIds: string[]) {
    await this.client.post('/photos/bulk-delete', { photoIds })
  }

  async reprocessPhoto(photoId: string) {
    await this.client.post(`/photos/${photoId}/reprocess`)
  }

  // Upload
  async uploadPhoto(
    file: File,
    eventId: string,
    groupId: string | null,
    onProgress?: (pct: number) => void
  ) {
    const form = new FormData()
    form.append('file', file)
    form.append('eventId', eventId)
    if (groupId) form.append('groupId', groupId)

    const { data } = await this.client.post('/upload/photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
    return data
  }

  // Face search
  async searchBySelfie(
    selfieFile: File,
    eventId: string,
    groupId?: string,
    guestSessionToken?: string
  ) {
    const form = new FormData()
    form.append('file', selfieFile)
    form.append('eventId', eventId)
    if (groupId) form.append('groupId', groupId)
    if (guestSessionToken) form.append('guestSessionToken', guestSessionToken)

    const { data } = await this.client.post('/faces/search-by-selfie', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  }

  async getGuestPhotos(token: string, eventId: string, page = 1, limit = 20) {
    const { data } = await this.client.get('/faces/guest-photos', {
      params: { token, eventId, page, limit },
    })
    return data
  }

  // QR codes
  async generateQR(eventId: string, groupId?: string) {
    const { data } = await this.client.post('/qr/generate', { eventId, groupId })
    return data.data
  }

  async getQRCodes(eventId: string) {
    const { data } = await this.client.get(`/qr/${eventId}`)
    return data.data
  }

  // Downloads
  async downloadSingle(photoId: string, guestSessionToken?: string, type: 'original' | 'compressed' = 'original') {
    const { data } = await this.client.post(`/downloads/single/${photoId}`, { guestSessionToken, type })
    return data.data
  }

  async requestZip(photoIds: string[], eventId: string, guestSessionToken?: string) {
    const { data } = await this.client.post('/downloads/zip', { photoIds, eventId, guestSessionToken })
    return data.data
  }

  async getZipStatus(jobId: string) {
    const { data } = await this.client.get(`/downloads/zip/status/${jobId}`)
    return data.data
  }

  // Favorites
  async toggleFavorite(photoId: string, guestSessionToken?: string) {
    const { data } = await this.client.post('/favorites/toggle', { photoId, guestSessionToken })
    return data
  }

  // Analytics
  async getEventAnalytics(eventId: string) {
    const { data } = await this.client.get(`/analytics/event/${eventId}`)
    return data.data
  }

  async getPhotographerAnalytics() {
    const { data } = await this.client.get('/analytics/photographer')
    return data.data
  }

  // Guest session
  async createGuestSession(eventId: string, name?: string, email?: string) {
    const { data } = await this.client.post('/guests/session', { eventId, name, email })
    return data.data
  }

  async getPublicEvent(slug: string) {
    const { data } = await this.client.get(`/guests/event/${slug}`)
    return data.data
  }

  async getGuestList(eventId: string, params?: Record<string, unknown>) {
    const { data } = await this.client.get(`/guests/${eventId}/list`, { params })
    return data
  }

  // Branding
  async getBranding() {
    const { data } = await this.client.get('/branding')
    return data.data
  }

  async updateBranding(payload: Record<string, unknown>) {
    const { data } = await this.client.patch('/branding', payload)
    return data.data
  }

  // Settings
  async getMyProfile() {
    const { data } = await this.client.get('/settings/me')
    return data.data
  }

  async updateMyProfile(payload: Record<string, unknown>) {
    const { data } = await this.client.patch('/settings/me', payload)
    return data.data
  }

  async changePassword(currentPassword: string, newPassword: string) {
    await this.client.patch('/settings/change-password', { currentPassword, newPassword })
  }

  // Notifications
  async getNotifications() {
    const { data } = await this.client.get('/notifications')
    return data.data
  }

  async markNotificationsRead(ids?: string[]) {
    await this.client.post('/notifications/mark-read', { ids })
  }

  // Teams
  async getTeamMembers(eventId: string) {
    const { data } = await this.client.get(`/teams/${eventId}`)
    return data.data
  }

  async inviteTeamMember(eventId: string, email: string, role: string) {
    const { data } = await this.client.post(`/teams/${eventId}/invite`, { email, role })
    return data.data
  }

  async removeTeamMember(eventId: string, userId: string) {
    await this.client.delete(`/teams/${eventId}/members/${userId}`)
  }

  // Super Admin
  async getSuperAdminStats() {
    const { data } = await this.client.get('/super-admin/stats')
    return data.data
  }

  async getAdminUsers(params?: Record<string, unknown>) {
    const { data } = await this.client.get('/super-admin/users', { params })
    return data
  }

  async updateAdminUser(userId: string, payload: Record<string, unknown>) {
    const { data } = await this.client.patch(`/super-admin/users/${userId}`, payload)
    return data.data
  }

  async deleteAdminUser(userId: string) {
    await this.client.delete(`/super-admin/users/${userId}`)
  }

  async getAdminEvents(params?: Record<string, unknown>) {
    const { data } = await this.client.get('/super-admin/events', { params })
    return data
  }

  async getAuditLogs(params?: Record<string, unknown>) {
    const { data } = await this.client.get('/super-admin/audit-logs', { params })
    return data
  }

  async getSystemSettings() {
    const { data } = await this.client.get('/super-admin/settings')
    return data.data
  }

  async updateSystemSettings(payload: Record<string, unknown>) {
    const { data } = await this.client.patch('/super-admin/settings', payload)
    return data.data
  }

  async getSystemHealth() {
    const { data } = await axios.get(`${API_URL}/api/health/detailed`)
    return data
  }

  async getJobsList(params?: Record<string, unknown>) {
    const { data } = await this.client.get('/super-admin/jobs', { params })
    return data
  }

  async retryJob(jobId: string) {
    await this.client.post(`/super-admin/jobs/${jobId}/retry`)
  }
}

export const api = new ApiClient()