export const getApiBaseUrl = (): string => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
  const normalized = apiBaseUrl.trim().replace(/\/$/, '')

  if (!normalized) {
    throw new Error('VITE_API_BASE_URL is not set. Laravel backend URL is required.')
  }

  return normalized
}
