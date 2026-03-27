import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// TEMPORARY DEBUG ROUTE - Test email parsing
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (!integration?.access_token) {
    return NextResponse.json({ error: 'No Google integration' }, { status: 400 })
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

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Fetch 5 recent messages
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5,
    })

    const messages = listRes.data.messages || []
    const emailData = []

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Cc', 'Subject'],
      })

      const headers = full.data.payload?.headers || []
      const rawHeaders: Record<string, string> = {}
      for (const h of headers) {
        if (h.name && h.value) {
          rawHeaders[h.name] = h.value
        }
      }

      emailData.push({
        message_id: msg.id,
        headers: rawHeaders,
      })
    }

    return NextResponse.json({ 
      debug: 'Raw email headers from Gmail',
      messages: emailData 
    })
  } catch (e) {
    console.error('[test/email-parse] error:', e)
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}
