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
      maxResults: 30,
    })

    const emailContactMap = new Map<string, { name: string; email: string }>()

    for (const msg of emailRes.data.messages || []) {
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        })

        // Get headers safely
        const headers = full.data.payload?.headers || []
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value || ''
        
        const fromHeader = getHeader('From')
        const toHeader = getHeader('To')
        
        // Simple email parsing: extract "Name <email@domain.com>" or just "email@domain.com"
        const extractEmails = (headerStr: string) => {
          if (!headerStr) return []
          const results = []
          // Match patterns like: "John Doe" <john@example.com> or john@example.com or john.doe@example.com
          const emailRegex = /([^<>"]*?)\s*<([^>]+@[^>]+)>|([a-z0-9._%+-]+@[a-z0-9.-]+)/gi
          let match
          while ((match = emailRegex.exec(headerStr)) !== null) {
            let name = (match[1] || match[3] || '').trim()
            let email = match[2] || match[3]
            if (email && email.includes('@')) {
              results.push({ name, email: email.toLowerCase() })
            }
          }
          return results
        }

        const fromEmails = extractEmails(fromHeader)
        const toEmails = extractEmails(toHeader)
        
        console.log('[contacts/search] extracted from email:', { fromEmails, toEmails })

        // Add all extracted emails to map
        for (const contact of [...fromEmails, ...toEmails]) {
          if (!emailContactMap.has(contact.email)) {
            // Use name if available, otherwise extract from email prefix
            const finalName = contact.name || contact.email.split('@')[0]
            emailContactMap.set(contact.email, { name: finalName, email: contact.email })
          }
        }
      } catch (e) {
        console.error('[contacts/search] error processing message:', e)
      }
    }

    console.log('[contacts/search] total email contacts extracted:', emailContactMap.size)

    // Filter email contacts by query and add to results
    for (const [, contact] of emailContactMap) {
      // Skip service emails
      const serviceEmails = ['noreply', 'no-reply', 'donotreply', 'support', 'info', 'hello', 'contact', 'notifications', 'alerts']
      const emailPrefix = contact.email.split('@')[0].toLowerCase()
      const isServiceEmail = serviceEmails.some(s => emailPrefix.includes(s))
      
      if (!isServiceEmail &&
          (contact.name?.toLowerCase().includes(query.toLowerCase()) || 
           contact.email?.toLowerCase().includes(query.toLowerCase())) &&
          !contacts.find(c => c.email === contact.email)) {
        console.log('[contacts/search] adding email contact:', contact)
        contacts.push({ name: contact.name, email: contact.email, company: '', source: 'google' })
      }
    }
  } catch (e) {
    console.error('[contacts/search] email extraction error:', e instanceof Error ? e.message : String(e))
  }

  console.log('[contacts/search] returning', contacts.length, 'contacts')
  return NextResponse.json({ contacts: contacts.slice(0, 8) })
}
