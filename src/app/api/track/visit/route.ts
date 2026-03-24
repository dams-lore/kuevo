import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const { page_id, visitor_id } = await req.json()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || ''
  const user_agent = headersList.get('user-agent') || ''
  const referrer = headersList.get('referer') || ''

  const { data, error } = await supabaseAdmin
    .from('visits')
    .insert({ page_id, visitor_id, ip, user_agent, referrer })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ visit_id: data.id })
}
