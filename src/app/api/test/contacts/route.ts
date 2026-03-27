import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
    const peopleApi = google.people({ version: 'v1', auth: oauth2Client })

    const res = await peopleApi.people.connections.list({
      resourceName: 'people/me',
      pageSize: 20,
      personFields: 'names,emailAddresses,organizations',
      sortOrder: 'FIRST_NAME_ASCENDING',
    })

    const contacts = res.data.connections?.map((person) => ({
      name: person.names?.[0]?.displayName,
      email: person.emailAddresses?.[0]?.value,
      organization: person.organizations?.[0]?.name,
    })) || []

    return NextResponse.json({ 
      total: contacts.length,
      contacts: contacts.slice(0, 10),
    })
  } catch (e) {
    console.error('[test/contacts] error:', e)
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}
