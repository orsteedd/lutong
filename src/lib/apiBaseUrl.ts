const LOCAL_FALLBACK_API_BASE_URL = 'http://127.0.0.1:8000'

export const getApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
  const trimmed = configured.trim()

  if (trimmed.length > 0) {
    return trimmed.replace(/\/$/, '')
  }

  return LOCAL_FALLBACK_API_BASE_URL
}
