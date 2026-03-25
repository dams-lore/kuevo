import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function makeEmailRaw({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): string {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join('\r\n')

  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing fields: to, subject, body' }, { status: 400 })
  }

  // Get integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (!integration?.access_token) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://kuevo.io/api/auth/google/callback'
  )
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
  })

  // Refresh token if close to expiry
  if (integration.expires_at) {
    const expiresAt = new Date(integration.expires_at).getTime()
    if (expiresAt - Date.now() < 5 * 60 * 1000) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        oauth2Client.setCredentials(credentials)
        await supabase.from('integrations').update({
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', session.user.id)
      } catch (e) {
        console.error('[email/send] token refresh failed:', e)
      }
    }
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const raw = makeEmailRaw({ to, subject, body })
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[email/send] gmail send error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
