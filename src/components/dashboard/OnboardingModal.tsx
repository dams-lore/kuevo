'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface OnboardingModalProps {
  show: boolean
}

export default function OnboardingModal({ show }: OnboardingModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(show)

  useEffect(() => {
    setIsOpen(show)
  }, [show])

  if (!isOpen) {
    return null
  }

  const handleSkip = () => {
    setIsOpen(false)
  }

  const handleGoToSettings = () => {
    router.push('/settings')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Overlay */}
      <div 
        className="absolute inset-0 pointer-events-auto"
        style={{ backgroundColor: 'rgba(15, 10, 46, 0.5)' }}
      />

      {/* Modal Card */}
      <div 
        className="relative pointer-events-auto max-w-[480px] mx-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.97)',
          border: '1px solid rgba(124,58,237,0.15)',
          borderRadius: '20px',
          padding: '40px',
        }}
      >
        <h2 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Syne' }}>
          👋 Welcome to Kuevo!
        </h2>

        <p 
          className="text-gray-600 text-base leading-relaxed mb-8"
          style={{ fontFamily: 'DM Sans' }}
        >
          Before creating your first page, connect your content sources so Kuevo can automatically find the right files.
        </p>

        {/* Sources List */}
        <div className="space-y-3 mb-8">
          {[
            '→ Connect Google Drive',
            '→ Connect Gmail',
            '→ Add your website URL',
            '→ Add your blog or LinkedIn',
          ].map((item, i) => (
            <p key={i} className="text-gray-700 text-sm" style={{ fontFamily: 'DM Sans' }}>
              {item}
            </p>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <button
            onClick={handleGoToSettings}
            className="flex-1 px-6 py-3 font-semibold text-white rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: '#7C3AED' }}
          >
            Go to Settings →
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-3 font-medium rounded-lg transition-colors hover:opacity-80"
            style={{ color: '#8B7BAE' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
