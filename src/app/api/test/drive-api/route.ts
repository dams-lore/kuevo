import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { google } from 'googleapis'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // Get Google integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('provider', 'google')
      .single()

    if (!integration?.access_token) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 401 })
    }

    // Set up Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://kuevo.io/api/auth/google/callback'
    )
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Test search for "Fittersticker"
    const testQuery = `fullText contains 'Fittersticker' and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")`
    console.log('[test/drive-api] query:', testQuery)

    const res = await drive.files.list({
      q: testQuery,
      fields: 'files(id, name, webViewLink, mimeType, modifiedTime, parents)',
      pageSize: 10,
      orderBy: 'modifiedTime desc',
    })

    const result = {
      query: testQuery,
      user_id: session.user.id,
      has_token: !!integration.access_token,
      token_preview: integration.access_token.substring(0, 20),
      files_found: res.data.files?.length || 0,
      raw_response: {
        kind: res.data.kind,
        files: res.data.files?.map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          webViewLink: f.webViewLink?.substring(0, 60),
          modifiedTime: f.modifiedTime,
        })) || [],
        nextPageToken: res.data.nextPageToken || null,
      },
    }

    console.log('[test/drive-api] result:', JSON.stringify(result, null, 2))
    return NextResponse.json(result)
  } catch (e) {
    console.error('[test/drive-api] error:', e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Test failed',
      user_id: session.user.id,
    }, { status: 500 })
  }
}
