import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect_name, company, intro_message, blocks } = await req.json()
  const slug = nanoid(10)

  const { data: page, error: pageError } = await supabase
    .from('pages')
    .insert({ user_id: session.user.id, slug, prospect_name, company, intro_message })
    .select()
    .single()

  if (pageError) return NextResponse.json({ error: pageError.message }, { status: 500 })

  if (blocks?.length > 0) {
    const pageBlocks = blocks.map((b: { title: string; url: string }, i: number) => ({
      page_id: page.id,
      title: b.title,
      url: b.url,
      position: i
    }))
    await supabase.from('page_blocks').insert(pageBlocks)
  }

  return NextResponse.json({ slug, url: `https://kuevo.io/p/${slug}` })
}
