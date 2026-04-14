'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type AuthContextType = {
  isManager: boolean
  login: (pin: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isManager: false,
  login: () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isManager, setIsManager] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sf_manager')
    if (stored === 'true') setIsManager(true)
  }, [])

  function login(pin: string) {
    if (pin === process.env.NEXT_PUBLIC_MANAGER_PIN) {
      setIsManager(true)
      localStorage.setItem('sf_manager', 'true')
      return true
    }
    return false
  }

  function logout() {
    setIsManager(false)
    localStorage.removeItem('sf_manager')
  }

  return (
    <AuthContext.Provider value={{ isManager, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
