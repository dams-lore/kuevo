'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
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
}

function getScoreLabel(score: number): { label: string; emoji: string; color: string } {
  if (score === 0) return { label: 'Cold', emoji: '🧊', color: 'bg-gray-100 text-gray-600' }
  if (score <= 10) return { label: 'Warm', emoji: '🌤️', color: 'bg-amber-100 text-amber-700' }
  if (score <= 30) return { label: 'Hot', emoji: '🔥', color: 'bg-orange-100 text-orange-700' }
  return { label: 'On Fire', emoji: '🚀', color: 'bg-violet-100 text-violet-700' }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabaseBrowser.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      const res = await fetch('/api/dashboard')
      const data = await res.json()
      if (data.pages) setPages(data.pages)
      setLoading(false)
    }
    load()
  }, [router])

  async function signOut() {
    await supabaseBrowser.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          kuevo
        </a>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm hidden sm:block">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your pages</h1>
            <p className="text-gray-500 text-sm mt-1">{pages.length} page{pages.length !== 1 ? 's' : ''} created</p>
          </div>
          <a
            href="/create"
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-lg transition text-sm"
          >
            + New page
          </a>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-semibold text-lg mb-2">No pages yet</h3>
            <p className="text-gray-400 mb-6">Create your first personalized link page</p>
            <a
              href="/create"
              className="inline-flex px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-lg transition"
            >
              Create your first one →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {pages.map(page => {
              const scoreInfo = getScoreLabel(page.engagement_score)
              return (
                <div
                  key={page.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-base">{page.prospect_name}</h3>
                        <span className="text-gray-400 text-sm">at</span>
                        <span className="text-indigo-600 font-medium text-sm">{page.company}</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${scoreInfo.color}`}>
                          {scoreInfo.emoji} {scoreInfo.label} · {page.engagement_score}pts
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                        <span>Created {formatDate(page.created_at)}</span>
                        <span>·</span>
                        <span>{page.visit_count} open{page.visit_count !== 1 ? 's' : ''}</span>
                        {page.last_visit && (
                          <>
                            <span>·</span>
                            <span>Last seen {formatDate(page.last_visit)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <a
                      href={`/p/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-violet-600 hover:text-violet-800 transition font-medium whitespace-nowrap"
                    >
                      View page →
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
