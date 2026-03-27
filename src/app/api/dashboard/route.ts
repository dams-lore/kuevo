import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch pages with visit counts and block click counts
  const { data: pages, error } = await supabase
    .from('pages')
    .select(`
      id,
      slug,
      prospect_name,
      company,
      created_at,
      visits(id, created_at, time_spent_seconds, visitor_id),
      page_blocks(
        id,
        title,
        block_events(id, visitor_id)
      )
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute engagement scores
  const pagesWithScores = (pages || []).map(page => {
    const visits = page.visits || []
    const blocks = page.page_blocks || []

    // Engagement scoring
    const hasAnyVisit = visits.length > 0
    const totalTimeSeconds = visits.reduce((sum: number, v: { time_spent_seconds: number }) => sum + (v.time_spent_seconds || 0), 0)
    const timePoints = Math.min(20, Math.floor(totalTimeSeconds / 30))

    // Unique blocks clicked
    const clickedBlockIds = new Set<string>()
    blocks.forEach((block: { id: string; block_events: Array<{ id: string }> }) => {
      if ((block.block_events || []).length > 0) {
        clickedBlockIds.add(block.id)
      }
    })
    const clickPoints = clickedBlockIds.size * 15

    // Return visits (2+ unique visitors)
    const uniqueVisitors = new Set(visits.map((v: { visitor_id: string }) => v.visitor_id)).size
    const returnPoints = uniqueVisitors >= 2 ? 10 : 0

    const openPoints = hasAnyVisit ? 5 : 0
    const score = openPoints + timePoints + clickPoints + returnPoints

    // Last visit
    const sortedVisits = [...visits].sort((a: { created_at: string }, b: { created_at: string }) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const lastVisit = sortedVisits[0]?.created_at || null

    // Average time spent
    const avgTimeSpent = visits.length > 0 ? Math.round(totalTimeSeconds / visits.length) : 0

    return {
      id: page.id,
      slug: page.slug,
      prospect_name: page.prospect_name,
      company: page.company,
      created_at: page.created_at,
      visit_count: visits.length,
      last_visit: lastVisit,
      engagement_score: score,
      avg_time_spent: avgTimeSpent,
      total_time_spent: totalTimeSeconds,
    }
  })

  // Compute aggregate metrics
  const totalPages = pagesWithScores.length
  const totalOpens = pagesWithScores.reduce((sum, p) => sum + p.visit_count, 0)
  const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const activeThisWeek = pagesWithScores.filter(p => new Date(p.created_at) > thisWeek).length
  const avgTimeSpentAll = pagesWithScores.length > 0
    ? Math.round(pagesWithScores.reduce((sum, p) => sum + p.avg_time_spent, 0) / pagesWithScores.length)
    : 0

  return NextResponse.json({
    metrics: {
      total_pages: totalPages,
      total_opens: totalOpens,
      active_this_week: activeThisWeek,
      avg_time_spent: avgTimeSpentAll,
    },
    pages: pagesWithScores,
  })
}
