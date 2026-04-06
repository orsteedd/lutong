import { getApiBaseUrl } from './apiBaseUrl'

export interface AuthUser {
  id: number
  name: string
  username: string
  role: 'admin' | 'staff'
}

interface LoginResponse {
  data?: {
    token?: string
    user?: AuthUser
  }
  message?: string
}

interface MeResponse {
  data?: {
    user?: AuthUser
  }
  message?: string
}

export const loginWithCredentials = async (username: string, password: string) => {
  const endpoint = `${getApiBaseUrl()}/api/v1/auth/login`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  const payload = (await response.json()) as LoginResponse
  if (!response.ok) {
    throw new Error(payload.message || 'Login failed')
  }

  const token = payload.data?.token
  const user = payload.data?.user
  if (!token || !user) {
    throw new Error('Login response is missing token or user payload')
  }

  return { token, user }
}

export const fetchAuthenticatedUser = async (token: string) => {
  const endpoint = `${getApiBaseUrl()}/api/v1/auth/me`

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = (await response.json()) as MeResponse
  if (!response.ok || !payload.data?.user) {
    throw new Error(payload.message || 'Session is invalid')
  }

  return payload.data.user
}

export const logoutSession = async (token: string) => {
  const endpoint = `${getApiBaseUrl()}/api/v1/auth/logout`

  await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
}
