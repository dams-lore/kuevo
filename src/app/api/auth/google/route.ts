import { NextResponse } from 'next/server'

// The redirect URI MUST match exactly what's in Google Cloud Console:
// https://kuevo.io/api/auth/google/callback
const REDIRECT_URI = 'https://kuevo.io/api/auth/google/callback'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID

  console.log('[gmail-oauth] GOOGLE_CLIENT_ID present:', !!clientId)
  console.log('[gmail-oauth] GOOGLE_CLIENT_SECRET present:', !!process.env.GOOGLE_CLIENT_SECRET)
  console.log('[gmail-oauth] redirect_uri:', REDIRECT_URI)

  if (!clientId || clientId === 'placeholder') {
    console.error('[gmail-oauth] GOOGLE_CLIENT_ID not configured')
    return NextResponse.redirect('https://kuevo.io/create?error=google_not_configured')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/contacts.other.readonly',
      'email',
      'profile',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
