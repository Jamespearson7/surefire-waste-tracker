import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import Nav from '@/components/Nav'
import StaffGate from '@/components/StaffGate'

export const metadata: Metadata = {
  title: 'Surefire Waste Tracker',
  description: 'Surefire Market — Waste Tracking System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen flex flex-col">
        <AuthProvider>
          <StaffGate>
            <Nav />
            <main className="max-w-4xl mx-auto px-4 py-6 flex-1 w-full">
              {children}
            </main>
            <footer className="border-t border-gray-200 bg-white mt-12">
              <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-1">
                <p className="text-xs text-gray-400">
                  &copy; {new Date().getFullYear()} Surefire Market. All rights reserved.
                </p>
                <p className="text-base text-orange-600 italic font-bold">Quality that never folds.</p>
              </div>
            </footer>
          </StaffGate>
        </AuthProvider>
      </body>
    </html>
  )
}
