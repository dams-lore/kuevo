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
  console.log('[auth/callback] provider_token available server-side:', !!session.provider_token)

  // Note: provider_token is NOT available server-side with @supabase/ssr
  // It will be captured client-side by GoogleTokenSaver component on dashboard

  // Redirect to dashboard where GoogleTokenSaver will run
  return NextResponse.redirect(new URL('/dashboard', req.url))
}
