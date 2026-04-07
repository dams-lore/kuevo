import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { query } = await req.json()

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  try {
    // Get HubSpot integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'hubspot')
      .single()

    if (intError || !integration?.access_token) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 401 })
    }

    const accessToken = integration.access_token

    // Search contacts in HubSpot
    const searchUrl = 'https://api-eu1.hubapi.com/crm/v3/objects/contacts/search'
    const searchPayload = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'firstname',
              operator: 'CONTAINS_TOKEN',
              value: query,
            },
          ],
        },
        {
          filters: [
            {
              propertyName: 'lastname',
              operator: 'CONTAINS_TOKEN',
              value: query,
            },
          ],
        },
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'CONTAINS_TOKEN',
              value: query,
            },
          ],
        },
      ],
      limit: 10,
      after: '0',
      properties: ['firstname', 'lastname', 'company', 'email'],
    }

    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchPayload),
    })

    if (!searchRes.ok) {
      const error = await searchRes.text()
      console.error('[hubspot/search] API error:', error)
      return NextResponse.json({ error: 'HubSpot search failed' }, { status: searchRes.status })
    }

    const data = await searchRes.json()
    const contacts = (data.results || []).map((result: any) => {
      const props = result.properties || {}
      return {
        id: result.id,
        firstName: props.firstname || '',
        lastName: props.lastname || '',
        company: props.company || '',
        email: props.email || '',
      }
    })

    console.log('[hubspot/search] found', contacts.length, 'contacts for query:', query)

    return NextResponse.json({ contacts })
  } catch (e) {
    console.error('[hubspot/search] error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
