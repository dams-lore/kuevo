import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface FetchedArticle {
  title: string
  url: string
  source: string
}

// Simple RSS parser
async function parseRSS(rssUrl: string): Promise<FetchedArticle[]> {
  try {
    const res = await fetch(rssUrl, { 
      headers: { 'User-Agent': 'Kuevo/1.0' },
      signal: AbortSignal.timeout(5000)
    })
    
    if (!res.ok) return []
    
    const text = await res.text()
    const articles: FetchedArticle[] = []
    
    // Simple regex-based parsing (production would use XML parser)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    
    while ((match = itemRegex.exec(text)) !== null) {
      const itemContent = match[1]
      
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/.exec(itemContent)
      const linkMatch = /<link[^>]*>([\s\S]*?)<\/link>/.exec(itemContent)
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
        const url = linkMatch[1].replace(/<[^>]*>/g, '').trim()
        
        if (title && url && articles.length < 5) {
          articles.push({ title, url, source: 'rss' })
        }
      }
    }
    
    return articles
  } catch (e) {
    console.error('[fetch-rss] error:', e)
    return []
  }
}

// Fetch from blog/website via HTML scraping
async function fetchBlogArticles(blogUrl: string): Promise<FetchedArticle[]> {
  try {
    const res = await fetch(blogUrl, { 
      headers: { 'User-Agent': 'Kuevo/1.0' },
      signal: AbortSignal.timeout(5000)
    })
    
    if (!res.ok) return []
    
    const html = await res.text()
    const articles: FetchedArticle[] = []
    
    // Look for common blog link patterns
    // This is a simple heuristic - production would use proper HTML parsing
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi
    let match
    let count = 0
    
    while ((match = linkRegex.exec(html)) !== null && count < 5) {
      const url = match[1]
      const title = match[2].trim()
      
      // Filter for likely article links (has text, reasonable length, not navigation)
      if (title.length > 5 && title.length < 150 && 
          !['home', 'about', 'contact', 'menu', 'nav', 'footer'].some(word => title.toLowerCase().includes(word))) {
        
        // Make relative URLs absolute
        let absoluteUrl = url
        if (url.startsWith('/')) {
          const baseUrl = new URL(blogUrl)
          absoluteUrl = `${baseUrl.origin}${url}`
        } else if (!url.startsWith('http')) {
          const baseUrl = new URL(blogUrl)
          absoluteUrl = `${baseUrl.origin}/${url}`
        }
        
        articles.push({ title, url: absoluteUrl, source: 'blog' })
        count++
      }
    }
    
    return articles
  } catch (e) {
    console.error('[fetch-blog] error:', e)
    return []
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch user's configured external sources
    const { data: sources } = await supabase
      .from('external_sources')
      .select('*')
      .eq('user_id', session.user.id)
    
    if (!sources || sources.length === 0) {
      console.log('[fetch-external-sources] no sources configured for user')
      return NextResponse.json({ articles: [] })
    }

    const allArticles: FetchedArticle[] = []

    // Fetch from each source
    for (const source of sources) {
      console.log('[fetch-external-sources] fetching from:', source.url, 'type:', source.source_type)
      
      let articles: FetchedArticle[] = []
      
      if (source.source_type === 'rss') {
        articles = await parseRSS(source.url)
      } else if (source.source_type === 'blog' || source.source_type === 'website') {
        articles = await fetchBlogArticles(source.url)
      }
      
      // Add source title as prefix if available
      if (articles.length > 0 && source.title) {
        articles = articles.map(a => ({ ...a, title: `${source.title} - ${a.title}` }))
      }
      
      allArticles.push(...articles)
      
      // Update last_fetched_at
      await supabase
        .from('external_sources')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', source.id)
    }

    console.log('[fetch-external-sources] fetched', allArticles.length, 'articles from', sources.length, 'sources')
    return NextResponse.json({ articles: allArticles.slice(0, 10) })
  } catch (e) {
    console.error('[fetch-external-sources] error:', e)
    return NextResponse.json({ 
      articles: [], 
      error: e instanceof Error ? e.message : 'Failed to fetch external sources'
    }, { status: 500 })
  }
}
