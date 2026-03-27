'use client'

import { useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Client-side component that captures the Google OAuth token immediately after login.
 * The provider_token only exists in the session right after OAuth redirect and is lost on refresh.
 * This component runs on the dashboard (first page after login) and saves the token to integrations table.
 */
export function GoogleTokenSaver() {
  useEffect(() => {
    const saveToken = async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession()

        if (!session) {
          console.log('[GoogleTokenSaver] no session found')
          return
        }

        console.log('[GoogleTokenSaver] session found for user:', session.user.id)
        console.log('[GoogleTokenSaver] provider_token available:', !!session.provider_token)

        if (session.provider_token) {
          console.log('[GoogleTokenSaver] saving Google token to integrations table')

          const { error } = await supabaseBrowser
            .from('integrations')
            .upsert({
              user_id: session.user.id,
              provider: 'google',
              access_token: session.provider_token,
              refresh_token: session.provider_refresh_token ?? null,
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,provider' })

          if (error) {
            console.error('[GoogleTokenSaver] error saving token:', error)
          } else {
            console.log('[GoogleTokenSaver] token saved successfully')
          }
        } else {
          console.log('[GoogleTokenSaver] no provider_token in session (may be on refresh)')
        }
      } catch (e) {
        console.error('[GoogleTokenSaver] error:', e)
      }
    }

    saveToken()
  }, [])

  return null
}
