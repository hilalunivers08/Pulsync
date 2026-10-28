const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'
  return `http://${hostname}:8080`
}

export const API_BASE_URL = getApiBaseUrl()
