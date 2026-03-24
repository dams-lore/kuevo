import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect_name, company } = await req.json()

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Write a short, personalized intro message (2-3 sentences, friendly but professional) for a sales follow-up page sent to ${prospect_name} from ${company}. The page contains resources shared after a sales call. No subject line, no greeting — just the body text. Start directly with the value.`
    }]
  })

  const intro = (message.content[0] as { type: string; text: string }).text
  return NextResponse.json({ intro })
}
