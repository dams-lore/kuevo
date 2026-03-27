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
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Generate a 2-line intro message for a sales follow-up page:
Line 1: Subject line — short, punchy, like an email subject (max 10 words)
Line 2: One engaging punchline — what's in it for ${prospect_name} at ${company} (max 20 words)

Respond in English. Output ONLY these 2 lines, nothing else.`
    }]
  })

  const intro = (message.content[0] as { type: string; text: string }).text
  return NextResponse.json({ intro })
}
