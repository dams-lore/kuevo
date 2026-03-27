import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    console.error('[auth/callback] OAuth error:', error)
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url))
  }

  const supabase = await createSupabaseServerClient()

  // Exchange code for session (this sets the session cookie automatically)
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.session) {
    console.error('[auth/callback] exchange error:', exchangeError)
    return NextResponse.redirect(new URL('/login?error=session_failed', req.url))
  }

  const session = data.session
  console.log('[auth/callback] session created for user:', session.user.id)

  // Extract Google provider tokens
  const providerToken = session.provider_token
  const providerRefreshToken = session.provider_refresh_token

  if (!providerToken) {
    console.error('[auth/callback] no provider_token in session')
    return NextResponse.redirect(new URL('/login?error=no_provider_token', req.url))
  }

  console.log('[auth/callback] storing Google tokens for user:', session.user.id)

  // Save to integrations table
  const { error: integrationError } = await supabase
    .from('integrations')
    .upsert({
      user_id: session.user.id,
      provider: 'google',
      access_token: providerToken,
      refresh_token: providerRefreshToken || null,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour default
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (integrationError) {
    console.error('[auth/callback] integration upsert error:', integrationError)
  }

  // Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', req.url))
}
