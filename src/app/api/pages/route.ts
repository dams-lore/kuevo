import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('[api/pages] no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[api/pages] creating page for user:', session.user.id)
    const body = await req.json()
    const { prospect_name, company, prospect_email, intro_message, blocks } = body
    
    console.log('[api/pages] request body:', { prospect_name, company, prospect_email, intro_message, blocks: blocks?.length || 0 })

    if (!prospect_name || !company) {
      console.error('[api/pages] missing required fields: prospect_name or company')
      return NextResponse.json({ error: 'Missing required fields: prospect_name, company' }, { status: 400 })
    }

    const slug = nanoid(10)
    console.log('[api/pages] generated slug:', slug)

    const { data: page, error: pageError } = await supabase
      .from('pages')
      .insert({ 
        user_id: session.user.id, 
        slug, 
        prospect_name, 
        company, 
        prospect_email: prospect_email || null, 
        intro_message 
      })
      .select()
      .single()

    if (pageError) {
      console.error('[api/pages] insert error:', pageError)
      return NextResponse.json({ error: pageError.message }, { status: 500 })
    }

    console.log('[api/pages] page created:', page.id)

    if (blocks?.length > 0) {
      console.log('[api/pages] inserting', blocks.length, 'blocks')
      const pageBlocks = blocks.map((b: { title: string; url: string }, i: number) => ({
        page_id: page.id,
        title: b.title,
        url: b.url,
        position: i
      }))
      const { error: blocksError } = await supabase.from('page_blocks').insert(pageBlocks)
      if (blocksError) {
        console.error('[api/pages] blocks insert error:', blocksError)
      } else {
        console.log('[api/pages] blocks inserted successfully')
      }
    }

    console.log('[api/pages] returning slug:', slug)
    return NextResponse.json({ slug, url: `https://kuevo.io/p/${slug}` })
  } catch (e) {
    console.error('[api/pages] unexpected error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
