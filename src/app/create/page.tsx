'use client'

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

interface Block {
  title: string
  url: string
}

interface Integration {
  id: string
  provider: string
}

export default function CreatePage() {
  const [prospectName, setProspectName] = useState('')
  const [company, setCompany] = useState('')
  const [introMessage, setIntroMessage] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([{ title: '', url: '' }])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [fetchingContext, setFetchingContext] = useState(false)
  const [result, setResult] = useState<{ slug: string; url: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [checkingIntegration, setCheckingIntegration] = useState(true)

  useEffect(() => {
    async function checkIntegration() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) return

      const { data } = await supabaseBrowser
        .from('integrations')
        .select('id, provider')
        .eq('user_id', session.user.id)
        .single()

      if (data) setIntegration(data)
      setCheckingIntegration(false)
    }
    checkIntegration()
  }, [])

  function addBlock() {
    if (blocks.length < 5) {
      setBlocks([...blocks, { title: '', url: '' }])
    }
  }

  function removeBlock(index: number) {
    setBlocks(blocks.filter((_, i) => i !== index))
  }

  function updateBlock(index: number, field: 'title' | 'url', value: string) {
    const updated = [...blocks]
    updated[index][field] = value
    setBlocks(updated)
  }

  async function generateIntro() {
    if (!prospectName || !company) {
      setError('Please enter prospect name and company first')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/generate-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_name: prospectName, company }),
      })
      const data = await res.json()
      if (data.intro) setIntroMessage(data.intro)
      else setError(data.error || 'Failed to generate intro')
    } catch {
      setError('Failed to generate intro')
    } finally {
      setGenerating(false)
    }
  }

  async function fetchGoogleContext() {
    if (!prospectName || !company) {
      setError('Please enter prospect name and company first')
      return
    }
    setFetchingContext(true)
    setError('')
    try {
      const res = await fetch('/api/google/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_name: prospectName, company }),
      })
      const data = await res.json()
      if (data.intro) setIntroMessage(data.intro)
      if (data.suggested_blocks?.length > 0) {
        const newBlocks = data.suggested_blocks.slice(0, 5).map((b: Block) => ({
          title: b.title || '',
          url: b.url || '',
        }))
        setBlocks(newBlocks)
      }
      if (data.error) setError(data.error)
    } catch {
      setError('Failed to fetch Google context')
    } finally {
      setFetchingContext(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prospectName || !company) {
      setError('Prospect name and company are required')
      return
    }
    setLoading(true)
    setError('')

    const validBlocks = blocks.filter(b => b.title && b.url)

    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_name: prospectName,
          company,
          intro_message: introMessage,
          blocks: validBlocks,
        }),
      })
      const data = await res.json()
      if (data.url) {
        setResult(data)
      } else {
        setError(data.error || 'Failed to create page')
      }
    } catch {
      setError('Failed to create page')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (result?.url) {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Page created! 🎉</h2>
            <p className="text-gray-500 text-sm mb-6">Share this link with {prospectName}</p>

            <div className="bg-gray-50 border border-gray-200 rounded font-mono text-sm text-gray-800 p-4 mb-4 break-all">
              {result.url}
            </div>

            <button
              onClick={copyLink}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-lg transition mb-3"
            >
              {copied ? '✓ Copied!' : '📋 Copy link'}
            </button>

            <button
              onClick={() => { setResult(null); setProspectName(''); setCompany(''); setIntroMessage(''); setBlocks([{ title: '', url: '' }]) }}
              className="w-full py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition"
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          kuevo
        </a>
        <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 transition">
          ← Dashboard
        </a>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create a page</h1>
        <p className="text-gray-500 text-sm mb-8">Build a personalized link page for your prospect</p>

        {/* Google Integration Banner */}
        {!checkingIntegration && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {integration ? (
                <span className="text-green-600 text-sm font-medium">Google connected ✓</span>
              ) : (
                <span className="text-gray-600 text-sm">Connect Google to auto-fill from Gmail &amp; Drive</span>
              )}
            </div>
            {integration ? (
              <button
                onClick={fetchGoogleContext}
                disabled={fetchingContext || !company}
                className="text-xs px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50"
              >
                {fetchingContext ? 'Fetching...' : '✨ Fetch context'}
              </button>
            ) : (
              <a
                href="/api/auth/google"
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition"
              >
                Connect Google
              </a>
            )}
          </div>
        )}

        {/* Main Form */}
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prospect name *</label>
                <input
                  type="text"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  required
                  placeholder="Sarah Johnson"
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company *</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Intro message</label>
                <button
                  type="button"
                  onClick={generateIntro}
                  disabled={generating}
                  className="text-xs px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50"
                >
                  {generating ? 'Generating...' : '✨ Generate with AI'}
                </button>
              </div>
              <textarea
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                rows={4}
                placeholder="Write a personalized message for your prospect..."
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Content Blocks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Content links</label>
                <span className="text-xs text-gray-400">{blocks.length}/5</span>
              </div>
              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={block.title}
                        onChange={(e) => updateBlock(index, 'title', e.target.value)}
                        placeholder="Title"
                        className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                      />
                      <input
                        type="url"
                        value={block.url}
                        onChange={(e) => updateBlock(index, 'url', e.target.value)}
                        placeholder="https://..."
                        className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                      />
                    </div>
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 transition mt-0.5 text-lg"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {blocks.length < 5 && (
                <button
                  type="button"
                  onClick={addBlock}
                  className="mt-3 text-sm text-violet-600 hover:text-violet-800 transition"
                >
                  + Add item
                </button>
              )}
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition"
            >
              {loading ? 'Creating...' : '🔗 Generate link'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
