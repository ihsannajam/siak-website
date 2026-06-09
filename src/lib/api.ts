import axios from 'axios'
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

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

// Development:
// - Saat npm run dev, kalau VITE_API_URL kosong, request akan pakai proxy Vite: /api
//
// Production:
// - Wajib isi VITE_API_URL di Vercel frontend.
// - Contoh: VITE_API_URL=https://siak-backend.vercel.app/api
const rawApiBaseUrl = import.meta.env.VITE_API_URL || '/api'

// Hilangkan trailing slash supaya tidak jadi double slash saat request
export const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '')

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Client khusus refresh token.
// Dibuat terpisah supaya request refresh tidak ikut interceptor utama.
const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach access token ke setiap request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

function processRefreshQueue(token: string | null) {
  refreshQueue.forEach((callback) => callback(token))
  refreshQueue = []
}

type RefreshResponse = {
  data: {
    accessToken: string
    refreshToken: string
  }
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    const status = error.response?.status

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isUnauthorized = status === 401
    const hasRefreshToken = Boolean(tokenStore.refresh)
    const alreadyRetried = Boolean(originalRequest._retry)

    if (isUnauthorized && hasRefreshToken && !alreadyRetried) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((newAccessToken) => {
            if (!newAccessToken) {
              reject(error)
              return
            }

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await refreshApi.post<RefreshResponse>('/auth/refresh-token', {
          refreshToken: tokenStore.refresh,
        })

        const newAccessToken = response.data.data.accessToken
        const newRefreshToken = response.data.data.refreshToken

        tokenStore.set(newAccessToken, newRefreshToken)

        processRefreshQueue(newAccessToken)

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

        return api(originalRequest)
      } catch (refreshError) {
        processRefreshQueue(null)
        tokenStore.clear()

        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as
      | {
          message?: string
          error?: string
        }
      | undefined

    return (
      responseData?.message ||
      responseData?.error ||
      error.message ||
      'Terjadi kesalahan'
    )
  }

  return 'Terjadi kesalahan'
}