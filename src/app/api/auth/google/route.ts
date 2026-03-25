import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'https://kuevo.io/api/auth/google/callback'

  console.log('[google/oauth] client_id present:', !!clientId)
  console.log('[google/oauth] redirect_uri:', redirectUri)

  if (!clientId) {
    console.error('[google/oauth] GOOGLE_CLIENT_ID is not set')
    return NextResponse.redirect('https://kuevo.io/create?error=google_not_configured')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'email',
      'profile',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  console.log('[google/oauth] redirecting to:', authUrl)

  return NextResponse.redirect(authUrl)
}
