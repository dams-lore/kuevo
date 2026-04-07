import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import PageTracker from '@/components/PageTracker'
import BlockLink from '@/components/BlockLink'

interface PageBlock {
  id: string
  title: string
  url: string
  position: number
}

interface KuevoPage {
  id: string
  prospect_name: string
  company: string
  intro_message: string | null
  hubspot_contact_id: string | null
  page_blocks: PageBlock[]
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: page, error } = await supabaseAdmin
    .from('pages')
    .select('id, prospect_name, company, intro_message, hubspot_contact_id, page_blocks(id, title, url, position)')
    .eq('slug', slug)
    .single() as { data: KuevoPage | null; error: unknown }

  if (error || !page) {
    notFound()
  }

  const blocks = (page.page_blocks || []).sort((a: PageBlock, b: PageBlock) => a.position - b.position)

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-indigo-900 to-slate-900">
      <PageTracker pageId={page.id} hubspotContactId={page.hubspot_contact_id || undefined} pageName={page.prospect_name} />

      {/* Header */}
      <header className="px-6 py-5 flex items-center">
        <a href="https://kuevo.io" className="text-xl font-bold bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">
          kuevo
        </a>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-6 pb-16 pt-8">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">
            Resources for <span className="text-violet-300">{page.prospect_name}</span>
            {' '}at{' '}
            <span className="text-indigo-300">{page.company}</span>
          </h1>

          {page.intro_message && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-6">
              <p className="text-slate-300 leading-relaxed">{page.intro_message}</p>
            </div>
          )}
        </div>

        {/* Content blocks */}
        {blocks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
              Shared resources
            </h2>
            {blocks.map((block: PageBlock) => (
              <BlockLink
                key={block.id}
                pageId={page.id}
                blockId={block.id}
                title={block.title}
                url={block.url}
                domain={getDomain(block.url)}
              />
            ))}
          </div>
        )}

        {blocks.length === 0 && !page.intro_message && (
          <div className="text-center py-12 text-slate-500">
            <p>No content on this page yet.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-600 text-sm">
        Powered by{' '}
        <a href="https://kuevo.io" className="text-slate-500 hover:text-violet-400 transition">
          Kuevo
        </a>
        {' · '}
        <a href="https://kuevo.io" className="text-slate-500 hover:text-violet-400 transition">
          kuevo.io
        </a>
      </footer>
    </div>
  )
}
