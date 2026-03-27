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

// Detect language from email subjects/snippets
function detectLanguage(emailSummaries: string[]): string {
  if (emailSummaries.length === 0) return 'English'

  // Simple heuristic: check for common non-English patterns
  const combined = emailSummaries.join(' ').toLowerCase()

  // French indicators
  if (combined.match(/\b(bonjour|cordialement|merci|à|é|è|ê|ù|ç)\b/gi)?.length || 0 > 3) {
    return 'French'
  }

  // Spanish indicators
  if (combined.match(/\b(hola|gracias|señor|señora|estimado|cordialmente|español)\b/gi)?.length || 0 > 3) {
    return 'Spanish'
  }

  // German indicators
  if (combined.match(/\b(hallo|danke|mein|ihre|grüße|mit|freundlichen)\b/gi)?.length || 0 > 3) {
    return 'German'
  }

  // Default to English
  return 'English'
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

  // Always exclude invoices and financial data by default
  const exclude_invoices = true
  const exclude_financial = true
  console.log('[google/context] always excluding invoices and financial data')

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
  const emailTopics: string[] = [] // Extract keywords/topics for Drive search

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
        
        // Extract topics from subject (remove "Re:", "Fwd:", etc.)
        const cleanSubject = subject
          .replace(/^(Re|Fwd|FW|Re-Fwd):\s*/gi, '')
          .replace(/\[.*?\]/g, '') // Remove bracketed text
          .trim()
        
        // Extract keywords (words > 3 chars, not common words)
        const commonWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'will', 'your', 'about', 'our', 'new', 'can', 'but', 'just', 'more'])
        const keywords = cleanSubject
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3 && !commonWords.has(w) && /^[a-z0-9]+$/.test(w))
        
        emailTopics.push(...keywords)
      } catch (e) {
        console.error('[google/context] error fetching message:', e)
      }
    }
  } catch (e) {
    console.error('[google/context] gmail list error:', e)
  }

  const uniqueTopics = [...new Set(emailTopics)].slice(0, 5) // Top 5 unique topics
  console.log('[google/context] extracted topics:', uniqueTopics)

  // ── Drive ────────────────────────────────────────────────────────────────
  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  type DriveFile = { name: string; webViewLink: string; mimeType: string }
  let driveFiles: DriveFile[] = []

  try {
    // Build exclusion filters
    let exclusions = ''
    if (exclude_invoices) {
      exclusions += ' and not name contains "invoice" and not name contains "receipt"'
    }
    if (exclude_financial) {
      exclusions += ' and not name contains "financial" and not name contains "budget" and not name contains "p&l" and not name contains "expense"'
    }

    let allFiles: any[] = []

    // Invoice/payroll/contract exclusion keywords (case insensitive via Drive API)
    const invoiceKeywords = ['facture', 'invoice', 'payroll', 'salary', 'contrat', 'paie', 'bulletin']
    const invoiceExclusions = invoiceKeywords
      .map(k => `and not name contains "${k}"`)
      .join(' ')

    // Search by email topics first (most relevant)
    for (const topic of uniqueTopics) {
      if (topic) {
        const topicQuery = `name contains '${topic}' and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")${exclusions} ${invoiceExclusions}`
        console.log('[google/context] drive topic query:', topicQuery)
        
        try {
          const topicRes = await drive.files.list({
            q: topicQuery,
            fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
            pageSize: 10,
            orderBy: 'modifiedTime desc',
          })
          allFiles = allFiles.concat(topicRes.data.files || [])
        } catch (e) {
          console.error('[google/context] topic search error:', e)
        }
      }
    }

    console.log('[google/context] drive files found with email topics:', allFiles.length)

    // If not enough results from topics, search by company name
    if (allFiles.length < 3) {
      const companyQuery = `name contains '${company}' and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")${exclusions} ${invoiceExclusions}`
      console.log('[google/context] fallback company search:', companyQuery)

      const filesRes = await drive.files.list({
        q: companyQuery,
        fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
        pageSize: 50,
        orderBy: 'modifiedTime desc',
      })
      allFiles = allFiles.concat(filesRes.data.files || [])
      console.log('[google/context] drive files found with company name:', filesRes.data.files?.length || 0)
    }

    // If not enough results, do a broader search for recently modified files (NO SPREADSHEETS - security risk)
    if (allFiles.length < 3) {
      console.log('[google/context] fallback: searching for 5 most recent files (docs, presentations, pdfs only)')
      const fallbackRes = await drive.files.list({
        q: `trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")${exclusions}`,
        fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
        pageSize: 5,
        orderBy: 'modifiedTime desc',
      })
      allFiles = allFiles.concat(fallbackRes.data.files || [])
    }

    console.log('[google/context] total files after fallback:', allFiles.length)

    // Remove duplicates and sort by modification time (most recent first)
    const uniqueFiles = Array.from(
      new Map(allFiles.map(f => [f.id, f])).values()
    ).sort((a, b) => {
      const aTime = new Date(a.modifiedTime || 0).getTime()
      const bTime = new Date(b.modifiedTime || 0).getTime()
      return bTime - aTime
    })

    // CAP AT 3 FILES - ALWAYS RETURN UP TO 3, EVEN IF LOW RELEVANCE
    driveFiles = uniqueFiles.slice(0, 3).map(f => {
      console.log('[google/context] selected drive file:', { name: f.name, type: f.mimeType, modified: f.modifiedTime })
      return {
        name: f.name || '',
        webViewLink: f.webViewLink || '',
        mimeType: f.mimeType || '',
      }
    })
    
    console.log('[google/context] final drive files:', driveFiles.length)
  } catch (e) {
    console.error('[google/context] drive error:', e instanceof Error ? e.message : String(e))
  }

  // ── Claude ────────────────────────────────────────────────────────────────
  const emailContext = emailSummaries.length > 0
    ? emailSummaries.join('\n\n---\n\n')
    : 'No emails found with this company domain.'

  const driveContext = driveFiles.length > 0
    ? driveFiles.map(f => `- ${f.name} (${f.webViewLink})`).join('\n')
    : 'No relevant Drive files found.'

  const topicsStr = uniqueTopics.length > 0 ? `Topics discussed: ${uniqueTopics.join(', ')}` : 'No specific topics extracted'
  const detectedLanguage = detectLanguage(emailSummaries)
  console.log('[google/context] detected language:', detectedLanguage)

  const prompt = `You are a sales follow-up expert helping prepare a personalized sharing page.
IMPORTANT: Respond in ${detectedLanguage}. The emails below are in ${detectedLanguage}.

PROSPECT: ${prospect_name} at ${company}

EMAIL CONTEXT:
${emailContext}

KEY TOPICS FROM EMAILS: ${topicsStr}

AVAILABLE FILES:
${driveContext}

TASK: Generate a professional yet personal intro message for a follow-up page, plus suggest the most relevant files based on the email topics discussed.

INTRO MESSAGE FORMAT (exactly 4 sentences max):
1. Personalized opener mentioning the prospect/company and referencing a specific topic from emails
2. Clear statement of what's being shared and why it's relevant to their needs
3. Brief value statement connecting to email topics
4. Soft CTA (e.g., "Feel free to review at your pace")

RULES:
- Max 4 sentences total
- Professional but warm tone
- MUST reference at least one specific topic from the email context above
- MUST reference specific file names that match the topics discussed
- Never generic — always hyper-personalized based on actual email content
- Only suggest files with valid URLs (webViewLink)
- Prioritize files whose names match the topics discussed in emails

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

    const filtered = Array.isArray(result.suggested_blocks)
      ? result.suggested_blocks.filter((b: { title?: string; url?: string }) => b.title && b.url)
      : []
    console.log('[google/context] claude suggested_blocks:', result.suggested_blocks)
    console.log('[google/context] after filtering:', filtered)
    
    return NextResponse.json({
      intro: result.intro,
      suggested_blocks: filtered,
      debug: {
        emails_found: emailSummaries.length,
        drive_files_found: driveFiles.length,
        drive_files_returned_to_claude: driveFiles.map(f => ({ name: f.name, url: f.webViewLink })),
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
