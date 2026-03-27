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

    console.log('[contacts/search] connections API results:', res.data.connections?.length || 0, 'contacts')
    for (const person of res.data.connections || []) {
      const name = person.names?.[0]?.displayName || ''
      const email = person.emailAddresses?.[0]?.value || ''
      const company = person.organizations?.[0]?.name || ''
      
      // Filter by query (client-side since API doesn't have great search)
      if ((name?.toLowerCase().includes(query.toLowerCase()) || email?.toLowerCase().includes(query.toLowerCase())) && (name || email)) {
        console.log('[contacts/search] found contact:', { name, email, company })
        contacts.push({ name, email, company, source: 'google' })
      }
    }
  } catch (e) {
    console.error('[contacts/search] people API error:', e instanceof Error ? e.message : String(e))
  }

  // Also extract contacts from recent emails (sender/recipient names)
  try {
    console.log('[contacts/search] fetching recent emails for contact extraction...')
    const emailRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'in:sent OR in:inbox',
    })

    const emailContactMap = new Map<string, { name: string; email: string }>()

    for (const msg of emailRes.data.messages || []) {
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Cc'],
        })

        const headers = full.data.payload?.headers || []
        const parseEmailHeader = (header: string) => {
          // Parse "Name <email@domain.com>" or just "email@domain.com"
          const match = header.match(/^"?([^"<]*)"?\s*<([^>]+)>|^([^<\s]+@[^<\s]+)/)
          if (match) {
            let name = match[1] || ''
            let email = match[2] || match[3] || ''
            
            // Clean up name
            name = name
              .trim()
              .replace(/^["']|["']$/g, '') // Remove quotes
              .replace(/\s+via\s+.*$/i, '') // Remove "via ..." suffixes
            
            // Only accept if we have a valid email
            if (email && email.includes('@')) {
              return { name: name || email.split('@')[0], email }
            }
          }
          return null
        }

        for (const headerName of ['From', 'To', 'Cc']) {
          const header = headers.find(h => h.name === headerName)?.value
          if (header) {
            // Split by comma for multiple recipients
            for (const part of header.split(',')) {
              const parsed = parseEmailHeader(part.trim())
              if (parsed && parsed.email && !emailContactMap.has(parsed.email.toLowerCase())) {
                emailContactMap.set(parsed.email.toLowerCase(), parsed)
              }
            }
          }
        }
      } catch (e) {
        // Skip individual message errors
      }
    }

    // Filter email contacts by query and add to results
    for (const [, contact] of emailContactMap) {
      // Only add if name looks real (not a service email or just domain)
      const isRealName = contact.name && 
        contact.name.length > 2 && 
        !contact.name.includes('@') &&
        !['noreply', 'no-reply', 'donotreply', 'support', 'info', 'hello', 'contact'].includes(contact.name.toLowerCase())
      
      if (isRealName && 
          (contact.name?.toLowerCase().includes(query.toLowerCase()) || 
           contact.email?.toLowerCase().includes(query.toLowerCase())) &&
          !contacts.find(c => c.email === contact.email)) {
        console.log('[contacts/search] found email contact:', contact)
        contacts.push({ name: contact.name, email: contact.email, company: '', source: 'google' })
      }
    }
  } catch (e) {
    console.error('[contacts/search] email extraction error:', e instanceof Error ? e.message : String(e))
  }

  console.log('[contacts/search] returning', contacts.length, 'contacts')
  return NextResponse.json({ contacts: contacts.slice(0, 8) })
}
