'use client'

import { useState, useRef } from 'react'

// ─── SVG Icons ─────────────────────────────────────────────────────────────

function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}

function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  )
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconCloudOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
    </svg>
  )
}

function IconBrain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .23 2.717-1.07 2.717H3.868c-1.3 0-2.07-1.716-1.07-2.717L4.2 15.3" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

// ─── WaitlistForm ───────────────────────────────────────────────────────────

type FormState = 'idle' | 'loading' | 'success' | 'error'

function WaitlistForm() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName || !email || !teamSize) {
      setErrorMsg('Please fill in all fields.')
      setState('error')
      return
    }
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, email, team_size: teamSize }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setState('error')
      } else {
        setState('success')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
          <IconCheck />
        </div>
        <h3 className="text-2xl font-bold text-slate-900">You&apos;re on the list!</h3>
        <p className="text-slate-500 text-center max-w-sm">
          We&apos;ll reach out as soon as your spot opens up. Keep doing great work in the meantime.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md mx-auto">
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1.5">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            placeholder="Alex"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            disabled={state === 'loading'}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
            Work email
          </label>
          <input
            id="email"
            type="email"
            placeholder="alex@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            disabled={state === 'loading'}
          />
        </div>
      </div>

      <div>
        <label htmlFor="teamSize" className="block text-sm font-medium text-slate-700 mb-1.5">
          Team size
        </label>
        <select
          id="teamSize"
          value={teamSize}
          onChange={e => setTeamSize(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all appearance-none cursor-pointer"
          disabled={state === 'loading'}
        >
          <option value="" disabled>Select team size...</option>
          <option value="1-5">1–5 people</option>
          <option value="6-20">6–20 people</option>
          <option value="20-50">20–50 people</option>
          <option value="50+">50+ people</option>
        </select>
      </div>

      {state === 'error' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {state === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting...
          </span>
        ) : (
          'Get early access →'
        )}
      </button>
    </form>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const formRef = useRef<HTMLDivElement>(null)

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          kuevo
        </span>
        <button
          onClick={scrollToForm}
          className="text-sm font-semibold text-slate-700 hover:text-violet-600 transition-colors"
        >
          Get early access
        </button>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-violet-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-64 h-64 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-sm font-medium mb-8 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            Now accepting early access applications
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-6 animate-fade-in-up animation-delay-100">
            Share the right docs,{' '}
            <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
              at the right time,
            </span>{' '}
            automatically
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-200">
            Kuevo connects your Google Drive, Gmail and SharePoint to automatically assemble a branded,
            tracked sharing page — zero upload, zero effort.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-300">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 text-base"
            >
              Get early access
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

          {/* Social proof hint */}
          <div className="mt-10 flex items-center justify-center gap-3 text-sm text-slate-400 animate-fade-in-up animation-delay-400">
            <div className="flex -space-x-2">
              {['bg-violet-400', 'bg-indigo-400', 'bg-blue-400', 'bg-violet-500'].map((c, i) => (
                <div key={i} className={`w-7 h-7 rounded-full border-2 border-white ${c}`} />
              ))}
            </div>
            <span>Join 200+ sales teams on the waitlist</span>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-violet-600 uppercase tracking-widest">The problem</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">
              Sales follow-up is broken
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              You just had a great call. Now comes the part nobody talks about.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <IconClock />,
                title: 'Hours lost preparing follow-up emails',
                desc: 'Manually attaching files, copy-pasting links, formatting emails after every single call. It adds up.',
                color: 'from-rose-50 to-orange-50',
                border: 'border-rose-100',
                iconBg: 'bg-rose-100 text-rose-600',
              },
              {
                icon: <IconSearch />,
                title: 'The right file, buried somewhere',
                desc: 'Hunting through Drive folders, Slack threads, email chains to find that one deck. Every. Single. Time.',
                color: 'from-amber-50 to-yellow-50',
                border: 'border-amber-100',
                iconBg: 'bg-amber-100 text-amber-600',
              },
              {
                icon: <IconEye />,
                title: 'Did they even open it?',
                desc: 'Sending docs into the void with zero visibility on engagement. Did they look? Did they share it? No idea.',
                color: 'from-blue-50 to-indigo-50',
                border: 'border-blue-100',
                iconBg: 'bg-blue-100 text-blue-600',
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-2xl bg-gradient-to-br ${item.color} border ${item.border} group hover:-translate-y-1 transition-all duration-300`}
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${item.iconBg} mb-5`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-violet-600 uppercase tracking-widest">The solution</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">
              From call to sharing page in{' '}
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                seconds
              </span>
            </h2>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-violet-200 via-indigo-300 to-blue-200" />

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  icon: <IconLink />,
                  title: 'Connect',
                  desc: 'Link your Google Drive, Gmail or SharePoint in one click. No migration, no manual work.',
                  gradient: 'from-violet-500 to-violet-700',
                  glow: 'shadow-violet-500/30',
                },
                {
                  step: '02',
                  icon: <IconSparkles />,
                  title: 'Generate',
                  desc: "Kuevo's AI reads the deal context and assembles the right documents for each prospect automatically.",
                  gradient: 'from-indigo-500 to-indigo-700',
                  glow: 'shadow-indigo-500/30',
                },
                {
                  step: '03',
                  icon: <IconShare />,
                  title: 'Share',
                  desc: 'Send a branded, tracked page. Know exactly who opened what, and when. Follow up with precision.',
                  gradient: 'from-blue-500 to-blue-700',
                  glow: 'shadow-blue-500/30',
                },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center group">
                  <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white shadow-lg ${item.glow} group-hover:scale-110 transition-transform duration-300 mb-6`}>
                    {item.icon}
                    <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-white text-slate-400 border border-slate-100 rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="py-24 px-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-violet-400 uppercase tracking-widest">Why Kuevo</span>
            <h2 className="mt-3 text-4xl font-bold text-white">
              Built different
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <IconCloudOff />,
                title: 'Zero upload',
                desc: 'Your files stay where they are. Kuevo accesses them directly from Drive, Gmail, or SharePoint. No duplication, no migration.',
                accent: 'from-violet-500 to-purple-600',
              },
              {
                icon: <IconBrain />,
                title: 'Contextual AI',
                desc: 'Understands the deal context — the company, the stage, the conversation — to surface the right documents every time.',
                accent: 'from-indigo-500 to-blue-600',
              },
              {
                icon: <IconBell />,
                title: 'Real-time tracking',
                desc: 'Get notified the moment your prospect engages. See what they viewed, for how long, and what they shared.',
                accent: 'from-blue-500 to-cyan-600',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="relative p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/8 hover:border-white/20 transition-all duration-300 group hover:-translate-y-1"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${item.accent} text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capture Form */}
      <section id="waitlist" ref={formRef} className="py-24 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-violet-600 uppercase tracking-widest">Early access</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">
              Be first to{' '}
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                transform
              </span>{' '}
              your follow-up
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              We&apos;re onboarding sales teams in waves. Join the waitlist and we&apos;ll reach out soon.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-violet-50/30 border border-slate-100 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
            <WaitlistForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            No spam, ever. Just a heads-up when your spot opens.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            kuevo
          </span>
          <p className="text-sm text-slate-400">
            kuevo.io &copy; 2026. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
