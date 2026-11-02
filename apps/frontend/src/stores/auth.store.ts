import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

export interface User {
  id: string
  email: string
  name: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'PHOTOGRAPHER' | 'STAFF' | 'GUEST'
  avatarUrl?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      setUser: (user) => set({ user }),

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const result = await api.login(email, password)
          set({ user: result.user, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('medo_refresh_token') ?? undefined : undefined
        await api.logout(token)
        set({ user: null })
        if (typeof window !== 'undefined') window.location.href = '/login'
      },

      fetchMe: async () => {
        set({ isLoading: true })
        try {
          const user = await api.getMe()
          set({ user, isLoading: false })
        } catch {
          set({ user: null, isLoading: false })
        }
      },
    }),
    {
      name: 'medo-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)