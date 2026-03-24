import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kuevo.io'
  const redirectTo = `${siteUrl}${next}`
  const errorUrl = `${siteUrl}/login?error=auth_failed`

  console.log('[auth/callback] params:', { code: !!code, token_hash: !!token_hash, type, next })

  const response = NextResponse.redirect(redirectTo)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // PKCE flow (code param)
  if (code) {
    console.log('[auth/callback] exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchange result:', { user: data?.user?.email, error: error?.message })
    if (!error) return response
    return NextResponse.redirect(errorUrl)
  }

  // OTP / magic link flow (token_hash param)
  if (token_hash && type) {
    console.log('[auth/callback] verifying OTP token_hash...')
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'magiclink' | 'email' | 'recovery' | 'invite',
    })
    console.log('[auth/callback] verify result:', { user: data?.user?.email, error: error?.message })
    if (!error) return response
    return NextResponse.redirect(errorUrl)
  }

  // No params — likely direct hit, redirect home
  console.log('[auth/callback] no code or token_hash, redirecting to login')
  return NextResponse.redirect(errorUrl)
}
