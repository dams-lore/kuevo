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

  try {
    // Search in regular contacts
    console.log('[contacts/search] searching contacts with query:', query)
    const res = await peopleApi.people.searchContacts({
      query,
      readMask: 'names,emailAddresses,organizations',
      pageSize: 10,
    })

    console.log('[contacts/search] people API results:', res.data.results?.length || 0, 'contacts')
    for (const person of res.data.results || []) {
      const p = person.person
      if (!p) continue
      const name = p.names?.[0]?.displayName || ''
      const email = p.emailAddresses?.[0]?.value || ''
      const company = p.organizations?.[0]?.name || ''
      console.log('[contacts/search] found contact:', { name, email, company })
      if (name || email) {
        contacts.push({ name, email, company, source: 'google' })
      }
    }
  } catch (e) {
    console.error('[contacts/search] people API error:', e instanceof Error ? e.message : String(e))
  }

  // Also search otherContacts if results < 5
  if (contacts.length < 5) {
    try {
      console.log('[contacts/search] searching otherContacts...')
      const res = await peopleApi.otherContacts.search({
        query,
        readMask: 'names,emailAddresses,organizations',
        pageSize: 5,
      })
      console.log('[contacts/search] otherContacts API results:', res.data.results?.length || 0)
      for (const person of res.data.results || []) {
        const p = person.person
        if (!p) continue
        const name = p.names?.[0]?.displayName || ''
        const email = p.emailAddresses?.[0]?.value || ''
        const company = p.organizations?.[0]?.name || ''
        if ((name || email) && !contacts.find(c => c.email === email)) {
          contacts.push({ name, email, company, source: 'google' })
        }
      }
    } catch (e) {
      console.error('[contacts/search] otherContacts error:', e instanceof Error ? e.message : String(e))
    }
  }

  console.log('[contacts/search] returning', contacts.length, 'contacts')
  return NextResponse.json({ contacts: contacts.slice(0, 8) })
}
