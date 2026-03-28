'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useParams } from 'next/navigation'

interface Page {
  id: string
  prospect_name: string
  company: string
  intro_message: string
}

interface Block {
  id: string
  title: string
  url: string
}

export default function PreviewPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [page, setPage] = useState<Page | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPage() {
      try {
        const { data: pageData, error: pageError } = await supabaseBrowser
          .from('pages')
          .select('id, prospect_name, company, intro_message')
          .eq('slug', slug)
          .single()

        if (pageError || !pageData) {
          setError('Page not found')
          setLoading(false)
          return
        }

        setPage(pageData)

        const { data: blocksData } = await supabaseBrowser
          .from('page_blocks')
          .select('id, title, url')
          .eq('page_id', pageData.id)
          .order('position', { ascending: true })

        if (blocksData) {
          setBlocks(blocksData)
        }

        setLoading(false)
      } catch (e) {
        console.error('[preview] error loading page:', e)
        setError('Failed to load page')
        setLoading(false)
      }
    }

    if (slug) {
      loadPage()
    }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-gray-500">Loading preview...</div>
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      {/* Preview Badge */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
        <p className="text-sm text-amber-800 text-center">
          <span className="font-semibold">Preview Mode</span> — Views are not tracked. Share the regular link to track engagement.
        </p>
      </div>

      {/* Nav */}
      <nav className="bg-white/50 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            kuevo
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Preview</p>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">{page.prospect_name}</h2>
          <p className="text-lg text-gray-600 mt-1">{page.company}</p>
        </div>

        {/* Intro Message */}
        {page.intro_message && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {page.intro_message}
            </div>
          </div>
        )}

        {/* Content Blocks */}
        {blocks.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Resources</h3>
            {blocks.map((block) => (
              <a
                key={block.id}
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 group-hover:text-violet-600 transition">
                      {block.title}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1 truncate">{block.url}</p>
                  </div>
                  <div className="ml-4 text-gray-400 group-hover:text-violet-600 transition">→</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            This is a preview. <a href="/" className="text-violet-600 hover:text-violet-800 underline">Go back</a>
          </p>
        </div>
      </main>
    </div>
  )
}
