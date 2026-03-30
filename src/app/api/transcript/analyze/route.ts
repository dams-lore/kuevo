import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file content
    const fileContent = await file.text()

    if (!fileContent || fileContent.trim().length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // Send to Claude for analysis
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Analyze this meeting transcript and extract the following in JSON format:
1. key_topics: array of main topics discussed (up to 5, as strings)
2. pain_points: array of prospect's pain points or challenges mentioned (up to 4, as strings)
3. interests: array of prospect's expressed interests or goals (up to 4, as strings)
4. action_items: array of action items or next steps mentioned (up to 3, as strings)

Return ONLY valid JSON, no other text.

TRANSCRIPT:
${fileContent}`,
        },
      ],
    })

    const rawResponse = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = rawResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const analysis = JSON.parse(jsonStr)

    return NextResponse.json({
      success: true,
      analysis: {
        key_topics: analysis.key_topics || [],
        pain_points: analysis.pain_points || [],
        interests: analysis.interests || [],
        action_items: analysis.action_items || [],
      },
    })
  } catch (e) {
    console.error('[transcript/analyze] error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
