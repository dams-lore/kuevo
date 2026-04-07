import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://kuevo.io'}/login`)
  }

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    if (!code) {
      throw new Error('No authorization code received')
    }

    // Exchange code for access token
    // Use EU region API if needed
    const tokenResponse = await fetch('https://api-eu1.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID || '',
        client_secret: process.env.HUBSPOT_CLIENT_SECRET || '',
        redirect_uri: process.env.HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://kuevo.io'}/api/auth/hubspot/callback`,
        code,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    // Store in integrations table
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    const { error } = await supabase
      .from('integrations')
      .upsert({
        user_id: user.id,
        provider: 'hubspot',
        access_token,
        refresh_token: refresh_token || null,
        expires_at: expiresAt,
      }, {
        onConflict: 'user_id,provider',
      })

    if (error) {
      console.error('[hubspot/callback] upsert error:', error)
      throw error
    }

    console.log('[hubspot/callback] successfully stored HubSpot token for user:', user.id)

    // Redirect to settings page
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://kuevo.io'}/settings?hubspot_connected=true`)
  } catch (e) {
    console.error('[hubspot/callback] error:', e)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://kuevo.io'}/settings?hubspot_error=true`)
  }
}
