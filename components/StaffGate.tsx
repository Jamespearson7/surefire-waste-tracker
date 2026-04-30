'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth'

export default function StaffGate({ children }: { children: React.ReactNode }) {
  const { isStaff, staffLogin } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffLogin(code)) {
      setError('Incorrect code. Please try again.')
      setCode('')
    }
  }

  if (isStaff) return <>{children}</>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center space-y-6">
        <Image
          src="/surefire-logo.png"
          alt="Surefire Market"
          width={200}
          height={80}
          className="object-contain mx-auto"
        />
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Team Access Only</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your team code to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Enter code"
            value={code}
            onChange={e => { setCode(e.target.value); setError('') }}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            Enter
          </button>
        </form>
        <p className="text-xs text-orange-600 italic font-bold">Quality that never folds.</p>
      </div>
    </div>
  )
}
