'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

interface OnboardingModalProps {
  show: boolean
}

export default function OnboardingModal({ show }: OnboardingModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(show)
  const [step, setStep] = useState(1)

  useEffect(() => {
    setIsOpen(show)
    if (show) {
      setStep(1)
    }
  }, [show])

  if (!isOpen) {
    return null
  }

  const handleSkip = async () => {
    // Dismisses modal - will reappear only if user creates pages then deletes all
    setIsOpen(false)
  }

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      router.push('/settings')
    }
  }

  const handleGoToSettings = () => {
    router.push('/settings')
  }

  const steps = [
    {
      number: 1,
      title: '🔗 Connect Google Account',
      description: 'Enable Kuevo to search your Gmail and Google Drive for relevant content.',
      action: 'Next',
    },
    {
      number: 2,
      title: '📁 Select Drive Folders',
      description: 'Choose which folders Kuevo should scan for content. You can customize this later.',
      action: 'Next',
    },
    {
      number: 3,
      title: '📰 Add Your Blog (Optional)',
      description: 'Link your blog or website so Kuevo can include your articles in sharing pages.',
      action: 'Done',
    },
  ]

  const currentStep = steps[step - 1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Overlay */}
      <div 
        className="absolute inset-0 pointer-events-auto"
        style={{ backgroundColor: 'rgba(15, 10, 46, 0.5)' }}
      />

      {/* Modal Card */}
      <div 
        className="relative pointer-events-auto max-w-[500px] mx-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.97)',
          border: '1px solid rgba(124,58,237,0.15)',
          borderRadius: '20px',
          padding: '40px',
        }}
      >
        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-violet-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Syne' }}>
          {currentStep.title}
        </h2>

        <p 
          className="text-gray-600 text-base leading-relaxed mb-8"
          style={{ fontFamily: 'DM Sans' }}
        >
          {currentStep.description}
        </p>

        {/* Step-specific content */}
        {step === 1 && (
          <div className="mb-8 p-4 bg-violet-50 rounded-lg border border-violet-100">
            <p className="text-sm text-violet-900 font-medium">✓ This enables content auto-fetch from your Drive and Gmail</p>
          </div>
        )}

        {step === 2 && (
          <div className="mb-8 p-4 bg-violet-50 rounded-lg border border-violet-100">
            <p className="text-sm text-violet-900 font-medium">✓ Filter out sensitive folders (invoices, contracts, etc.) in Settings</p>
          </div>
        )}

        {step === 3 && (
          <div className="mb-8 p-4 bg-violet-50 rounded-lg border border-violet-100">
            <p className="text-sm text-violet-900 font-medium">✓ Optional — you can add this anytime in Settings</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 font-semibold text-white rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: '#7C3AED' }}
          >
            {currentStep.action} →
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-3 font-medium rounded-lg transition-colors hover:opacity-80"
            style={{ color: '#8B7BAE' }}
          >
            Skip
          </button>
        </div>

        {/* Step counter */}
        <p className="text-xs text-gray-400 text-center mt-4">Step {step} of 3</p>
      </div>
    </div>
  )
}
