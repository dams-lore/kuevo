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

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [blogUrl, setBlogUrl] = useState('')
  const [selectedFolders, setSelectedFolders] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [availableFolders, setAvailableFolders] = useState<Array<{ id: string; name: string }>>([])
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set())
  const [loadingFolders, setLoadingFolders] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabaseBrowser.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      // Check if profiles table exists, if not create basic profile
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

    await supabaseBrowser
      .from('integrations')
      .delete()
      .eq('user_id', user.id)
    window.location.reload()
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
            <button
              onClick={handleDisconnectGoogle}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition font-medium text-sm"
            >
              Disconnect Google
            </button>
            <p className="text-xs text-gray-500 mt-2">You'll need to reconnect to use Gmail contacts and Drive file features</p>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-96 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Select Drive Folders</h3>
              <button 
                onClick={() => setShowFolderBrowser(false)} 
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {loadingFolders ? (
                <div className="text-center py-8 text-gray-500">Loading folders...</div>
              ) : availableFolders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No folders found</div>
              ) : (
                availableFolders.map(folder => (
                  <label key={folder.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFolderIds.has(folder.id)}
                      onChange={(e) => {
                        const newIds = new Set(selectedFolderIds)
                        if (e.target.checked) {
                          newIds.add(folder.id)
                        } else {
                          newIds.delete(folder.id)
                        }
                        setSelectedFolderIds(newIds)
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-violet-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-900">{folder.name}</span>
                  </label>
                ))
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
