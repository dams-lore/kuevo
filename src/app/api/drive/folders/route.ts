import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface Folder {
  id: string
  name: string
  level: number
  parentId?: string
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

    // Fetch all folders with their parent relationships
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name, parents)',
      pageSize: 1000,
      spaces: 'drive',
    })

    const allFiles = res.data.files || []
    console.log('[drive/folders] found', allFiles.length, 'folders')

    // Build a map of id -> folder
    const folderMap = new Map<string, Folder>()
    const rootFolders: Folder[] = []

    // First pass: create all folder objects
    for (const file of allFiles) {
      if (file.id && file.name) {
        folderMap.set(file.id, {
          id: file.id,
          name: file.name,
          level: 0,
          parentId: file.parents?.[0],
          children: [],
        })
      }
    }

    // Second pass: build tree by linking parent-child
    for (const [, folder] of folderMap) {
      if (folder.parentId && folderMap.has(folder.parentId)) {
        const parent = folderMap.get(folder.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(folder)
        folder.level = parent.level + 1
      } else {
        // Root folder (no parent in our list, or parent is "My Drive")
        rootFolders.push(folder)
      }
    }

    // Sort children alphabetically
    const sortFolders = (folders: Folder[]) => {
      folders.sort((a, b) => a.name.localeCompare(b.name))
      for (const folder of folders) {
        if (folder.children) sortFolders(folder.children)
      }
    }
    sortFolders(rootFolders)

    return NextResponse.json({ folders: rootFolders, total: allFiles.length })
  } catch (e) {
    console.error('[drive/folders] error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Failed to fetch folders',
      folders: [],
    }, { status: 500 })
  }
}
