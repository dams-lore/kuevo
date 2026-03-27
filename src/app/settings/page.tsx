'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  blog_url?: string
  selected_drive_folders?: string[] // JSON array of folder IDs
}

function FolderTree({
  folders,
  selectedIds,
  onToggle,
  searchQuery,
  level = 0,
}: {
  folders: any[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  searchQuery: string
  level?: number
}) {
  // Filter folders by search query
  const filtered = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))

  if (filtered.length === 0) return null

  return (
    <div className="space-y-1">
      {filtered.map(folder => {
        const hasChildren = folder.children && folder.children.length > 0
        const childrenVisible = !searchQuery && folder.children
        
        return (
          <div key={folder.id}>
            <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer" style={{ marginLeft: `${level * 16}px` }}>
              <input
                type="checkbox"
                checked={selectedIds.has(folder.id)}
                onChange={() => onToggle(folder.id)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 cursor-pointer"
              />
              {hasChildren && (
                <span className="text-xs text-gray-400">📁</span>
              )}
              <span className="text-sm text-gray-900 flex-1">{folder.name}</span>
            </label>
            {childrenVisible && (
              <FolderTree
                folders={folder.children}
                selectedIds={selectedIds}
                onToggle={onToggle}
                searchQuery={searchQuery}
                level={level + 1}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [blogUrl, setBlogUrl] = useState('')
  const [selectedFolders, setSelectedFolders] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [availableFolders, setAvailableFolders] = useState<any[]>([])
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set())
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [folderSearchQuery, setFolderSearchQuery] = useState('')
  const [googleConnected, setGoogleConnected] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabaseBrowser.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      // Check Google integration
      const { data: integration } = await supabaseBrowser
        .from('integrations')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('provider', 'google')
        .single()

      if (integration?.access_token) {
        setGoogleConnected(true)
      }

      // Check if user profile exists, if not create one
      const { data: existingProfile } = await supabaseBrowser
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (existingProfile) {
        setProfile(existingProfile)
        setBlogUrl(existingProfile.blog_url || '')
        const folderIds = existingProfile.selected_drive_folders || []
        setSelectedFolders(folderIds.join(','))
        setSelectedFolderIds(new Set(folderIds))
      } else {
        // Create profile if doesn't exist
        await supabaseBrowser
          .from('user_profiles')
          .insert({ id: authUser.id })
        setProfile({ id: authUser.id })
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleOpenFolderBrowser() {
    setShowFolderBrowser(true)
    setLoadingFolders(true)
    try {
      const res = await fetch('/api/drive/folders')
      const data = await res.json()
      if (data.folders) {
        setAvailableFolders(data.folders)
      }
    } catch (e) {
      setMessage('Error loading folders: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingFolders(false)
    }
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setMessage('')

    const folderIds = Array.from(selectedFolderIds)
    const { error } = await supabaseBrowser
      .from('user_profiles')
      .upsert({
        id: user.id,
        blog_url: blogUrl || null,
        selected_drive_folders: folderIds.length > 0 ? folderIds : null,
        updated_at: new Date().toISOString(),
      })

    setSaving(false)
    if (error) {
      setMessage('Error saving settings: ' + error.message)
    } else {
      setMessage('Settings saved!')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  async function handleDisconnectGoogle() {
    if (!user) return
    const confirmed = window.confirm('Disconnect Google account? You will need to reconnect to use Gmail and Drive features.')
    if (!confirmed) return

    const { error } = await supabaseBrowser
      .from('integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google')

    if (!error) {
      setGoogleConnected(false)
      setMessage('Google account disconnected')
      setTimeout(() => setMessage(''), 3000)
    } else {
      setMessage('Error disconnecting: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-center py-20 text-gray-500">Loading...</div>
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
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 transition px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg">
            ← Dashboard
          </a>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Account Settings</h1>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Info</h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-base font-medium text-gray-900">{user?.email}</p>
            </div>
          </div>

          {/* Blog URL */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Links</h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">Blog URL (optional)</label>
            <input
              type="url"
              value={blogUrl}
              onChange={(e) => setBlogUrl(e.target.value)}
              placeholder="https://blog.company.com"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
            <p className="text-xs text-gray-500 mt-1">Used to fetch blog articles for content suggestions</p>
          </div>

          {/* Drive Folders */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Drive Content Sources</h2>
            <p className="text-sm text-gray-600 mb-3">
              {selectedFolderIds.size === 0 
                ? 'All your Drive files will be searchable.' 
                : `${selectedFolderIds.size} folder${selectedFolderIds.size !== 1 ? 's' : ''} selected. Only these folders will be searchable.`}
            </p>
            <button
              onClick={handleOpenFolderBrowser}
              className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
            >
              Browse & Select Folders
            </button>
            <p className="text-xs text-gray-500 mt-2">Leave empty to search all Drive files. Select specific folders to limit content sources.</p>
          </div>

          {/* Google Integration */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Google Integration</h2>
            {googleConnected ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-lg">✓</span>
                  <span className="text-sm text-green-700 font-medium">Gmail & Drive connected</span>
                </div>
                <button
                  onClick={handleDisconnectGoogle}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                <span className="text-sm text-gray-600">Not connected</span>
                <a
                  href="/login"
                  className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition"
                >
                  Connect Google
                </a>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">Required to search Gmail contacts and Drive files</p>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-gray-200">
            {message && (
              <p className={`text-sm mb-4 ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg transition"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </main>

      {/* Folder Browser Modal */}
      {showFolderBrowser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Select Drive Folders</h3>
              <button 
                onClick={() => setShowFolderBrowser(false)} 
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search folders..."
                value={folderSearchQuery}
                onChange={(e) => setFolderSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Folder Tree */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingFolders ? (
                <div className="text-center py-8 text-gray-500">Loading folders...</div>
              ) : availableFolders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No folders found</div>
              ) : (
                <FolderTree
                  folders={availableFolders}
                  selectedIds={selectedFolderIds}
                  onToggle={(id) => {
                    const newIds = new Set(selectedFolderIds)
                    if (newIds.has(id)) {
                      newIds.delete(id)
                    } else {
                      newIds.add(id)
                    }
                    setSelectedFolderIds(newIds)
                  }}
                  searchQuery={folderSearchQuery}
                />
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowFolderBrowser(false)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowFolderBrowser(false)}
                className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-lg transition text-sm"
              >
                Done ({selectedFolderIds.size} selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
