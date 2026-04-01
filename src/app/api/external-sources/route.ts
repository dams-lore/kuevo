import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('external_sources')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[external-sources] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sources: data || [] })
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('[external-sources POST] auth error:', userError?.message || 'no user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { source_type, url, title } = body

  if (!source_type || !url) {
    return NextResponse.json({ error: 'source_type and url are required' }, { status: 400 })
  }

  // Validate URL
  try {
    new URL(url)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  console.log('[external-sources POST] user_id:', user.id, 'body:', body)
  console.log('[external-sources POST] inserting source for user:', user.id, 'source_type:', source_type, 'url:', url)

  const { data, error } = await supabase
    .from('external_sources')
    .insert({
      user_id: user.id,
      source_type,
      url,
      title: title || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[external-sources POST] insert error:', error.message, 'code:', error.code)
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }

  console.log('[external-sources POST] insert success - id:', data?.id, 'user_id:', data?.user_id)
  return NextResponse.json({ source: data })
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('id')

  if (!sourceId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('external_sources')
    .delete()
    .eq('id', sourceId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[external-sources] delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
