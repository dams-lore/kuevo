'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Client-side OAuth callback page.
 * Captures the Google provider_token immediately after OAuth redirect (before it expires).
 * Saves to integrations table, then redirects to dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[auth/callback] page mounted, getting session...')

        const { data: { session }, error: sessionError } = await supabaseBrowser.auth.getSession()

        if (sessionError) {
          console.error('[auth/callback] session error:', sessionError)
          router.push('/login?error=session_error')
          return
        }

        if (!session) {
          console.log('[auth/callback] no session found')
          router.push('/login?error=no_session')
          return
        }

        console.log('[auth/callback] session found for user:', session.user.id)
        console.log('[auth/callback] provider_token available:', !!session.provider_token)

        // Save provider token to integrations table immediately
        if (session.provider_token) {
          console.log('[auth/callback] saving Google provider token to integrations table')

          const { error: upsertError } = await supabaseBrowser
            .from('integrations')
            .upsert({
              user_id: session.user.id,
              provider: 'google',
              access_token: session.provider_token,
              refresh_token: session.provider_refresh_token ?? null,
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,provider' })

          if (upsertError) {
            console.error('[auth/callback] error saving token:', upsertError)
          } else {
            console.log('[auth/callback] provider token saved successfully')
          }
        } else {
          console.warn('[auth/callback] no provider_token in session')
        }

        // Redirect to dashboard
        console.log('[auth/callback] redirecting to dashboard')
        router.push('/dashboard')
      } catch (e) {
        console.error('[auth/callback] error:', e)
        router.push('/login?error=callback_error')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-indigo-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        </div>
        <p className="text-white/60">Completing sign in...</p>
      </div>
    </div>
  )
}
