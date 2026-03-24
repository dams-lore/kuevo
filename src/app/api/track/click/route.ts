import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { page_id, block_id, visitor_id } = await req.json()

  const { error } = await supabaseAdmin
    .from('block_events')
    .insert({ page_id, block_id, visitor_id, event_type: 'click' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
