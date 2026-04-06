import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'admin' | 'staff'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: UserRole
}

interface LoginResult {
  ok: boolean
  error?: string
}

interface AuthStore {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => void
  clearError: () => void
}

const LOCAL_DEMO_USERS: Array<AuthUser & { password: string }> = [
  {
    id: 'local-admin-1',
    username: 'admin',
    name: 'Admin User',
    role: 'admin',
    password: 'admin1234',
  },
  {
    id: 'local-staff-1',
    username: 'staff',
    name: 'Staff User',
    role: 'staff',
    password: 'staff1234',
  },
]

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        const normalizedUsername = username.trim().toLowerCase()
        if (!normalizedUsername || !password) {
          const error = 'Username and password are required.'
          set({ error })
          return { ok: false, error }
        }

        set({ isLoading: true, error: null })

        const apiBaseUrl = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').trim().replace(/\/$/, '')

        if (apiBaseUrl) {
          try {
            const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ username: normalizedUsername, password }),
            })

            const payload = (await response.json()) as {
              message?: string
              data?: {
                token?: string
                user?: {
                  id?: number | string
                  name?: string
                  username?: string
                  role?: UserRole
                }
              }
            }

            if (response.ok && payload.data?.user?.username && payload.data?.user?.role) {
              const user: AuthUser = {
                id: String(payload.data.user.id ?? normalizedUsername),
                username: payload.data.user.username,
                name: payload.data.user.name || payload.data.user.username,
                role: payload.data.user.role,
              }

              set({
                user,
                token: payload.data.token || null,
                isLoading: false,
                error: null,
              })

              return { ok: true }
            }

            const error = payload.message || 'Invalid credentials.'
            set({ isLoading: false, error })
            return { ok: false, error }
          } catch {
            // Fall through to local demo auth if backend auth endpoint is unavailable.
          }
        }

        const matched = LOCAL_DEMO_USERS.find(
          (candidate) =>
            candidate.username.toLowerCase() === normalizedUsername && candidate.password === password
        )

        if (!matched) {
          const error = 'Invalid credentials.'
          set({ isLoading: false, error })
          return { ok: false, error }
        }

        const { password: _password, ...user } = matched
        set({ user, token: null, isLoading: false, error: null })
        return { ok: true }
      },

      logout: () => {
        set({ user: null, token: null, error: null, isLoading: false })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-store',
      version: 1,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
)
