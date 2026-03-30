import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // Check external_sources for this user
    const { data: sources, error: sourcesError } = await supabase
      .from('external_sources')
      .select('*')
      .eq('user_id', session.user.id)

    if (sourcesError) {
      console.error('[test/external-sources-check] query error:', sourcesError)
      return NextResponse.json({
        user_id: session.user.id,
        error: sourcesError.message,
      }, { status: 500 })
    }

    console.log('[test/external-sources-check] found', sources?.length || 0, 'sources for user:', session.user.id)

    return NextResponse.json({
      user_id: session.user.id,
      sources_count: sources?.length || 0,
      sources: sources?.map(s => ({
        id: s.id,
        source_type: s.source_type,
        url: s.url,
        title: s.title,
        created_at: s.created_at,
        user_id: s.user_id,
      })) || [],
      message: sources && sources.length === 0 
        ? 'No external sources configured. Try adding one in /settings'
        : 'Sources found above',
    })
  } catch (e) {
    console.error('[test/external-sources-check] error:', e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Check failed',
      user_id: session.user.id,
    }, { status: 500 })
  }
}
