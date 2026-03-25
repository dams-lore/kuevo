import { NextResponse } from 'next/server'

// Temporary debug endpoint — remove after diagnosing OAuth mismatch
// Visit https://kuevo.io/api/auth/google/debug to see the exact URL being sent to Google
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const REDIRECT_URI = 'https://kuevo.io/api/auth/google/callback'

  const params = new URLSearchParams({
    client_id: clientId ?? '(not set)',
    redirect_uri: REDIRECT_URI,
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

  const fullAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

  return NextResponse.json({
    debug: true,
    gmail_drive_oauth: {
      client_id_present: !!clientId && clientId !== 'placeholder',
      client_secret_present: !!process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== 'placeholder',
      redirect_uri_sent_to_google: REDIRECT_URI,
      full_auth_url: fullAuthUrl,
    },
    supabase_google_signin: {
      note: 'Supabase handles this OAuth flow server-side. The redirect_uri Google sees is NOT kuevo.io — it is the Supabase project callback URL.',
      supabase_callback_url: `https://usofbgfehqmcfzavckhu.supabase.co/auth/v1/callback`,
      action_required: 'Add https://usofbgfehqmcfzavckhu.supabase.co/auth/v1/callback to Google Cloud Console → Authorized redirect URIs',
    },
  })
}
