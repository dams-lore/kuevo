'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

interface PageItem {
  id: string
  slug: string
  prospect_name: string
  company: string
  created_at: string
  visit_count: number
  last_visit: string | null
  engagement_score: number
  avg_time_spent: number
}

interface Metrics {
  total_pages: number
  total_opens: number
  active_this_week: number
  avg_time_spent: number
}

function getScoreBadge(score: number): { label: string; emoji: string; bg: string; text: string } {
  if (score === 0) return { label: 'Cold', emoji: '🧊', bg: 'bg-gray-100', text: 'text-gray-600' }
  if (score <= 30) return { label: 'Warm', emoji: '🌤️', bg: 'bg-blue-100', text: 'text-blue-700' }
  if (score <= 60) return { label: 'Hot', emoji: '🔥', bg: 'bg-orange-100', text: 'text-orange-700' }
  return { label: 'On Fire', emoji: '🚀', bg: 'bg-red-100', text: 'text-red-700' }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface DashboardClientProps {
  showOnboarding?: boolean
}

export default function DashboardClient({ showOnboarding = false }: DashboardClientProps) {
  const [user, setUser] = useState<User | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'recent' | 'opens' | 'score'>('recent')
  const [filterScore, setFilterScore] = useState<'all' | '0' | '1-30' | '31-60' | '61-100'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const router = useRouter()

  // Load dashboard data
  const loadDashboard = async () => {
    const { data: { user: authUser } } = await supabaseBrowser.auth.getUser()
    if (!authUser) {
      router.push('/login')
      return
    }
    setUser(authUser)

    const res = await fetch('/api/dashboard')
    const data = await res.json()
    if (data.metrics) {
      setMetrics(data.metrics)
      setPages(data.pages || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()

    // Poll every 30 seconds for real-time updates
    const interval = setInterval(() => {
      loadDashboard()
    }, 30000)

    return () => clearInterval(interval)
  }, [router])

  // Filter and sort pages
  const filtered = pages.filter(p => {
    // Search filter
    if (searchQuery && !p.prospect_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    // Score filter
    if (filterScore === '0' && p.engagement_score !== 0) return false
    if (filterScore === '1-30' && (p.engagement_score < 1 || p.engagement_score > 30)) return false
    if (filterScore === '31-60' && (p.engagement_score < 31 || p.engagement_score > 60)) return false
    if (filterScore === '61-100' && p.engagement_score < 61) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortBy === 'opens') return b.visit_count - a.visit_count
    if (sortBy === 'score') return b.engagement_score - a.engagement_score
    return 0
  })

  async function signOut() {
    await supabaseBrowser.auth.signOut()
    router.push('/login')
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`https://kuevo.io/p/${slug}`)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="bottom-right" />

      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          kuevo
        </a>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <a
            href="/settings"
            className="text-sm text-gray-500 hover:text-gray-900 transition px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Settings
          </a>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-900 transition px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your pages</h1>
            <p className="text-gray-500 mt-1">{pages.length} page{pages.length !== 1 ? 's' : ''}</p>
          </div>
          <a
            href="/create"
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition shadow-sm"
          >
            + New page
          </a>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : pages.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No pages yet</h3>
            <p className="text-gray-500 mb-6">Create your first personalized link page</p>
            <a
              href="/create"
              className="inline-flex px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg transition"
            >
              Create your first one →
            </a>
          </div>
        ) : (
          <>
            {/* Metrics */}
            {metrics && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Total pages</div>
                  <div className="text-3xl font-bold text-gray-900">{metrics.total_pages}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Total opens</div>
                  <div className="text-3xl font-bold text-gray-900">{metrics.total_opens}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Active this week</div>
                  <div className="text-3xl font-bold text-gray-900">{metrics.active_this_week}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Avg. time spent</div>
                  <div className="text-3xl font-bold text-gray-900">{metrics.avg_time_spent}s</div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 space-y-4">
              {/* Search */}
              <div>
                <input
                  type="text"
                  placeholder="Search by contact name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              {/* Sort and Filter */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1.5 font-medium">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="recent">Most recent</option>
                    <option value="opens">Most opened</option>
                    <option value="score">Highest score</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1.5 font-medium">Filter by score</label>
                  <select
                    value={filterScore}
                    onChange={(e) => setFilterScore(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="all">All scores</option>
                    <option value="0">Cold (0 pts)</option>
                    <option value="1-30">Warm (1-30 pts)</option>
                    <option value="31-60">Hot (31-60 pts)</option>
                    <option value="61-100">On Fire (61-100 pts)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pages List */}
            <div className="space-y-3">
              {sorted.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No pages match your filters</div>
              ) : (
                sorted.map((page) => {
                  const badge = getScoreBadge(page.engagement_score)
                  return (
                    <div
                      key={page.id}
                      className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{page.prospect_name}</h3>
                            <p className="text-sm text-gray-500">
                              {page.company} • Created {formatDate(page.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 space-x-3 flex">
                          <span>{page.visit_count} open{page.visit_count !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>{page.avg_time_spent}s avg time</span>
                          {page.last_visit && (
                            <>
                              <span>•</span>
                              <span>Last seen {timeAgo(page.last_visit)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className={`px-3 py-1.5 rounded-lg ${badge.bg}`}>
                          <span className={`text-sm font-semibold ${badge.text}`}>
                            {badge.emoji} {badge.label} ({page.engagement_score}pts)
                          </span>
                        </div>

                        <button
                          onClick={() => copyLink(page.slug)}
                          className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                          {copied === page.slug ? '✓' : '📋'}
                        </button>

                        <a
                          href={`/p/${page.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-violet-600 hover:text-violet-700 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition font-medium"
                        >
                          View →
                        </a>

                        <button
                          onClick={() => toast.info(`Opening page: ${page.prospect_name}`)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ⋮
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
