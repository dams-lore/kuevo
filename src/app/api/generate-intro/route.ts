import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function detectLanguageFromContent(content: string): string {
  if (!content) return 'English'

  const lower = content.toLowerCase()

  // French indicators
  if (lower.match(/\b(bonjour|cordialement|merci|à|é|è|ê|ù|ç)\b/gi)?.length || 0 > 2) {
    return 'French'
  }

  // Spanish indicators
  if (lower.match(/\b(hola|gracias|señor|señora|estimado|cordialmente)\b/gi)?.length || 0 > 2) {
    return 'Spanish'
  }

  // German indicators
  if (lower.match(/\b(hallo|danke|mein|ihre|grüße|mit)\b/gi)?.length || 0 > 2) {
    return 'German'
  }

  return 'English'
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect_name, company, email_context, free_text_context, transcript_analysis } = await req.json()

  // Detect language from email context if provided, otherwise default to English
  const detectedLanguage = email_context ? detectLanguageFromContent(email_context) : 'English'
  console.log('[generate-intro] detected language:', detectedLanguage)

  // Build free text context if available
  let freeTextPart = ''
  if (free_text_context) {
    freeTextPart = `\nContext from user:\n${free_text_context}`
  }

  // Build transcript context if available
  let transcriptContext = ''
  if (transcript_analysis) {
    const { key_topics, pain_points, interests } = transcript_analysis
    transcriptContext = `

ADDITIONAL CONTEXT FROM MEETING TRANSCRIPT:
- Topics discussed: ${key_topics?.join(', ') || 'none'}
- Pain points mentioned: ${pain_points?.join(', ') || 'none'}
- Interests expressed: ${interests?.join(', ') || 'none'}`
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Generate a 2-line intro message for a sales follow-up page in ${detectedLanguage}:

Line 1: Subject line — short, punchy, like an email subject (max 8 words, no filler)
Line 2: One sentence explaining what's in the page and why it's relevant for them (max 20 words)

Context:
- Name: ${prospect_name}
- Company: ${company}
${email_context ? `- Email context: ${email_context.substring(0, 200)}` : ''}${freeTextPart}${transcriptContext}

Respond ONLY in ${detectedLanguage}. No greetings, no signature, no extra text. Just 2 lines.`
    }]
  })

  const intro = (message.content[0] as { type: string; text: string }).text
  console.log('[generate-intro] generated intro in', detectedLanguage, ':', intro)
  return NextResponse.json({ intro })
}
