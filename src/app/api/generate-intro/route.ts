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

  const { prospect_name, company, email_context } = await req.json()

  // Detect language from email context if provided, otherwise default to English
  const detectedLanguage = email_context ? detectLanguageFromContent(email_context) : 'English'
  console.log('[generate-intro] detected language:', detectedLanguage)

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
${email_context ? `- Recent email context: ${email_context}` : ''}

Respond ONLY in ${detectedLanguage}. No greetings, no signature, no extra text. Just 2 lines.`
    }]
  })

  const intro = (message.content[0] as { type: string; text: string }).text
  console.log('[generate-intro] generated intro in', detectedLanguage, ':', intro)
  return NextResponse.json({ intro })
}
