import { NextResponse } from 'next/server'

interface Article {
  title: string
  url: string
  published?: string
}

async function fetchBlogArticles(blogUrl: string): Promise<Article[]> {
  const articles: Article[] = []

  try {
    const baseDomain = new URL(blogUrl).origin

    // Try RSS feed first
    try {
      console.log('[blog/articles] trying RSS feed at', `${baseDomain}/feed.xml`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const rssRes = await fetch(`${baseDomain}/feed.xml`, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (rssRes.ok) {
        const rssText = await rssRes.text()
        // Simple XML parsing for RSS items
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || []
        for (const item of itemMatches.slice(0, 5)) {
          const titleMatch = item.match(/<title>([^<]+)<\/title>/)
          const linkMatch = item.match(/<link>([^<]+)<\/link>/)
          const pubMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/)
          
          if (titleMatch && linkMatch) {
            articles.push({
              title: titleMatch[1].trim(),
              url: linkMatch[1].trim(),
              published: pubMatch?.[1],
            })
          }
        }
        if (articles.length > 0) {
          console.log('[blog/articles] found', articles.length, 'articles via RSS')
          return articles
        }
      }
    } catch (e) {
      console.log('[blog/articles] RSS feed not found, trying sitemap...')
    }

    // Try sitemap
    try {
      console.log('[blog/articles] trying sitemap at', `${baseDomain}/sitemap.xml`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const sitemapRes = await fetch(`${baseDomain}/sitemap.xml`, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (sitemapRes.ok) {
        const sitemapText = await sitemapRes.text()
        // Parse sitemap URLs
        const urlMatches = sitemapText.match(/<loc>([^<]+)<\/loc>/g) || []
        const urls = urlMatches
          .map(m => m.replace(/<\/?loc>/g, ''))
          .filter(url => url.includes('/blog') || url.includes('/post') || url.includes('/article'))
          .slice(0, 5)

        for (const url of urls) {
          articles.push({
            title: new URL(url).pathname.split('/').pop()?.replace(/[-_]/g, ' ') || url,
            url,
          })
        }

        if (articles.length > 0) {
          console.log('[blog/articles] found', articles.length, 'articles via sitemap')
          return articles
        }
      }
    } catch (e) {
      console.log('[blog/articles] sitemap not found')
    }

    // Fallback: try common RSS paths
    const commonRssPaths = ['/rss.xml', '/rss', '/blog/feed', '/blog/rss.xml', '/index.xml']
    for (const path of commonRssPaths) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`${baseDomain}${path}`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          const text = await res.text()
          const itemMatches = text.match(/<item>[\s\S]*?<\/item>/g) || []
          for (const item of itemMatches.slice(0, 5)) {
            const titleMatch = item.match(/<title>([^<]+)<\/title>/)
            const linkMatch = item.match(/<link>([^<]+)<\/link>/)
            if (titleMatch && linkMatch) {
              articles.push({
                title: titleMatch[1].trim(),
                url: linkMatch[1].trim(),
              })
            }
          }
          if (articles.length > 0) {
            console.log('[blog/articles] found', articles.length, 'articles via', path)
            return articles
          }
        }
      } catch (e) {
        // Continue to next path
      }
    }
  } catch (e) {
    console.error('[blog/articles] error fetching blog:', e)
  }

  return articles
}

export async function POST(req: Request) {
  const { blog_url } = await req.json()

  if (!blog_url) {
    return NextResponse.json({ error: 'blog_url is required' }, { status: 400 })
  }

  try {
    const articles = await fetchBlogArticles(blog_url)

    if (articles.length === 0) {
      return NextResponse.json({
        error: 'No blog articles found. Try a blog with an RSS feed or sitemap.',
        articles: [],
      })
    }

    // Sort by published date if available, cap at 3
    const sorted = articles
      .sort((a, b) => {
        if (!a.published || !b.published) return 0
        return new Date(b.published).getTime() - new Date(a.published).getTime()
      })
      .slice(0, 3)

    return NextResponse.json({ articles: sorted })
  } catch (e) {
    console.error('[blog/articles] error:', e)
    return NextResponse.json({
      error: 'Failed to fetch blog articles',
      articles: [],
    }, { status: 500 })
  }
}
