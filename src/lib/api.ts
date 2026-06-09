import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

const ACCESS_KEY = 'siak_access_token'
const REFRESH_KEY = 'siak_refresh_token'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  setAccess(access: string) {
    localStorage.setItem(ACCESS_KEY, access)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401 (once), then retry the original request
let isRefreshing = false
let queue: ((token: string | null) => void)[] = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status

    if (status === 401 && !original._retry && tokenStore.refresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push((token) => {
            if (!token) return reject(error)
            if (original.headers) original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const { data } = await axios.post('/api/auth/refresh-token', {
          refreshToken: tokenStore.refresh,
        })
        const newAccess = data.data.accessToken as string
        const newRefresh = data.data.refreshToken as string
        tokenStore.set(newAccess, newRefresh)
        queue.forEach((cb) => cb(newAccess))
        queue = []
        if (original.headers) original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch (e) {
        queue.forEach((cb) => cb(null))
        queue = []
        tokenStore.clear()
        window.location.href = '/login'
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

/** Extracts a human-friendly message from an axios error. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? error.message ?? 'Terjadi kesalahan'
  }
  return 'Terjadi kesalahan'
}
