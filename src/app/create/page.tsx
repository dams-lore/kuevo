'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'

interface Block {
  title: string
  url: string
}

interface ContactMatch {
  email: string
  name?: string
  company?: string
}

export default function CreatePage() {
  const router = useRouter()

  // ─── Part 1: Contact Info
  const [prospectName, setProspectName] = useState('')
  const [company, setCompany] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([])
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  
  // HubSpot contact search
  const [hubspotContactId, setHubspotContactId] = useState<string | null>(null)
  const [hubspotContacts, setHubspotContacts] = useState<any[]>([])
  const [showHubspotDropdown, setShowHubspotDropdown] = useState(false)
  const [searchingHubspot, setSearchingHubspot] = useState(false)

  // ─── Part 2: Context
  const [emailContext, setEmailContext] = useState('')
  const [emailsFound, setEmailsFound] = useState(0)
  const [emailAnalysis, setEmailAnalysis] = useState<any>(null)
  const [freeTextContext, setFreeTextContext] = useState('')
  const [transcriptAdded, setTranscriptAdded] = useState(false)
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<any>(null)
  const [fetchingEmails, setFetchingEmails] = useState(false)
  const [uploadingTranscript, setUploadingTranscript] = useState(false)

  // ─── Part 3: Intro
  const [introMessage, setIntroMessage] = useState('')
  const [generatingIntro, setGeneratingIntro] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState('English')

  // ─── Part 4: Content
  const [blocks, setBlocks] = useState<Block[]>([])
  const [fetchingContent, setFetchingContent] = useState(false)
  const [contentMessage, setContentMessage] = useState('')

  // ─── Part 5: Actions
  const [creating, setCreating] = useState(false)
  const [successUrl, setSuccessUrl] = useState('')

  // ─── Auth & Integration
  const [googleConnected, setGoogleConnected] = useState(false)
  const [checkingIntegration, setCheckingIntegration] = useState(true)

  // ─── Check Google integration
  useEffect(() => {
    async function checkIntegration() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

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
  }, [router])

  // ─── Contact name autocomplete
  async function handleContactNameChange(value: string) {
    setProspectName(value)
    if (value.length < 2) {
      setContactMatches([])
      return
    }

    try {
      const res = await fetch('/api/contacts/search?q=' + encodeURIComponent(value))
      const data = await res.json()
      // API returns 'contacts', not 'matches'
      const matches = data.contacts?.map((c: any) => ({
        email: c.email,
        name: c.name || c.email,
        company: c.company,
      })) || []
      setContactMatches(matches)
      setShowContactDropdown(true)
    } catch (e) {
      console.error('[create] contact search error:', e)
    }
  }

  // ─── HubSpot contact search
  async function handleHubspotSearch(value: string) {
    if (value.length < 2) {
      setHubspotContacts([])
      return
    }

    setSearchingHubspot(true)
    try {
      const res = await fetch('/api/hubspot/contacts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value }),
      })

      if (!res.ok) {
        console.warn('[create] hubspot search failed:', res.status)
        setHubspotContacts([])
      } else {
        const data = await res.json()
        setHubspotContacts(data.contacts || [])
        setShowHubspotDropdown(data.contacts?.length > 0)
      }
    } catch (e) {
      console.error('[create] hubspot search error:', e)
      setHubspotContacts([])
    } finally {
      setSearchingHubspot(false)
    }
  }

  function selectHubspotContact(contact: any) {
    setProspectName(contact.firstName + ' ' + contact.lastName)
    setCompany(contact.company || '')
    setContactEmail(contact.email || '')
    setHubspotContactId(contact.id)
    setShowHubspotDropdown(false)
  }

  // ─── Fetch email context
  async function handleFetchEmails() {
    if (!company) {
      toast.error('Please enter company name first')
      return
    }
    if (!googleConnected) {
      toast.error('Please connect Google first')
      return
    }

    setFetchingEmails(true)
    try {
      const res = await fetch('/api/google/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_name: prospectName, company }),
      })
      const data = await res.json()
      
      if (data.email_subjects) {
        setEmailContext(data.email_subjects)
        setEmailsFound(data.debug?.emails_found || 0)
        setEmailAnalysis(data.email_analysis || {})
        setDetectedLanguage(data.detected_language || 'English')
        toast.success(`Found ${data.debug?.emails_found || 0} emails analyzed`)
      } else {
        setEmailsFound(0)
        setEmailAnalysis(null)
        toast.info('No emails found for this company')
      }
    } catch (e) {
      toast.error('Failed to fetch emails')
    } finally {
      setFetchingEmails(false)
    }
  }

  // ─── Transcript upload
  async function handleTranscriptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload .txt, .pdf, or .docx file')
      return
    }

    setUploadingTranscript(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/transcript/analyze', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.success && data.analysis) {
        setTranscriptAnalysis(data.analysis)
        setTranscriptAdded(true)
        toast.success('Transcript added!')
      } else {
        toast.error(data.error || 'Failed to analyze transcript')
      }
    } catch (e) {
      toast.error('Error uploading transcript')
    } finally {
      setUploadingTranscript(false)
      e.target.value = ''
    }
  }

  // ─── Generate intro
  async function handleGenerateIntro() {
    if (!company || !prospectName) {
      toast.error('Please fill in contact name and company first')
      return
    }

    setGeneratingIntro(true)
    try {
      const res = await fetch('/api/generate-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_name: prospectName,
          company,
          email_context: emailContext,
          email_analysis: emailAnalysis,
          free_text_context: freeTextContext,
          transcript_analysis: transcriptAnalysis,
        }),
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

  // ─── Fetch content
  async function handleFetchContent() {
    if (!company || !prospectName) {
      toast.error('Please fill in contact info first')
      return
    }

    setFetchingContent(true)
    try {
      const res = await fetch('/api/google/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_name: prospectName, company }),
      })
      const data = await res.json()

      if (data.suggested_blocks && Array.isArray(data.suggested_blocks)) {
        const newBlocks = data.suggested_blocks.map((b: any) => ({
          title: b.title || '',
          url: b.url || '',
        }))
        setBlocks(newBlocks)
        setContentMessage('')
        if (newBlocks.length === 0) {
          setContentMessage('No content found. Add links manually or configure sources in Settings.')
        }
      } else {
        setContentMessage('No content found. Add links manually or configure sources in Settings.')
      }
      toast.success('Content fetched!')
    } catch (e) {
      toast.error('Failed to fetch content')
      setContentMessage('Error fetching content. Try again.')
    } finally {
      setFetchingContent(false)
    }
  }

  // ─── Add link manually
  function handleAddLink() {
    setBlocks([...blocks, { title: '', url: '' }])
  }

  // ─── Create page
  async function handleCreatePage(sendEmail: boolean = false) {
    if (!prospectName || !company) {
      toast.error('Please fill in contact name and company')
      return
    }

    if (blocks.length === 0) {
      toast.error('Please add at least one content link')
      return
    }

    if (!introMessage) {
      toast.error('Please add a page intro')
      return
    }

    setCreating(true)
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Create page
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_name: prospectName,
          company,
          prospect_email: contactEmail || undefined,
          intro_message: introMessage,
          blocks,
          hubspot_contact_id: hubspotContactId || undefined,
        }),
      })

      const data = await res.json()
      if (data.slug) {
        const pageUrl = `${window.location.origin}/p/${data.slug}`
        setSuccessUrl(pageUrl)

        // Copy to clipboard
        navigator.clipboard.writeText(pageUrl)
        toast.success('Link copied to clipboard!')

        if (sendEmail) {
          // Open email composer
          const subject = introMessage.split('\n')[0]
          const mailtoUrl = `mailto:${contactEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Check this out:\n\n${pageUrl}`)}`
          window.open(mailtoUrl)
        }
      } else {
        toast.error(data.error || 'Failed to create page')
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

  // ─── Success Screen
  if (successUrl) {
    const slug = successUrl.split('/').pop()
    const previewUrl = `/preview/${slug}`

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <Toaster position="bottom-right" />
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Page created!</h1>
          <p className="text-gray-600 mb-6">Your personalized sharing page is ready</p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-2">Share this link:</p>
            <p className="font-mono text-sm text-gray-900 break-all">{successUrl}</p>
          </div>

          <div className="flex gap-3 mb-4">
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
              onClick={() => window.open(previewUrl, '_blank')}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
            >
              👁️ Preview
            </button>
          </div>

          <button
            onClick={() => setSuccessUrl('')}
            className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition text-sm"
          >
            Create another
          </button>

          <a href="/dashboard" className="block text-sm text-violet-600 hover:text-violet-800 mt-6">
            ← Back to dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-violet-50">
      <Toaster position="bottom-right" />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Create sharing page
            </h1>
            <p className="text-sm text-gray-500 mt-1">Personalized follow-up in minutes</p>
          </div>
          <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            ← Dashboard
          </a>
        </div>
      </div>

      {/* Main Form */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Part 1: Contact Info */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Contact info</h2>

          <div className="space-y-4">
            {/* HubSpot Contact Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search HubSpot Contact</label>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    onChange={(e) => handleHubspotSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    onFocus={() => hubspotContacts.length > 0 && setShowHubspotDropdown(true)}
                    onBlur={() => setTimeout(() => setShowHubspotDropdown(false), 200)}
                  />
                  {searchingHubspot && <span className="text-sm text-gray-500 py-2.5">Searching...</span>}
                </div>
                {showHubspotDropdown && hubspotContacts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 z-20 max-h-48 overflow-y-auto">
                    {hubspotContacts.map((contact, i) => (
                      <button
                        key={i}
                        onClick={() => selectHubspotContact(contact)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-violet-50 text-sm border-b border-gray-100 last:border-b-0 transition ${
                          hubspotContactId === contact.id ? 'bg-violet-100' : ''
                        }`}
                      >
                        <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                        <div className="text-xs text-gray-500">{contact.email}</div>
                        {contact.company && <div className="text-xs text-gray-400">{contact.company}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {hubspotContactId && (
                <p className="text-xs text-green-600 mt-2">✓ HubSpot contact selected</p>
              )}
            </div>

            {/* Contact Name with Autocomplete */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact name</label>
              <div className="relative">
                <input
                  type="text"
                  value={prospectName}
                  onChange={(e) => handleContactNameChange(e.target.value)}
                  onFocus={() => prospectName.length > 1 && setShowContactDropdown(true)}
                  onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                />
                {showContactDropdown && contactMatches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 z-20">
                    {contactMatches.map((match, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setProspectName(match.name || match.email)
                          setContactEmail(match.email)
                          if (match.company) {
                            setCompany(match.company)
                          }
                          setShowContactDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-violet-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium">{match.name || match.email}</div>
                        <div className="text-xs text-gray-500">{match.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email (optional)</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="sarah@acmecorp.com"
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>
          </div>
        </section>

        {/* Part 2: Context */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Add context to personalize your page</h2>
          <p className="text-sm text-gray-500 mb-6">Use one or all three to help generate a personalized intro</p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* From Emails */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">① From emails</h3>
              <button
                onClick={handleFetchEmails}
                disabled={fetchingEmails || !googleConnected || !company}
                className="w-full px-3 py-2 text-sm bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50 font-medium mb-3"
              >
                {fetchingEmails ? 'Fetching...' : 'Fetch from emails'}
              </button>
              
              {emailsFound > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-green-600 font-medium">✓ {emailsFound} emails analyzed</p>
                </div>
              )}
              {emailContext && !emailsFound && (
                <p className="text-xs text-gray-500">Context loaded</p>
              )}
            </div>

            {/* Free Text */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">② Or describe it</h3>
              <textarea
                value={freeTextContext}
                onChange={(e) => setFreeTextContext(e.target.value)}
                placeholder="e.g. We met at SaaStr, they're looking for a sales enablement solution…"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Transcript Upload */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">③ Or import transcript</h3>
              <div>
                <input
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={handleTranscriptUpload}
                  disabled={uploadingTranscript}
                  className="hidden"
                  id="transcript-upload"
                />
                <label
                  htmlFor="transcript-upload"
                  className="block text-sm text-violet-600 hover:text-violet-800 cursor-pointer underline text-center mb-2"
                >
                  {uploadingTranscript ? 'Uploading...' : 'Import meeting transcript'}
                </label>
                {transcriptAdded && (
                  <p className="text-xs text-green-600 font-medium text-center">✓ Transcript added</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Part 3: Page Intro */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Page intro</h2>
          <p className="text-sm text-gray-500 mb-4">A short title and one engaging punchline</p>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleGenerateIntro}
              disabled={generatingIntro || !company}
              className="px-4 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50 font-medium text-sm"
            >
              {generatingIntro ? 'Generating...' : '✨ Generate with AI'}
            </button>
            <p className="text-xs text-gray-500 self-center">
              {detectedLanguage !== 'English' ? `Language: ${detectedLanguage}` : ''}
            </p>
          </div>

          <textarea
            rows={4}
            value={introMessage}
            onChange={(e) => setIntroMessage(e.target.value)}
            placeholder="Line 1: Title (max 8 words)&#10;Line 2: Punchline (max 20 words)"
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none text-sm"
          />
        </section>

        {/* Part 4: Content to Share */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Content to share</h2>
          <p className="text-sm text-gray-500 mb-4">Links your prospect will find useful</p>

          <button
            onClick={handleFetchContent}
            disabled={fetchingContent || !company}
            className="w-full px-4 py-2.5 text-sm bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition disabled:opacity-50 font-medium mb-4"
          >
            {fetchingContent ? 'Fetching...' : '✨ Fetch content'}
          </button>

          {contentMessage && (
            <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              {contentMessage}
            </div>
          )}

          <div className="space-y-3 mb-4">
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
                <button
                  onClick={() => setBlocks(blocks.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-600 hover:text-red-800 px-2 py-2.5"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddLink}
            className="text-sm text-violet-600 hover:text-violet-800 underline"
          >
            + Add link manually
          </button>
        </section>

        {/* Part 5: Actions */}
        <section className="grid md:grid-cols-2 gap-4 mb-12">
          <button
            onClick={() => handleCreatePage(false)}
            disabled={creating || !introMessage || blocks.length === 0}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Generate link'}
          </button>
          <button
            onClick={() => handleCreatePage(true)}
            disabled={creating || !introMessage || blocks.length === 0 || !contactEmail}
            className="px-6 py-3 bg-white border-2 border-violet-600 text-violet-600 hover:bg-violet-50 font-semibold rounded-lg transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Generate + Send email'}
          </button>
        </section>
      </div>
    </div>
  )
}
