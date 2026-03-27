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
    source: 'gmail'
  }

  const contacts: Contact[] = []
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  try {
    console.log('[contacts/search] searching Gmail for:', query)
    
    // Search Gmail for emails from/to this name or email
    const gmailQuery = `from:${query} OR to:${query}`
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: gmailQuery,
      maxResults: 50,
    })

    const messages = listRes.data.messages || []
    console.log('[contacts/search] found', messages.length, 'Gmail messages')

    const contactMap = new Map<string, { name: string; email: string }>()

    // Extract sender/recipient info from each message
    for (const msg of messages.slice(0, 30)) {
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To'],
        })

        const headers = full.data.payload?.headers || []
        const fromHeader = headers.find(h => h.name === 'From')?.value || ''
        const toHeader = headers.find(h => h.name === 'To')?.value || ''

        // Parse email headers to extract name and email
        const parseEmail = (header: string) => {
          // Match: "Name" <email@domain.com> or Name <email@domain.com> or just email@domain.com
          const match = header.match(/^"?([^"<]+)"?\s*<([^>]+)>|^([a-z0-9._%+-]+@[a-z0-9.-]+)/i)
          if (match) {
            let name = (match[1] || match[3] || '').trim().replace(/^["']|["']$/g, '')
            let email = match[2] || match[3]
            return name && email ? { name, email } : null
          }
          return null
        }

        const fromParsed = parseEmail(fromHeader)
        const toParsed = parseEmail(toHeader)

        // Add to map if not already there
        if (fromParsed && !contactMap.has(fromParsed.email.toLowerCase())) {
          contactMap.set(fromParsed.email.toLowerCase(), fromParsed)
        }
        if (toParsed && !contactMap.has(toParsed.email.toLowerCase())) {
          contactMap.set(toParsed.email.toLowerCase(), toParsed)
        }
      } catch (e) {
        console.error('[contacts/search] error parsing message:', e)
      }
    }

    console.log('[contacts/search] extracted', contactMap.size, 'unique email addresses')

    // Filter by query match and build final contacts list
    for (const [, contact] of contactMap) {
      // Only show if name or email matches query
      if (
        contact.name?.toLowerCase().includes(query.toLowerCase()) ||
        contact.email?.toLowerCase().includes(query.toLowerCase())
      ) {
        // Guess company from email domain
        let company = ''
        const domain = contact.email.split('@')[1]
        if (domain && domain !== 'gmail.com' && domain !== 'yahoo.com' && domain !== 'outlook.com') {
          company = domain
            .split('.')[0]
            .split('-').join(' ')
            .split('_').join(' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())
            .trim()
        }

        console.log('[contacts/search] matched contact:', { name: contact.name, email: contact.email, company })
        contacts.push({ name: contact.name, email: contact.email, company, source: 'gmail' })
      }
    }
  } catch (e) {
    console.error('[contacts/search] Gmail search error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ 
      contacts: [], 
      error: e instanceof Error ? e.message : 'Failed to search Gmail'
    }, { status: 500 })
  }

  console.log('[contacts/search] returning', contacts.length, 'contacts')
  return NextResponse.json({ contacts: contacts.slice(0, 8) })
}
