'use client'

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

interface Block {
  title: string
  url: string
}

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [checkingIntegration, setCheckingIntegration] = useState(true)

  // Step 1: Contact info
  const [prospectName, setProspectName] = useState('')
  const [company, setCompany] = useState('')
  const [prospectEmail, setProspectEmail] = useState('')
  const [contactSuggestions, setContactSuggestions] = useState<Array<{name: string; email: string; company: string}>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [contactSearchLoading, setContactSearchLoading] = useState(false)

  // Step 2: Intro message
  const [introMessage, setIntroMessage] = useState('')
  const [generatingIntro, setGeneratingIntro] = useState(false)

  // Step 3: Content
  const [blocks, setBlocks] = useState<Block[]>([{ title: '', url: '' }])
  const [fetchingContext, setFetchingContext] = useState(false)

  // Step 4: Actions
  const [creating, setCreating] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    async function checkIntegration() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) return

      const { data } = await supabaseBrowser
        .from('integrations')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('provider', 'google')
        .single()

      setGoogleConnected(!!data?.access_token)
      setCheckingIntegration(false)
    }
    checkIntegration()
  }, [])

  async function handleContactSearch(val: string) {
    setProspectName(val)
    if (val.length >= 2) {
      setContactSearchLoading(true)
      try {
        console.log('[create] searching contacts for:', val)
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(val)}`)
        const data = await res.json()
        if (data.contacts?.length > 0) {
          setContactSuggestions(data.contacts)
          setShowSuggestions(true)
        } else {
          setShowSuggestions(false)
        }
      } catch (e) {
        console.error('[create] autocomplete error:', e)
      } finally {
        setContactSearchLoading(false)
      }
    } else {
      setShowSuggestions(false)
    }
  }

  async function generateIntro() {
    if (!company || !prospectName) {
      toast.error('Please fill in contact name and company first')
      return
    }
    setGeneratingIntro(true)
    try {
      const res = await fetch('/api/generate-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_name: prospectName, company }),
      })
      const data = await res.json()
      if (data.intro) {
        setIntroMessage(data.intro)
        toast.success('Intro generated!')
      } else {
        toast.error(data.error || 'Failed to generate intro')
      }
    } catch (e) {
      toast.error('Error generating intro')
    } finally {
      setGeneratingIntro(false)
    }
  }

  async function fetchGoogleContext() {
    if (!prospectName || !company) {
      toast.error('Please fill in contact name and company first')
      return
    }
    setFetchingContext(true)
    try {
      const res = await fetch('/api/google/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_name: prospectName, company }),
      })
      const data = await res.json()
      if (data.intro) {
        setIntroMessage(data.intro)
        toast.success('Context fetched from Gmail & Drive!')
      }
      if (data.suggested_blocks?.length > 0) {
        const newBlocks = data.suggested_blocks.slice(0, 5).map((b: Block) => ({
          title: b.title || '',
          url: b.url || '',
        }))
        setBlocks(newBlocks)
      }
      if (data.error) toast.error(data.error)
    } catch (e) {
      toast.error('Error fetching context')
    } finally {
      setFetchingContext(false)
    }
  }

  async function createPage(sendEmail: boolean = false) {
    if (!prospectName || !company) {
      toast.error('Contact name and company are required')
      return
    }

    const validBlocks = blocks.filter(b => b.title && b.url)

    setCreating(true)
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_name: prospectName,
          company,
          prospect_email: prospectEmail || null,
          intro_message: introMessage,
          blocks: validBlocks,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create page')
        return
      }

      const pageUrl = `${window.location.origin}/p/${data.slug}`
      console.log('[create] page created:', pageUrl)
      toast.success('Page created!')

      // Copy URL to clipboard
      navigator.clipboard.writeText(pageUrl)
      toast.success('URL copied to clipboard!')

      if (sendEmail && googleConnected && prospectEmail) {
        // TODO: Open email composer with pre-filled message
        const subject = `Resources for ${prospectName} at ${company}`
        const body = `Hi ${prospectName},\n\nHere are the resources we discussed:\n\n${pageUrl}\n\nFeel free to review at your pace.\n\nBest regards`
        window.location.href = `mailto:${prospectEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      } else {
        router.push('/dashboard')
      }
    } catch (e) {
      toast.error('Error creating page')
    } finally {
      setCreating(false)
    }
  }

  if (checkingIntegration) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="bottom-right" />

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create a sharing page</h1>
          <p className="text-gray-500">Step {step} of 4</p>
          
          {/* Progress bar */}
          <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all"
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          {/* Step 1: Contact Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact information</h2>
              </div>

              {/* Contact Name with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact name *</label>
                <input
                  type="text"
                  value={prospectName}
                  onChange={(e) => handleContactSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  required
                  placeholder="Sarah Johnson"
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                />
                {showSuggestions && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {contactSearchLoading && (
                      <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
                    )}
                    {!contactSearchLoading && contactSuggestions.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={() => {
                          setProspectName(c.name)
                          setProspectEmail(c.email)
                          setCompany(c.company)
                          setShowSuggestions(false)
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">{c.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                          {c.email && <span>{c.email}</span>}
                          {c.company && <span>· {c.company}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Company */}
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

              {/* Email (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact email <span className="text-gray-400 font-normal">(optional — for sending)</span>
                </label>
                <input
                  type="email"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  placeholder="sarah@acmecorp.com"
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                />
              </div>

              {/* Google Status */}
              {!googleConnected && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Gmail & Drive not connected.</span> Go to <a href="/settings" className="underline">settings</a> to connect Google and enable email/file features.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Intro Message */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Page intro</h2>
                <p className="text-sm text-gray-500">Subject line + one engaging punchline</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Intro message</label>
                  <div className="flex gap-2">
                    {googleConnected && (
                      <button
                        onClick={fetchGoogleContext}
                        disabled={fetchingContext || !company}
                        className="text-xs px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50"
                      >
                        {fetchingContext ? 'Fetching...' : '✨ Fetch from Gmail'}
                      </button>
                    )}
                    <button
                      onClick={generateIntro}
                      disabled={generatingIntro || !company}
                      className="text-xs px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50"
                    >
                      {generatingIntro ? 'Generating...' : '✨ Generate with AI'}
                    </button>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={introMessage}
                  onChange={(e) => setIntroMessage(e.target.value)}
                  placeholder="Write a personalized message for your prospect..."
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Content */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Content links</h2>
                <p className="text-sm text-gray-500">Files and resources to share</p>
              </div>

              {googleConnected && (
                <button
                  onClick={fetchGoogleContext}
                  disabled={fetchingContext || !company}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                >
                  {fetchingContext ? 'Fetching...' : '📁 Fetch content from Drive'}
                </button>
              )}

              <div className="space-y-3">
                {blocks.map((block, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Title"
                        value={block.title}
                        onChange={(e) => {
                          const updated = [...blocks]
                          updated[i].title = e.target.value
                          setBlocks(updated)
                        }}
                        className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={block.url}
                        onChange={(e) => {
                          const updated = [...blocks]
                          updated[i].url = e.target.value
                          setBlocks(updated)
                        }}
                        className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                      />
                    </div>
                    {blocks.length > 1 && (
                      <button
                        onClick={() => setBlocks(blocks.filter((_, idx) => idx !== i))}
                        type="button"
                        className="text-gray-400 hover:text-red-600 transition px-2 py-2.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {blocks.length < 5 && (
                <button
                  onClick={() => setBlocks([...blocks, { title: '', url: '' }])}
                  type="button"
                  className="text-sm text-violet-600 hover:text-violet-800 transition"
                >
                  + Add another link
                </button>
              )}
            </div>
          )}

          {/* Step 4: Actions */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Ready to share?</h2>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{prospectName}</span> at <span className="font-medium">{company}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                ← Back
              </button>
            )}

            {step < 4 && (
              <button
                onClick={() => {
                  if (step === 1 && (!prospectName || !company)) {
                    toast.error('Please fill in contact name and company')
                    return
                  }
                  setStep(step + 1)
                }}
                className="flex-1 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-lg transition"
              >
                Next →
              </button>
            )}

            {step === 4 && (
              <div className="flex-1 flex gap-3">
                <button
                  onClick={() => createPage(false)}
                  disabled={creating}
                  className="flex-1 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {creating ? '...' : '🔗 Generate link'}
                </button>
                {googleConnected && prospectEmail && (
                  <button
                    onClick={() => createPage(true)}
                    disabled={creating || sendingEmail}
                    className="flex-1 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {creating || sendingEmail ? '...' : '📧 Generate + Send email'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
