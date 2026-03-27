import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface Folder {
  id: string
  name: string
  children?: Folder[]
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (!integration?.access_token) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
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

    // List all folders in the user's Drive
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name, parents)',
      pageSize: 100,
      spaces: 'drive',
    })

    const folders = res.data.files || []
    console.log('[drive/folders] found', folders.length, 'folders')

    // Build a simple flat list (not a tree for now, easier to select)
    const folderList = folders
      .filter(f => f.name && f.id) // Remove folders without name/id
      .map(f => ({
        id: f.id,
        name: f.name,
      }))
      .sort((a, b) => a.name!.localeCompare(b.name!))

    return NextResponse.json({ folders: folderList })
  } catch (e) {
    console.error('[drive/folders] error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Failed to fetch folders',
      folders: [],
    }, { status: 500 })
  }
}
