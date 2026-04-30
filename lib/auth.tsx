'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type AuthContextType = {
  isStaff: boolean
  isManager: boolean
  staffLogin: (code: string) => boolean
  login: (pin: string) => boolean
  checkPin: (pin: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isStaff: false,
  isManager: false,
  staffLogin: () => false,
  login: () => false,
  checkPin: () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isStaff, setIsStaff] = useState(false)
  const [isManager, setIsManager] = useState(false)

  useEffect(() => {
    const manager = localStorage.getItem('sf_manager')
    if (manager === 'true') {
      setIsManager(true)
      setIsStaff(true) // managers bypass staff gate automatically
    }
  }, [])

  function staffLogin(code: string) {
    if (code === process.env.NEXT_PUBLIC_STAFF_CODE) {
      setIsStaff(true)
      // Not saved to localStorage — required every session
      return true
    }
    return false
  }

  function checkPin(pin: string): boolean {
    return !!process.env.NEXT_PUBLIC_MANAGER_PIN && pin === process.env.NEXT_PUBLIC_MANAGER_PIN
  }

  function login(pin: string) {
    if (checkPin(pin)) {
      setIsManager(true)
      localStorage.setItem('sf_manager', 'true')
      return true
    }
    return false
  }

  function logout() {
    setIsStaff(false)
    setIsManager(false)
    localStorage.removeItem('sf_staff')
    localStorage.removeItem('sf_manager')
  }

  return (
    <AuthContext.Provider value={{ isStaff, isManager, staffLogin, login, checkPin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
