import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { visit_id, seconds } = await req.json()

  const { error } = await supabaseAdmin
    .from('visits')
    .update({ time_spent_seconds: seconds })
    .eq('id', visit_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
