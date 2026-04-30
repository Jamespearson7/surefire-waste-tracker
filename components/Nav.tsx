'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useState } from 'react'

export default function Nav() {
  const { isManager, login, logout } = useAuth()
  const pathname = usePathname()
  const [showPin, setShowPin] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (login(pin)) {
      setShowPin(false)
      setPin('')
      setError('')
    } else {
      setError('Wrong PIN')
    }
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href
        ? 'bg-orange-600 text-white'
        : 'text-gray-700 hover:bg-orange-100'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          <Link href="/" className="mr-3">
            <Image src="/surefire-logo.png" alt="Surefire Market" height={32} width={160} className="object-contain" />
          </Link>
          <Link href="/" className={linkClass('/')}>Shift Log</Link>
          <Link href="/prep" className={linkClass('/prep')}>Prep Log</Link>
          <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
          <Link href="/inventory" className={linkClass('/inventory')}>Inventory</Link>
          <Link href="/calendar" className={linkClass('/calendar')}>Calendar</Link>
          {isManager && (
            <>
              <Link href="/order" className={linkClass('/order')}>Orders</Link>
              <Link href="/costing" className={linkClass('/costing')}>Costing</Link>
              <Link href="/price-analysis" className={linkClass('/price-analysis')}>Price Analysis</Link>
              <Link href="/simulator" className={linkClass('/simulator')}>Simulator</Link>
              <Link href="/prices" className={linkClass('/prices')}>Price List</Link>
              <Link href="/contacts" className={linkClass('/contacts')}>Contacts</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isManager ? (
            <>
              <span className="text-xs text-gray-500 hidden sm:block">Manager</span>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => { setShowPin(!showPin); setPin(''); setError('') }}
              className="text-xs text-orange-700 hover:text-orange-900 px-2 py-1 rounded hover:bg-orange-50 border border-orange-200"
            >
              Manager login
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-white">
        <p className="max-w-4xl mx-auto px-4 py-1 text-xs text-orange-600 italic font-bold">
          Quality that never folds.
        </p>
      </div>

      {showPin && (
        <div className="border-t border-gray-100 bg-gray-50">
          <form onSubmit={handleLogin} className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={e => { setPin(e.target.value); setError('') }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-orange-400"
              autoFocus
            />
            <button
              type="submit"
              className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-700"
            >
              Enter
            </button>
            {error && <span className="text-red-600 text-sm">{error}</span>}
          </form>
        </div>
      )}
    </nav>
  )
}
