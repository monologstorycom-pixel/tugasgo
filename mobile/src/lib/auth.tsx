import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from './types'
import { getAuthToken, setAuthToken, removeAuthToken, request } from './api'
import { setupPushNotifications } from './notifications'
import { stopBackgroundLocationTracking } from './gps'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshProfile = async () => {
    try {
      const data = await request<{ user: User }>('/auth/me')
      setUser(data.user)
    } catch {
      await logout()
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const storedToken = await getAuthToken()
        if (storedToken) {
          setToken(storedToken)
          const data = await request<{ user: User }>('/auth/me')
          setUser(data.user)
          setupPushNotifications().catch(() => {})
        }
      } catch {
        await removeAuthToken()
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const login = async (username: string, password: string): Promise<User> => {
    const data = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    await setAuthToken(data.token)
    setToken(data.token)
    setUser(data.user)
    setupPushNotifications().catch(() => {})
    return data.user
  }

  const logout = async () => {
    try {
      await stopBackgroundLocationTracking()
      await request('/auth/logout', { method: 'POST' }).catch(() => {})
    } finally {
      await removeAuthToken()
      setToken(null)
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
