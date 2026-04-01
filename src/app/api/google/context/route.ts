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

  // Verify Drive access
  console.log('[google/context] ========== AUTH CHECK ==========')
  console.log('[google/context] user_id:', session.user.id)
  console.log('[google/context] has access_token:', !!integration.access_token)
  console.log('[google/context] has refresh_token:', !!integration.refresh_token)
  console.log('[google/context] prospect_name:', prospect_name)
  console.log('[google/context] company:', company)
  console.log('[google/context] =====================================')

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

  // ── Semantic Analysis with Claude ───────────────────────────────────────────
  // Use Claude to understand the semantic meaning of the emails
  let emailAnalysis: any = {
    topics: [],
    pain_points: [],
    interests: [],
    keywords: [],
  }

  if (emailSummaries.length > 0) {
    try {
      const analysisPrompt = `You are analyzing emails between a sales rep and a prospect at ${company}.
Extract the main topics, needs, pain points, and interests expressed by the prospect.
Return ONLY a JSON object with this exact structure:
{ "topics": [...], "pain_points": [...], "interests": [...], "keywords": [...] }

Keep each array to 3-5 items max. Return ONLY JSON, no other text.

Emails:
${emailSummaries.slice(0, 5).join('\n---\n')}`

      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: analysisPrompt }],
      })

      const raw = (message.content[0] as { type: string; text: string }).text.trim()
      const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      emailAnalysis = JSON.parse(jsonStr)
      console.log('[google/context] semantic analysis:', emailAnalysis)
    } catch (e) {
      console.error('[google/context] semantic analysis error:', e)
      // Fallback: use extracted topics
      emailAnalysis = {
        topics: [...new Set(emailTopics)].slice(0, 5),
        pain_points: [],
        interests: [],
        keywords: [...new Set(emailTopics)].slice(0, 5),
      }
    }
  }

  const uniqueTopics = emailAnalysis.keywords || [...new Set(emailTopics)].slice(0, 5)
  console.log('[google/context] final keywords for drive search:', uniqueTopics)

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

    // Search using email keywords (much better than company name)
    console.log('[google/context] extracted keywords from emails:', uniqueTopics)
    
    // If we have keywords, search for them
    let driveQuery = ''
    if (uniqueTopics.length > 0) {
      // Build query with keywords: (keyword1 OR keyword2 OR keyword3)
      const keywordConditions = uniqueTopics.slice(0, 5).map(k => `name contains '${k}'`).join(' OR ')
      driveQuery = `(${keywordConditions}) and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")${exclusions} ${invoiceExclusions}`
    } else {
      // Fallback: search by company name if no keywords
      driveQuery = `name contains '${company}' and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")${exclusions} ${invoiceExclusions}`
    }
    
    console.log('[google/context] drive search query:', driveQuery)

    try {
      const filesRes = await drive.files.list({
        q: driveQuery,
        fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
        pageSize: 20,
        orderBy: 'modifiedTime desc',
      })
      
      console.log('[google/context] raw drive API response:', JSON.stringify({
        files_count: filesRes.data.files?.length || 0,
        files: filesRes.data.files?.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })) || [],
      }))
      
      const returnedCount = filesRes.data.files?.length || 0
      console.log('[google/context] company name search returned:', returnedCount, 'files')
      if (returnedCount > 0) {
        console.log('[google/context] company search files:', filesRes.data.files?.map(f => ({ name: f.name, modified: f.modifiedTime })))
      }
      allFiles = allFiles.concat(filesRes.data.files || [])
    } catch (e) {
      console.error('[google/context] company fullText search error:', e instanceof Error ? e.message : String(e))
    }

    if (allFiles.length === 0) {
      console.log('[google/context] no drive files found for company:', company, '- user will see empty content message')
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

  // Fetch from external sources (user-configured blogs/RSS)
  let externalArticles: Array<{ title: string; url: string }> = []
  try {
    const { data: sources, error: sourcesError } = await supabase
      .from('external_sources')
      .select('*')
      .eq('user_id', session.user.id)

    console.log('[google/context] external_sources query - found:', sources?.length || 0, 'sources, error:', sourcesError?.message || 'none')
    
    if (sourcesError) {
      console.error('[google/context] external_sources fetch error:', sourcesError)
    }

    if (sources && sources.length > 0) {
      console.log('[google/context] found', sources.length, 'configured external sources')
      
      for (const source of sources) {
        console.log('[google/context] fetching from', source.source_type, ':', source.url)
        
        try {
          const res = await fetch(source.url, { 
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Kuevo/1.0' }
          })
          
          console.log('[google/context] fetched source, status:', res.status, 'url:', source.url)
          
          if (!res.ok) {
            console.warn('[google/context] source returned non-ok status', res.status, ':', source.url)
            continue
          }
          
          const text = await res.text()
          
          // Parse based on source type
          if (source.source_type === 'rss') {
            const itemRegex = /<item>([\s\S]*?)<\/item>/g
            let match
            while ((match = itemRegex.exec(text)) !== null) {
              const itemContent = match[1]
              const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/.exec(itemContent)
              const linkMatch = /<link[^>]*>([\s\S]*?)<\/link>/.exec(itemContent)
              
              if (titleMatch && linkMatch) {
                const title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
                const url = linkMatch[1].replace(/<[^>]*>/g, '').trim()
                
                if (title && url && externalArticles.length < 10) {
                  externalArticles.push({ title, url })
                  console.log('[google/context] extracted RSS article:', title)
                }
              }
            }
          } else if (source.source_type === 'blog' || source.source_type === 'website') {
            // Simple HTML link extraction
            const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi
            let match
            let count = 0
            
            while ((match = linkRegex.exec(text)) !== null && count < 5) {
              const url = match[1]
              const title = match[2].trim()
              
              if (title.length > 5 && title.length < 150 && 
                  !['home', 'about', 'contact', 'menu', 'nav'].some(w => title.toLowerCase().includes(w))) {
                
                let absoluteUrl = url
                if (url.startsWith('/')) {
                  const baseUrl = new URL(source.url)
                  absoluteUrl = `${baseUrl.origin}${url}`
                } else if (!url.startsWith('http')) {
                  const baseUrl = new URL(source.url)
                  absoluteUrl = `${baseUrl.origin}/${url}`
                }
                
                if (externalArticles.length < 10) {
                  externalArticles.push({ title, url: absoluteUrl })
                  console.log('[google/context] extracted blog article:', title)
                  count++
                }
              }
            }
          }
        } catch (e) {
          console.warn('[google/context] failed to fetch from', source.url, ':', e)
        }
      }
    }
    
    console.log('[google/context] total external articles extracted:', externalArticles.length)
  } catch (e) {
    console.error('[google/context] external sources error:', e)
  }

  // Combine Drive files and external articles
  const allContent = [
    ...driveFiles.map(f => ({ title: f.name, url: f.webViewLink, type: 'drive' })),
    ...externalArticles.map(a => ({ title: a.title, url: a.url, type: 'external' }))
  ]

  const driveContext = allContent.length > 0
    ? allContent.map(c => `- ${c.title} (${c.url})`).join('\n')
    : 'No relevant content found.'

  // Log content summary before Claude
  console.log('[google/context] ========== CONTENT SUMMARY ==========')
  console.log('[google/context] drive files found:', driveFiles.length)
  console.log('[google/context] external articles found:', externalArticles.length)
  console.log('[google/context] total content sources:', driveFiles.length + externalArticles.length)
  console.log('[google/context] email threads analyzed:', emailSummaries.length)
  console.log('[google/context] =====================================')

  const emailSubjectsStr = emailSummaries.slice(0, 3).join(' | ') || 'No emails found'
  const detectedLanguage = detectLanguage(emailSummaries)
  console.log('[google/context] detected language:', detectedLanguage)

  const prompt = `Generate a 2-line intro message for a sales follow-up page:

Line 1: A punchy subject line (max 8 words, no filler words like "I hope", "please find", "following our")
Line 2: One sentence explaining what's in the page and why it's relevant for them (max 20 words)

Context about the contact:
- Name: ${prospect_name}
- Company: ${company}
- Recent email subjects: ${emailSubjectsStr}
- Detected language: ${detectedLanguage}

Available content (real sources only):
${driveContext}

CRITICAL: You MUST suggest ONLY the files/articles listed above. Do NOT invent or hallucinate any content.
Respond ONLY in ${detectedLanguage}. No greetings, no signature, no extra text. Just 2 lines.
Suggest up to 3 relevant items from the available content list that match the topics discussed.

Respond ONLY with valid JSON, no markdown:
{
  "intro": "Line 1\\nLine 2",
  "suggested_blocks": [
    {"title": "Exact title from available content", "url": "Exact URL from available content"},
    {"title": "Exact title from available content", "url": "Exact URL from available content"}
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

    // ANTI-HALLUCINATION: Validate suggested blocks are from available content
    if (result.suggested_blocks && Array.isArray(result.suggested_blocks)) {
      const availableUrls = new Set(allContent.map(c => c.url))
      
      result.suggested_blocks = result.suggested_blocks.filter((block: any) => {
        const isReal = availableUrls.has(block.url)
        if (!isReal) {
          console.warn('[google/context] BLOCKED hallucinated content:', block)
        }
        return isReal
      })
      
      console.log('[google/context] filtered to', result.suggested_blocks.length, 'verified blocks')
    }

    // Validate shape
    if (!result.intro || typeof result.intro !== 'string') {
      throw new Error('Missing intro in Claude response')
    }

    const filtered = Array.isArray(result.suggested_blocks)
      ? result.suggested_blocks.filter((b: { title?: string; url?: string }) => b.title && b.url)
      : []
    console.log('[google/context] claude suggested_blocks:', result.suggested_blocks)
    console.log('[google/context] after filtering:', filtered)
    
    const noContentMessage = driveFiles.length === 0 && externalArticles.length === 0
      ? 'No content found for this contact. Add links manually or configure your content sources in Settings.'
      : undefined

    return NextResponse.json({
      intro: result.intro,
      suggested_blocks: filtered,
      email_subjects: emailSubjectsStr,
      detected_language: detectedLanguage,
      message: noContentMessage,
      extracted_keywords: uniqueTopics,
      email_analysis: emailAnalysis,
      debug: {
        emails_found: emailSummaries.length,
        email_topics_extracted: uniqueTopics.length,
        external_sources_found: externalArticles.length,
        drive_files_found: driveFiles.length,
        total_content_sources: driveFiles.length + externalArticles.length,
        drive_files_returned_to_claude: driveFiles.map(f => ({ name: f.name, url: f.webViewLink })),
        external_articles_returned: externalArticles.slice(0, 3).map(a => ({ title: a.title, url: a.url })),
        domains_searched: domains,
        has_access_token: !!integration.access_token,
        prospect_name: prospect_name,
        company: company,
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
