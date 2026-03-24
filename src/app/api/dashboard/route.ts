import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
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

    return {
      id: page.id,
      slug: page.slug,
      prospect_name: page.prospect_name,
      company: page.company,
      created_at: page.created_at,
      visit_count: visits.length,
      last_visit: lastVisit,
      engagement_score: score,
    }
  })

  return NextResponse.json({ pages: pagesWithScores })
}
