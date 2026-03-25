'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Handle both hash fragment (implicit) and code (PKCE) flows.
    // The Supabase browser client automatically processes the URL hash
    // (access_token / refresh_token) or the ?code= param and establishes
    // the session. We just need to wait for onAuthStateChange to fire.
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange(
      (event, session) => {
        console.log('[auth/callback] event:', event, 'session:', !!session)
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()
          router.replace('/dashboard')
        } else if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
          subscription.unsubscribe()
          router.replace('/login?error=auth_failed')
        }
      }
    )

    // Fallback: if already signed in (e.g. session was restored from storage)
    supabaseBrowser.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        subscription.unsubscribe()
        router.replace('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-indigo-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Signing you in…</p>
      </div>
    </div>
  )
}
