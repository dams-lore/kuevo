import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect_name, company } = await req.json()

  // Get integration tokens
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (!integration) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token
  })

  // Fetch emails
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const domain = company.toLowerCase().replace(/\s+/g, '') + '.com'

  let emailSummaries: string[] = []
  try {
    const messages = await gmail.users.messages.list({
      userId: 'me',
      q: `from:${domain} OR to:${domain}`,
      maxResults: 10
    })

    if (messages.data.messages) {
      for (const msg of messages.data.messages.slice(0, 5)) {
        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id! })
        const subject = full.data.payload?.headers?.find(h => h.name === 'Subject')?.value || ''
        const snippet = full.data.snippet || ''
        emailSummaries.push(`Subject: ${subject}\nSnippet: ${snippet}`)
      }
    }
  } catch (e) {
    console.error('Gmail fetch error:', e)
  }

  // Fetch Drive files
  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  let driveFiles: Array<{ name: string; webViewLink: string }> = []
  try {
    const files = await drive.files.list({
      q: `name contains '${company}' and trashed = false`,
      fields: 'files(id, name, webViewLink, mimeType)',
      pageSize: 10
    })
    driveFiles = (files.data.files || []).map(f => ({
      name: f.name || '',
      webViewLink: f.webViewLink || ''
    }))
  } catch (e) {
    console.error('Drive fetch error:', e)
  }

  // Generate intro with Claude
  const context = `
Prospect: ${prospect_name} at ${company}

Recent email context:
${emailSummaries.join('\n\n') || 'No emails found'}

Available Drive files:
${driveFiles.map(f => f.name).join('\n') || 'No files found'}
  `

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Based on this sales context, write a personalized 2-3 sentence intro for a follow-up sharing page, and suggest up to 3 relevant Drive files to share. Return JSON: {"intro": "...", "suggested_blocks": [{"title": "...", "url": "..."}]}

Context:
${context}`
    }]
  })

  try {
    const text = (message.content[0] as { type: string; text: string }).text
    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ intro: (message.content[0] as { type: string; text: string }).text, suggested_blocks: [] })
  }
}
