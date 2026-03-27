import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// TEMPORARY DEBUG ROUTE - Tests Drive API directly
export async function POST(req: Request) {
  const { company_name } = await req.json()
  
  if (!company_name) {
    return NextResponse.json({ error: 'company_name required' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  console.log('[drive-api test] user:', session.user.email)
  console.log('[drive-api test] searching for company:', company_name)

  // Get integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  console.log('[drive-api test] integration found:', !!integration)
  console.log('[drive-api test] access_token present:', !!integration?.access_token)

  if (!integration?.access_token) {
    return NextResponse.json({ error: 'No Google integration found' }, { status: 400 })
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
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    
    // Test: Simple keyword search for company name
    const driveQuery = `name contains '${company_name}' and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")`
    console.log('[drive-api test] drive query:', driveQuery)
    
    const filesRes = await drive.files.list({
      q: driveQuery,
      fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
      pageSize: 10,
      orderBy: 'modifiedTime desc',
    })

    console.log('[drive-api test] files found:', filesRes.data.files?.length || 0)
    console.log('[drive-api test] raw response:', JSON.stringify(filesRes.data, null, 2))

    return NextResponse.json({
      test: 'success',
      query: driveQuery,
      files_count: filesRes.data.files?.length || 0,
      files: filesRes.data.files?.map(f => ({
        name: f.name,
        url: f.webViewLink,
        type: f.mimeType,
        modified: f.modifiedTime,
      })) || [],
    })
  } catch (e) {
    console.error('[drive-api test] error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}
