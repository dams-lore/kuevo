import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Debug endpoint to check external_sources table
 * Shows: user_id, number of sources, what's in each source
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userId = session.user.id

  // Check external_sources table
  const { data: sources, error: sourcesError } = await supabase
    .from('external_sources')
    .select('*')
    .eq('user_id', userId)

  if (sourcesError) {
    return NextResponse.json({
      user_id: userId,
      sources_error: sourcesError.message,
    }, { status: 500 })
  }

  return NextResponse.json({
    user_id: userId,
    sources_count: sources?.length || 0,
    sources: sources?.map(s => ({
      id: s.id,
      source_type: s.source_type,
      url: s.url,
      title: s.title,
      created_at: s.created_at,
    })) || [],
    note: sources && sources.length === 0 
      ? 'No sources configured. Add one in /settings under "External Content Sources"' 
      : 'Sources found above',
  })
}
