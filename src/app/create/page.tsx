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
  const [prospectEmail, setProspectEmail] = useState('')
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

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  // Contact autocomplete state
  const [contactSuggestions, setContactSuggestions] = useState<Array<{name: string; email: string; company: string}>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [contactSearchLoading, setContactSearchLoading] = useState(false)

  // Blog URL state
  const [blogUrl, setBlogUrl] = useState('')
  const [fetchingBlogArticles, setFetchingBlogArticles] = useState(false)

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
      setError('Please enter contact name and company first')
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
      setError('Please enter contact name and company first')
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
      setError('Contact name and company are required')
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
          prospect_email: prospectEmail,
          intro_message: introMessage,
          blocks: validBlocks,
        }),
      })
      const data = await res.json()
      if (data.url) {
        setResult(data)
        setEmailTo(prospectEmail)
        setEmailSubject(`Resources for ${prospectName} at ${company}`)
        setEmailBody(
          `Hi ${prospectName},\n\n` +
          (introMessage ? introMessage + '\n\n' : '') +
          `I've put together a page with the resources we discussed:\n${data.url}\n\n` +
          `Let me know if you have any questions!\n\nBest,`
        )
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

  async function sendEmail() {
    setSendingEmail(true)
    setEmailError('')
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody }),
      })
      const data = await res.json()
      if (data.success) {
        setEmailSent(true)
        setTimeout(() => setShowEmailModal(false), 2000)
      } else if (data.error === 'Gmail not connected') {
        // Fallback to mailto
        const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
        window.open(mailtoUrl, '_blank')
        setShowEmailModal(false)
      } else {
        setEmailError(data.error || 'Failed to send email')
      }
    } catch {
      setEmailError('Network error')
    } finally {
      setSendingEmail(false)
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
              onClick={() => setShowEmailModal(true)}
              className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition flex items-center justify-center gap-2 mb-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send email
            </button>

            <button
              onClick={() => { setResult(null); setProspectName(''); setCompany(''); setProspectEmail(''); setIntroMessage(''); setBlocks([{ title: '', url: '' }]); setEmailSent(false) }}
              className="w-full py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition"
            >
              Create another
            </button>
          </div>
        </div>

        {showEmailModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-gray-900">Send email</h3>
                <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>

              {emailSent ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-semibold">Email sent ✓</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                  </div>

                  {emailError && <p className="text-red-500 text-sm">{emailError}</p>}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowEmailModal(false)}
                      className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendEmail}
                      disabled={sendingEmail || !emailTo}
                      className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition text-sm flex items-center justify-center gap-2"
                    >
                      {sendingEmail ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Send via Gmail
                        </>
                      )}
                    </button>
                  </div>
                  {!integration && (
                    <p className="text-xs text-gray-400 text-center">Gmail not connected — will open in your mail client instead</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchGoogleContext}
                  disabled={fetchingContext || !company}
                  className="text-xs px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50"
                >
                  {fetchingContext ? 'Fetching...' : '✨ Fetch context'}
                </button>
                <button
                  onClick={async () => {
                    const { error } = await supabaseBrowser
                      .from('integrations')
                      .delete()
                      .eq('user_id', (await supabaseBrowser.auth.getUser()).data.user?.id)
                    if (!error) {
                      setIntegration(null)
                    }
                  }}
                  className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/google"
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition font-medium"
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
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact name *</label>
                <input
                  type="text"
                  value={prospectName}
                  onChange={async (e) => {
                    const val = e.target.value
                    setProspectName(val)
                    if (val.length >= 2) {
                      setContactSearchLoading(true)
                      try {
                        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(val)}`)
                        const data = await res.json()
                        // Always show suggestions if we got results, even if there's an error
                        if (data.contacts && data.contacts.length > 0) {
                          setContactSuggestions(data.contacts)
                          setShowSuggestions(true)
                        } else {
                          setContactSuggestions([])
                          setShowSuggestions(false)
                        }
                      } catch (e) {
                        console.error('[create] autocomplete fetch error:', e)
                        setContactSuggestions([])
                      } finally {
                        setContactSearchLoading(false)
                      }
                    } else {
                      setShowSuggestions(false)
                      setContactSuggestions([])
                    }
                  }}
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
                          if (c.email) setProspectEmail(c.email)
                          if (c.company) setCompany(c.company)
                          setShowSuggestions(false)
                          setContactSuggestions([])
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
                    {!contactSearchLoading && contactSuggestions.length === 0 && prospectName.length >= 2 && (
                      <div className="px-3 py-2 text-xs text-gray-400">No contacts found — fill in manually</div>
                    )}
                  </div>
                )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Prospect email <span className="text-gray-400 font-normal">(optional — for sending)</span>
              </label>
              <input
                type="email"
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                placeholder="sarah@acmecorp.com"
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
              />
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

            {/* Blog URL — optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Blog URL <span className="text-gray-400 font-normal">(optional — fetch latest articles)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={blogUrl}
                  onChange={(e) => setBlogUrl(e.target.value)}
                  placeholder="https://blog.company.com"
                  className="flex-1 px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!blogUrl) {
                      setError('Please enter a blog URL')
                      return
                    }
                    setFetchingBlogArticles(true)
                    setError('')
                    try {
                      const res = await fetch('/api/blog/articles', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ blog_url: blogUrl }),
                      })
                      const data = await res.json()
                      if (data.articles && data.articles.length > 0) {
                        // Merge blog articles with existing blocks, cap at 3 total
                        const blogBlocks = data.articles.slice(0, 3).map((a: { title: string; url: string }) => ({
                          title: a.title,
                          url: a.url,
                        }))
                        setBlocks(blogBlocks)
                      } else {
                        setError(data.error || 'No articles found')
                      }
                    } catch {
                      setError('Failed to fetch blog articles')
                    } finally {
                      setFetchingBlogArticles(false)
                    }
                  }}
                  disabled={fetchingBlogArticles || !blogUrl}
                  className="px-3 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50 font-medium text-sm whitespace-nowrap"
                >
                  {fetchingBlogArticles ? 'Fetching...' : 'Fetch articles'}
                </button>
              </div>
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
