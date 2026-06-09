import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore } from '../lib/api'
import type { ApiResponse, AuthUser, LoginResponse } from '../lib/types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      if (!tokenStore.access) {
        setLoading(false)
        return
      }
      try {
        const { data } = await api.get<ApiResponse<AuthUser>>('/auth/me')
        setUser(data.data)
      } catch {
        tokenStore.clear()
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  async function login(username: string, password: string) {
    const { data } = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
      username,
      password,
    })
    tokenStore.set(data.data.accessToken, data.data.refreshToken)
    setUser(data.data.user)
  }

  async function logout() {
    try {
      await api.post('/auth/logout', { refreshToken: tokenStore.refresh })
    } catch {
      /* ignore */
    }
    tokenStore.clear()
    setUser(null)
  }

  function hasPermission(permission: string) {
    return user?.permissions.includes(permission) ?? false
  }

  function hasRole(...roles: string[]) {
    return roles.some((r) => user?.roles.includes(r)) ?? false
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
