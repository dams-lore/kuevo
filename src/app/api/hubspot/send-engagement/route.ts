import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pageId, hubspotContactId, pageName, opens, clicks, timeSpent } = await req.json()

  if (!hubspotContactId || !pageId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // Get HubSpot integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'hubspot')
      .single()

    if (intError || !integration?.access_token) {
      console.log('[hubspot/engagement] HubSpot not connected for user:', user.id)
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 401 })
    }

    const accessToken = integration.access_token

    // Create note on contact with engagement data
    const noteContent = `Kuevo Page Engagement:
Page: ${pageName}
Opens: ${opens || 0}
Clicks: ${clicks || 0}
Time Spent: ${timeSpent ? Math.round(timeSpent / 1000) + 's' : 'N/A'}

View page: https://kuevo.io/p/[slug]`

    const noteUrl = 'https://api-eu1.hubapi.com/crm/v3/objects/notes'
    const notePayload = {
      properties: {
        hs_note_body: noteContent,
      },
      associations: [
        {
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 185, // contact to note association
            },
          ],
          id: hubspotContactId,
        },
      ],
    }

    const noteRes = await fetch(noteUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notePayload),
    })

    if (!noteRes.ok) {
      const error = await noteRes.text()
      console.error('[hubspot/engagement] note creation failed:', error)
      return NextResponse.json({ error: 'Failed to create note' }, { status: noteRes.status })
    }

    const noteData = await noteRes.json()
    console.log('[hubspot/engagement] note created:', noteData.id, 'for contact:', hubspotContactId)

    return NextResponse.json({ success: true, noteId: noteData.id })
  } catch (e) {
    console.error('[hubspot/engagement] error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: 'Failed to send engagement' }, { status: 500 })
  }
}
