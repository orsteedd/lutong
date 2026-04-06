import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchAuthenticatedUser, loginWithCredentials, logoutSession, type AuthUser } from '@/lib/authApi'

interface AuthStore {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isInitializing: boolean
  isLoggingIn: boolean
  error: string | null
  initializeAuth: () => Promise<void>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitializing: true,
      isLoggingIn: false,
      error: null,

      initializeAuth: async () => {
        const token = get().token
        if (!token) {
          set({ isAuthenticated: false, user: null, isInitializing: false, error: null })
          return
        }

        set({ isInitializing: true, error: null })
        try {
          const user = await fetchAuthenticatedUser(token)
          set({ user, isAuthenticated: true, isInitializing: false, error: null })
        } catch (error) {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : 'Session expired',
          })
        }
      },

      login: async (username, password) => {
        set({ isLoggingIn: true, error: null })
        try {
          const result = await loginWithCredentials(username, password)
          set({
            token: result.token,
            user: result.user,
            isAuthenticated: true,
            isLoggingIn: false,
            isInitializing: false,
            error: null,
          })
          return true
        } catch (error) {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoggingIn: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : 'Login failed',
          })
          return false
        }
      },

      logout: async () => {
        const token = get().token
        if (token) {
          try {
            await logoutSession(token)
          } catch {
            // Logout should always clear local session, even when backend is unavailable.
          }
        }

        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isInitializing: false,
          isLoggingIn: false,
          error: null,
        })
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      merge: (persistedState, currentState) => {
        const incoming = (persistedState as Partial<AuthStore> | undefined) ?? {}
        return {
          ...currentState,
          token: typeof incoming.token === 'string' ? incoming.token : null,
          user: incoming.user ?? null,
          isAuthenticated: Boolean(incoming.token && incoming.user),
          isInitializing: true,
          isLoggingIn: false,
          error: null,
        }
      },
    }
  )
)
