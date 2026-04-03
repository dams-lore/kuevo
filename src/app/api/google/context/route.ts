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

// Auto-discover RSS feed URL from a blog URL
async function discoverRSSFeed(baseUrl: string): Promise<string | null> {
  const feedPaths = [
    '/feed.xml',
    '/feed',
    '/rss.xml',
    '/rss',
    '/blog/feed',
    '/index.xml',
  ]

  // Try common feed paths first
  for (const path of feedPaths) {
    try {
      const feedUrl = baseUrl.replace(/\/$/, '') + path
      const res = await fetch(feedUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      })

      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('rss') || contentType.includes('xml')) {
          console.log('[rss-discovery] found feed at:', feedUrl)
          return feedUrl
        }
      }
    } catch (e) {
      // Continue to next path
    }
  }

  // If no common paths found, fetch the HTML and look for RSS link
  try {
    const res = await fetch(baseUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Kuevo/1.0' },
    })

    if (!res.ok) return null

    const html = await res.text()

    // Look for RSS link in HTML head
    const rssLinkMatch = html.match(
      /<link[^>]*rel=["']alternate["'][^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i
    )

    if (rssLinkMatch && rssLinkMatch[1]) {
      let feedUrl = rssLinkMatch[1]
      // Convert relative URLs to absolute
      if (feedUrl.startsWith('/')) {
        const baseUrlObj = new URL(baseUrl)
        feedUrl = `${baseUrlObj.origin}${feedUrl}`
      } else if (!feedUrl.startsWith('http')) {
        feedUrl = baseUrl.replace(/\/$/, '') + '/' + feedUrl
      }
      console.log('[rss-discovery] found RSS link in HTML:', feedUrl)
      return feedUrl
    }
  } catch (e) {
    console.warn('[rss-discovery] failed to fetch or parse HTML:', e instanceof Error ? e.message : String(e))
  }

  return null
}

