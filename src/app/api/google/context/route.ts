import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Turn "Acme Corp" → ["acmecorp.com", "acme.com", "acme-corp.com"]
function guessDomains(company: string): string[] {
  const clean = company.toLowerCase().trim()
  // Remove common suffixes
  const stripped = clean
    .replace(/\b(inc|llc|ltd|corp|corporation|group|co|company|gmbh|sas|srl|bv|ag)\b\.?/g, '')
    .trim()
  const noSpaces = stripped.replace(/\s+/g, '')
  const hyphenated = stripped.replace(/\s+/g, '-')
  const firstWord = stripped.split(/\s+/)[0]
  return [...new Set([
    `${noSpaces}.com`,
    `${hyphenated}.com`,
    `${firstWord}.com`,
    `${noSpaces}.io`,
    `${firstWord}.io`,
  ])]
}

// Build Gmail search query from domain candidates
function buildGmailQuery(domains: string[]): string {
  const domainFilters = domains.map(d => `from:${d} OR to:${d}`).join(' OR ')
  return domainFilters
}

async function refreshTokenIfNeeded(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  integration: { access_token: string; refresh_token: string | null; expires_at: string | null },
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  // If token expires in less than 5 minutes, refresh it
  if (integration.expires_at) {
    const expiresAt = new Date(integration.expires_at).getTime()
    const now = Date.now()
    if (expiresAt - now < 5 * 60 * 1000) {
      console.log('[google/context] refreshing expired token...')
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        oauth2Client.setCredentials(credentials)
        // Update in DB
        await supabase.from('integrations').update({
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        console.log('[google/context] token refreshed successfully')
      } catch (e) {
        console.error('[google/context] token refresh failed:', e)
      }
    }
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect_name, company } = await req.json()
  if (!prospect_name || !company) {
    return NextResponse.json({ error: 'prospect_name and company are required' }, { status: 400 })
  }

  // Get integration tokens
  const { data: integration, error: intError } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (intError || !integration) {
    return NextResponse.json({ error: 'Google not connected. Please connect Google first.' }, { status: 400 })
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

  // Refresh token if needed
  await refreshTokenIfNeeded(oauth2Client, integration, supabase, session.user.id)

  const domains = guessDomains(company)
  console.log('[google/context] guessed domains:', domains)

  // ── Gmail ────────────────────────────────────────────────────────────────
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const emailSummaries: string[] = []

  try {
    const gmailQuery = buildGmailQuery(domains)
    console.log('[google/context] gmail query:', gmailQuery)

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: gmailQuery,
      maxResults: 15,
    })

    const messages = listRes.data.messages || []
    console.log('[google/context] gmail messages found:', messages.length)

    for (const msg of messages.slice(0, 6)) {
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date'],
        })
        const headers = full.data.payload?.headers || []
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)'
        const from = headers.find(h => h.name === 'From')?.value || ''
        const date = headers.find(h => h.name === 'Date')?.value || ''
        const snippet = full.data.snippet || ''
        emailSummaries.push(`Date: ${date}\nFrom: ${from}\nSubject: ${subject}\nSnippet: ${snippet}`)
      } catch (e) {
        console.error('[google/context] error fetching message:', e)
      }
    }
  } catch (e) {
    console.error('[google/context] gmail list error:', e)
  }

  // ── Drive ────────────────────────────────────────────────────────────────
  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  type DriveFile = { name: string; webViewLink: string; mimeType: string }
  let driveFiles: DriveFile[] = []

  try {
    // Search by name (company name or first word)
    const firstWord = company.split(/\s+/)[0]
    const driveQuery = `(name contains '${company}' OR name contains '${firstWord}') and trashed = false`
    console.log('[google/context] drive query:', driveQuery)

    const filesRes = await drive.files.list({
      q: driveQuery,
      fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
      pageSize: 20,
      orderBy: 'modifiedTime desc',
    })

    const allFiles = filesRes.data.files || []
    console.log('[google/context] drive files found:', allFiles.length)

    // Filter to shareable doc types, prefer Docs/Sheets/Slides/PDF
    const priority = ['application/vnd.google-apps.presentation', 'application/vnd.google-apps.document', 'application/pdf', 'application/vnd.google-apps.spreadsheet']
    const sorted = [...allFiles].sort((a, b) => {
      const ai = priority.indexOf(a.mimeType || '')
      const bi = priority.indexOf(b.mimeType || '')
      const aScore = ai === -1 ? 99 : ai
      const bScore = bi === -1 ? 99 : bi
      return aScore - bScore
    })

    // CAP AT 3 FILES
    driveFiles = sorted.slice(0, 3).map(f => {
      console.log('[google/context] selected drive file:', { name: f.name, type: f.mimeType })
      return {
        name: f.name || '',
        webViewLink: f.webViewLink || '',
        mimeType: f.mimeType || '',
      }
    })
  } catch (e) {
    console.error('[google/context] drive error:', e)
  }

  // ── Claude ────────────────────────────────────────────────────────────────
  const emailContext = emailSummaries.length > 0
    ? emailSummaries.join('\n\n---\n\n')
    : 'No emails found with this company domain.'

  const driveContext = driveFiles.length > 0
    ? driveFiles.map(f => `- ${f.name} (${f.webViewLink})`).join('\n')
    : 'No relevant Drive files found.'

  const prompt = `You are a sales follow-up expert helping prepare a personalized sharing page.

PROSPECT: ${prospect_name} at ${company}

EMAIL CONTEXT:
${emailContext}

AVAILABLE FILES:
${driveContext}

TASK: Generate a professional yet personal intro message for a follow-up page, plus suggest the most relevant files.

INTRO MESSAGE FORMAT (exactly 4 sentences max):
1. Personalized opener mentioning the prospect/company (reference something from emails if available)
2. Clear statement of what's being shared and why it's relevant
3. Brief value statement
4. Soft CTA (e.g., "Feel free to review at your pace")

RULES:
- Max 4 sentences total
- Professional but warm tone
- Reference specific topics from emails when available
- Never generic — always personalized
- Only suggest files with valid URLs (webViewLink)

Respond ONLY with valid JSON, no markdown:
{
  "intro": "Personalized intro message here",
  "suggested_blocks": [
    {"title": "File Name", "url": "https://drive.google.com/..."},
    {"title": "File Name", "url": "https://drive.google.com/..."}
  ]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    console.log('[google/context] claude raw response:', raw.substring(0, 200))

    // Strip markdown code blocks if Claude wrapped the JSON
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const result = JSON.parse(jsonStr)

    // Validate shape
    if (!result.intro || typeof result.intro !== 'string') {
      throw new Error('Missing intro in Claude response')
    }

    return NextResponse.json({
      intro: result.intro,
      suggested_blocks: Array.isArray(result.suggested_blocks)
        ? result.suggested_blocks.filter((b: { title?: string; url?: string }) => b.title && b.url)
        : [],
      debug: {
        emails_found: emailSummaries.length,
        drive_files_found: driveFiles.length,
        domains_searched: domains,
      },
    })
  } catch (e) {
    console.error('[google/context] claude/parse error:', e)
    return NextResponse.json({
      error: 'Failed to generate context. Check Vercel logs.',
      debug: {
        emails_found: emailSummaries.length,
        drive_files_found: driveFiles.length,
      },
    }, { status: 500 })
  }
}
