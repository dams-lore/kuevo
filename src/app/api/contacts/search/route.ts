import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ contacts: [] })
  }

  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (!integration?.access_token) {
    return NextResponse.json({ contacts: [], error: 'Google not connected' })
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

  type Contact = {
    name: string
    email: string
    company: string
    source: 'google'
  }

  const contacts: Contact[] = []

  const peopleApi = google.people({ version: 'v1', auth: oauth2Client })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  try {
    // Fetch Google Contacts
    console.log('[contacts/search] fetching connections with query:', query)
    const res = await peopleApi.people.connections.list({
      resourceName: 'people/me',
      pageSize: 100,
      personFields: 'names,emailAddresses,organizations',
      sortOrder: 'FIRST_NAME_ASCENDING',
    })

    const connectionsData = res.data.connections
    console.log('[contacts/search] connections API results:', connectionsData?.length || 0, 'contacts')
    console.log('[contacts/search] raw response:', JSON.stringify(res.data, null, 2).substring(0, 500))
    
    if (!connectionsData || connectionsData.length === 0) {
      console.log('[contacts/search] WARNING: No connections found. User may not have any Google Contacts.')
      return NextResponse.json({ contacts: [], warning: 'No contacts found in Google Contacts' })
    }

    for (const person of connectionsData) {
      const name = person.names?.[0]?.displayName || ''
      const email = person.emailAddresses?.[0]?.value || ''
      let company = person.organizations?.[0]?.name || ''
      
      // If no company registered, guess from email domain
      if (!company && email) {
        const domain = email.split('@')[1]
        if (domain) {
          // Convert domain to company name: "acmecorp.com" → "Acme Corp"
          company = domain
            .split('.')[0] // Remove TLD
            .split('-').join(' ') // Replace hyphens with spaces
            .split('_').join(' ') // Replace underscores with spaces
            .split(/(?=[A-Z])/).join(' ') // Split camelCase
            .replace(/\b\w/g, (l) => l.toUpperCase()) // Capitalize each word
            .trim()
        }
      }
      
      // Filter by query (client-side since API doesn't have great search)
      if ((name?.toLowerCase().includes(query.toLowerCase()) || email?.toLowerCase().includes(query.toLowerCase())) && (name || email)) {
        console.log('[contacts/search] found contact:', { name, email, company })
        contacts.push({ name, email, company, source: 'google' })
      }
    }
  } catch (e) {
    console.error('[contacts/search] people API error:', e instanceof Error ? e.message : String(e))
    console.error('[contacts/search] full error:', e)
    return NextResponse.json({ contacts: [], error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  // TODO: Email-based contact extraction disabled for now
  // Reason: Gmail API full message format is slow, header parsing is complex
  // Will re-implement with batch processing + caching in future version
  console.log('[contacts/search] email extraction disabled (Gmail API optimization needed)')

  console.log('[contacts/search] returning', contacts.length, 'contacts')
  console.log('[contacts/search] sample contacts:', contacts.slice(0, 3))
  return NextResponse.json({ contacts: contacts.slice(0, 8) })
}