// Parse sitemap and extract article URLs
async function parseSitemap(baseUrl: string): Promise<Array<{ title: string; url: string }>> {
  const articles: Array<{ title: string; url: string }> = []
  
  try {
    const sitemapUrl = baseUrl.replace(/\/$/, '') + '/sitemap.xml'
    console.log('[sitemap] trying:', sitemapUrl)
    
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Kuevo/1.0' }
    })
    
    if (!res.ok) {
      console.log('[sitemap] not found (status:', res.status + ')')
      return articles
    }
    
    const text = await res.text()
    const locRegex = /<loc>([\s\S]*?)<\/loc>/g
    let match
    let count = 0
    
    while ((match = locRegex.exec(text)) !== null && count < 2) {
      const url = match[1].trim()
      
      // Only include blog/resource URLs, skip homepage
      if ((url.includes('/blog/') || url.includes('/ressources/') || url.includes('/resources/')) && 
          !url.endsWith('/')) {
        const title = new URL(url).pathname.split('/').filter(Boolean).pop() || 'Article'
        articles.push({ title, url })
        count++
        console.log('[sitemap] extracted:', title)
      }
    }
    
    if (articles.length > 0) {
      console.log('[sitemap] found', articles.length, 'articles')
    } else {
      console.log('[sitemap] no blog/resource articles found')
    }
  } catch (e) {
    console.warn('[sitemap] error:', e instanceof Error ? e.message : String(e))
  }
  
  return articles
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
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
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
    .eq('user_id', userId)
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
  console.log('[google/context] user_id:', userId)
  console.log('[google/context] has access_token:', !!integration.access_token)
  console.log('[google/context] has refresh_token:', !!integration.refresh_token)
  console.log('[google/context] prospect_name:', prospect_name)
  console.log('[google/context] company:', company)
  console.log('[google/context] =====================================')

  // Refresh token if needed
  await refreshTokenIfNeeded(oauth2Client, integration, supabase, userId)

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

    // Search Drive using email keywords with fullText (semantic search)
    console.log('[google/context] searching drive with keywords:', uniqueTopics)
    
    // Search for each keyword individually and merge results
    const fileMap = new Map<string, any>() // Use Map to deduplicate by file ID

    if (uniqueTopics.length > 0) {
      for (const keyword of uniqueTopics.slice(0, 5)) {
        try {
          const keywordQuery = `fullText contains '${keyword}' and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")${exclusions} ${invoiceExclusions}`
          console.log('[drive] search query:', keywordQuery)
          
          try {
            const filesRes = await drive.files.list({
              q: keywordQuery,
              fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
              pageSize: 10,
              orderBy: 'modifiedTime desc',
            })
            
            const count = filesRes.data.files?.length || 0
            console.log('[drive] results:', count, 'files for keyword:', keyword)
            if (count === 0) {
              console.log('[drive] no results - trying simpler query with name contains instead')
              // Fallback: try simpler name contains query
              const simpleQuery = `name contains '${keyword}' and trashed = false and (mimeType="application/vnd.google-apps.document" OR mimeType="application/vnd.google-apps.presentation" OR mimeType="application/pdf")${exclusions}`
              console.log('[drive] fallback query:', simpleQuery)
              const simpleRes = await drive.files.list({
                q: simpleQuery,
                fields: 'files(id, name, webViewLink, mimeType, modifiedTime)',
                pageSize: 10,
              })
              const simpleCount = simpleRes.data.files?.length || 0
              console.log('[drive] fallback results:', simpleCount, 'files')
              simpleRes.data.files?.forEach((f: any) => {
                if (!fileMap.has(f.id!)) {
                  fileMap.set(f.id!, f)
                }
              })
            }
            
            filesRes.data.files?.forEach((f: any) => {
              if (!fileMap.has(f.id!)) {
                fileMap.set(f.id!, f)
              }
            })
          } catch (driveError) {
            console.error('[drive] API error for keyword', keyword, ':', driveError instanceof Error ? driveError.message : String(driveError))
          }
        } catch (e) {
          console.error('[google/context] keyword search error for', keyword, ':', e instanceof Error ? e.message : String(e))
        }
      }
    } else {
      // No keywords extracted - can't search Drive reliably
      console.log('[google/context] no keywords extracted - skipping drive search')
    }

    // Convert map to array and sort by modification time
    allFiles = Array.from(fileMap.values()).sort((a, b) => {
      const aTime = new Date(a.modifiedTime || 0).getTime()
      const bTime = new Date(b.modifiedTime || 0).getTime()
      return bTime - aTime
    })

    console.log('[google/context] total unique files found:', allFiles.length)

    // Cap at top 3 most relevant files (already deduplicated and sorted by recency)
    driveFiles = allFiles.slice(0, 3).map(f => {
      console.log('[google/context] selected drive file:', { name: f.name, type: f.mimeType, modified: f.modifiedTime })
      return {
        name: f.name || '',
        webViewLink: f.webViewLink || '',
        mimeType: f.mimeType || '',
      }
    })
    
    console.log('[google/context] final drive files selected:', driveFiles.length)
  } catch (e) {
    console.error('[google/context] drive error:', e instanceof Error ? e.message : String(e))
  }

  // ── Claude ────────────────────────────────────────────────────────────────
  const emailContext = emailSummaries.length > 0
    ? emailSummaries.join('\n\n---\n\n')
    : 'No emails found with this company domain.'

  // Fetch from external sources (user-configured blogs/RSS)
  let externalArticles: Array<{ title: string; url: string; source_date?: string }> = []
  try {
    console.log('[context] external sources query - user_id:', userId, 'type:', typeof userId)
    
    const { data: sources, error: sourcesError } = await supabase
      .from('external_sources')
      .select('*')
      .eq('user_id', userId)

    console.log('[google/context] external_sources result - found:', sources?.length || 0, 'sources')
    if (sourcesError) {
      console.error('[google/context] external_sources error:', sourcesError.message, 'code:', sourcesError.code)
    }
    if (sources && sources.length > 0) {
      console.log('[google/context] sources:', JSON.stringify(sources.map(s => ({ id: s.id, user_id: s.user_id, url: s.url }))))
    }
    
    if (sourcesError) {
      console.error('[google/context] external_sources fetch error:', sourcesError)
    }

    if (sources && sources.length > 0) {
      console.log('[google/context] found', sources.length, 'configured external sources')
      
      for (const source of sources) {
        console.log('[external] processing source - type:', source.source_type, 'url:', source.url)
        
        try {
          let feedUrl: string | null = null

          // Step 1: Try common RSS feed paths first
          const feedPaths = ['/feed.xml', '/feed', '/rss.xml', '/rss', '/blog/feed', '/index.xml']
          const baseUrl = source.url.replace(/\/$/, '')
          
          for (const path of feedPaths) {
            try {
              const testUrl = baseUrl + path
              const headRes = await fetch(testUrl, { 
                method: 'HEAD',
                signal: AbortSignal.timeout(2000)
              })
              
              if (headRes.ok) {
                console.log('[rss-discovery] found feed at:', testUrl)
                feedUrl = testUrl
                break
              }
            } catch (e) {
              // Continue to next path
            }
          }

          // Step 2: If no common path found, fetch HTML and look for RSS link
          if (!feedUrl) {
            try {
              console.log('[rss-discovery] trying HTML meta tag discovery for:', source.url)
              const htmlRes = await fetch(source.url, {
                signal: AbortSignal.timeout(5000),
                headers: { 'User-Agent': 'Kuevo/1.0' }
              })
              
              if (htmlRes.ok) {
                const html = await htmlRes.text()
                const rssMatch = html.match(/<link[^>]*rel=["']alternate["'][^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i)
                
                if (rssMatch && rssMatch[1]) {
                  let discoveredUrl = rssMatch[1]
                  // Convert relative to absolute
                  if (discoveredUrl.startsWith('/')) {
                    discoveredUrl = baseUrl + discoveredUrl
                  } else if (!discoveredUrl.startsWith('http')) {
                    discoveredUrl = baseUrl + '/' + discoveredUrl
                  }
                  console.log('[rss-discovery] found RSS link in HTML:', discoveredUrl)
                  feedUrl = discoveredUrl
                }
              }
            } catch (e) {
              console.warn('[rss-discovery] HTML discovery failed:', e instanceof Error ? e.message : String(e))
            }
          }

          // Step 3: If still no feed found, skip this source
          if (!feedUrl) {
            console.log('[rss-discovery] no RSS feed found for:', source.url)
            continue
          }

          // Fetch the discovered RSS feed
          const res = await fetch(feedUrl, { 
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Kuevo/1.0' }
          })
          
          console.log('[external] fetched feed status:', res.status, 'content length:', res.headers.get('content-length'))
          
          if (!res.ok) {
            console.warn('[external] failed with status:', res.status)
            continue
          }
          
          const text = await res.text()
          console.log('[external] response length:', text.length, 'bytes')
          
          // Parse RSS feed for articles only
          if (text.includes('<item>')) {
            console.log('[external] parsing RSS feed')
            const itemRegex = /<item>([\s\S]*?)<\/item>/g
            let match
            while ((match = itemRegex.exec(text)) !== null && externalArticles.length < 10) {
              const itemContent = match[1]
              
              // Extract title
              const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/.exec(itemContent)
              const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : null
              
              // Extract URL (try link first, then guid)
              let url = null
              const linkMatch = /<link[^>]*>([\s\S]*?)<\/link>/.exec(itemContent)
              if (linkMatch) {
                url = linkMatch[1].replace(/<[^>]*>/g, '').trim()
              } else {
                const guidMatch = /<guid[^>]*>([\s\S]*?)<\/guid>/.exec(itemContent)
                if (guidMatch) {
                  url = guidMatch[1].replace(/<[^>]*>/g, '').trim()
                }
              }
              
              // Extract publish date
              let source_date: string | undefined
              const pubDateMatch = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/.exec(itemContent)
              if (pubDateMatch) {
                try {
                  source_date = new Date(pubDateMatch[1].trim()).toISOString()
                } catch (e) {
                  // If date parsing fails, use current date
                  source_date = undefined
                }
              }
              
              // Only add if both title and URL exist and URL is not the homepage
              if (title && url && url.length > 10 && !url.endsWith(source.url.replace(/\/$/, ''))) {
                externalArticles.push({ title, url, source_date })
                console.log('[google/context] extracted RSS article:', title, 'date:', source_date)
              }
            }
          } else {
            // No RSS items found - try sitemap as fallback
            console.log('[external] no RSS items found, trying sitemap fallback')
            const sitemapArticles = await parseSitemap(source.url)
            
            if (sitemapArticles.length > 0) {
              console.log('[external] found', sitemapArticles.length, 'articles from sitemap')
              sitemapArticles.forEach(article => {
                externalArticles.push({ title: article.title, url: article.url })
                console.log('[external] added sitemap article:', article.title)
              })
            }
          }
        } catch (e) {
          console.warn('[google/context] failed to fetch from', source.url, ':', e instanceof Error ? e.message : String(e))
        }
      }
    }
    
    console.log('[google/context] total external articles extracted:', externalArticles.length)
  } catch (e) {
    console.error('[google/context] external sources error:', e)
  }

  // Cap external articles at 2 (Drive already capped at 3)
  const topExternalArticles = externalArticles.slice(0, 2)

  // Combine and sort all content by date (most recent first)
  // Note: Drive files don't have explicit dates from the API response in this version,
  // but we include them for future enhancement. External articles get source_date.
  const allContent = [
    ...driveFiles.map(f => ({ 
      title: f.name, 
      url: f.webViewLink, 
      type: 'drive' as const,
      source_date: undefined // Drive files don't have date in current API response
    })),
    ...topExternalArticles.map(a => ({ 
      title: a.title, 
      url: a.url, 
      type: 'external' as const,
      source_date: a.source_date 
    }))
  ]

  // Sort by date (most recent first), items without dates go to end
  const sortedContent = allContent.sort((a, b) => {
    // Items with dates
    if (a.source_date && b.source_date) {
      return new Date(b.source_date).getTime() - new Date(a.source_date).getTime()
    }
    // Items without dates go to end
    if (!a.source_date && !b.source_date) return 0
    if (!a.source_date) return 1
    if (!b.source_date) return -1
    return 0
  })

  // Cap at 5 total items (Drive + external combined)
  const topContent = sortedContent.slice(0, 5)

  const driveContext = topContent.length > 0
    ? topContent.map(c => `- ${c.title} (${c.url})`).join('\n')
    : 'No relevant content found. Add links manually or configure your sources in Settings.'

  // Log content summary before Claude
  console.log('[google/context] ========== CONTENT SUMMARY ==========')
  console.log('[google/context] drive files (max 3):', driveFiles.length)
  console.log('[google/context] external articles (max 2):', topExternalArticles.length)
  console.log('[google/context] total before sorting:', allContent.length)
  console.log('[google/context] total after sorting & cap to 5:', topContent.length)
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
