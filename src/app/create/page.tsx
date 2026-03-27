'use client'

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

declare global {
  interface Window {
    gapi: any
    google: any
  }
}

interface Block {
  title: string
  url: string
}

export default function CreatePage() {
  const router = useRouter()
  const [googleConnected, setGoogleConnected] = useState(false)
  const [checkingIntegration, setCheckingIntegration] = useState(true)
  const [successUrl, setSuccessUrl] = useState<string | null>(null)

  // Section 1: Contact info
  const [prospectName, setProspectName] = useState('')
  const [company, setCompany] = useState('')
  const [prospectEmail, setProspectEmail] = useState('')
  const [contactSuggestions, setContactSuggestions] = useState<Array<{name: string; email: string; company: string}>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [contactSearchLoading, setContactSearchLoading] = useState(false)

  // Section 2: Intro message
  const [introMessage, setIntroMessage] = useState('')
  const [generatingIntro, setGeneratingIntro] = useState(false)

  // Section 3: Content
  const [blocks, setBlocks] = useState<Block[]>([])
  const [fetchingContext, setFetchingContext] = useState(false)

  // Section 4: Actions
  const [creating, setCreating] = useState(false)

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

    // Load Google API
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  async function openDrivePicker(blockIndex: number) {
    if (!window.gapi || !window.gapi.load) {
      toast.error('Google API not loaded yet. Please try again.')
      return
    }

    const { data } = await supabaseBrowser.auth.getSession()
    const session = data?.session
    if (!session) {
      toast.error('Not authenticated')
      return
    }

    window.gapi.load('picker', { callback: () => {
      // Get access token from session
      const accessToken = session.provider_token
      
      if (!accessToken) {
        toast.error('Google access not available. Please reconnect.')
        return
      }

      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.DOCS)
        .setOAuthToken(accessToken)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const file = data.docs[0]
            if (file) {
              const updated = [...blocks]
              updated[blockIndex].title = file.name
              updated[blockIndex].url = file.url
              setBlocks(updated)
              toast.success('File added!')
            }
          }
        })
        .build()
      
      picker.setVisible(true)
    } })
  }

  async function handleContactSearch(val: string) {
    setProspectName(val)
    if (val.length >= 2) {
      setContactSearchLoading(true)
      try {
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
      // First try to fetch emails for language detection
      let emailContext = ''
      if (googleConnected) {
        try {
          const emailRes = await fetch('/api/google/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prospect_name: prospectName, company }),
          })
          const emailData = await emailRes.json()
          if (emailData.email_subjects) {
            emailContext = emailData.email_subjects
          }
        } catch (e) {
          console.log('[create] couldnt fetch email context for language detection')
        }
      }

      const res = await fetch('/api/generate-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_name: prospectName, company, email_context: emailContext }),
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
        toast.success('Content fetched!')
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
      toast.error('Error fetching content')
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
        console.error('[create] error:', data)
        return
      }

      const pageUrl = `${window.location.origin}/p/${data.slug}`
      console.log('[create] page created:', pageUrl)
      setSuccessUrl(pageUrl)
      toast.success('Page created!')

      if (sendEmail && googleConnected && prospectEmail) {
        const subject = `Resources for ${prospectName} at ${company}`
        const body = `Hi ${prospectName},\n\nHere are the resources we discussed:\n\n${pageUrl}\n\nFeel free to review at your pace.\n\nBest regards`
        window.location.href = `mailto:${prospectEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      }
    } catch (e) {
      toast.error('Error creating page')
      console.error('[create] error:', e)
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

  if (successUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <Toaster position="bottom-right" />
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Page created!</h1>
          <p className="text-gray-600 mb-6">Your personalized sharing page is ready to send</p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-2">Share this link:</p>
            <p className="font-mono text-sm text-gray-900 break-all">{successUrl}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(successUrl)
                toast.success('Link copied!')
              }}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition"
            >
              📋 Copy link
            </button>
            <button
              onClick={() => setSuccessUrl(null)}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
            >
              Create another
            </button>
          </div>

          <a
            href="/dashboard"
            className="block text-sm text-violet-600 hover:text-violet-800 mt-6"
          >
            ← Back to dashboard
          </a>
        </div>
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
          <p className="text-gray-500 text-sm">Share personalized resources with your prospect</p>
        </div>

        <div className="space-y-4">
          {/* Section 1: Contact */}
          <section className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl p-8 border border-violet-100/50">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-sm font-bold mr-3">①</span>
              Contact
            </h2>

            <div className="space-y-4">
              {/* Contact Name */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  placeholder="sarah@acmecorp.com"
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Intro Message */}
          <section className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl p-8 border border-violet-100/50">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-sm font-bold mr-3">②</span>
              Intro message
            </h2>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">Subject line + one engaging punchline</p>

              <button
                onClick={generateIntro}
                disabled={generatingIntro || !company}
                className="w-full text-sm px-4 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50 font-medium"
              >
                {generatingIntro ? 'Generating...' : '✨ Generate with AI'}
              </button>

              <textarea
                rows={4}
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Subject line&#10;One engaging punchline about value"
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none text-sm"
              />
            </div>
          </section>

          {/* Section 3: Content */}
          <section className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl p-8 border border-violet-100/50">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-sm font-bold mr-3">③</span>
              Content
            </h2>

            <div className="space-y-4">
              {googleConnected && (
                <button
                  onClick={fetchGoogleContext}
                  disabled={fetchingContext || !company}
                  className="w-full text-sm px-4 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition font-medium"
                >
                  {fetchingContext ? 'Fetching...' : '✨ Fetch content'}
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
                    {googleConnected && (
                      <button
                        onClick={() => openDrivePicker(i)}
                        type="button"
                        className="text-xs px-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition"
                        title="Browse Drive"
                      >
                        📁
                      </button>
                    )}
                    {blocks.length > 0 && (
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
                  className="text-sm text-violet-600 hover:text-violet-800 transition font-medium"
                >
                  + Add link
                </button>
              )}
            </div>
          </section>

          {/* Section 4: Send */}
          <section className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl p-8 border border-violet-100/50">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-sm font-bold mr-3">④</span>
              Send
            </h2>

            <div className="space-y-3">
              {!googleConnected && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    Connect Google in <a href="/settings" className="underline font-medium">settings</a> to send emails.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => createPage(false)}
                  disabled={creating || !prospectName || !company}
                  className="flex-1 px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {creating ? '...' : '🔗 Generate link'}
                </button>
                {googleConnected && prospectEmail && (
                  <button
                    onClick={() => createPage(true)}
                    disabled={creating || !prospectName || !company}
                    className="flex-1 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                  >
                    {creating ? '...' : '📧 Generate + Send'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
