'use client'

import { useEffect, useRef } from 'react'

interface PageTrackerProps {
  pageId: string
}

export default function PageTracker({ pageId }: PageTrackerProps) {
  const visitIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const visitorIdRef = useRef<string>('')

  useEffect(() => {
    // Get or create visitor ID
    let visitorId = localStorage.getItem('kuevo_visitor_id')
    if (!visitorId) {
      visitorId = crypto.randomUUID()
      localStorage.setItem('kuevo_visitor_id', visitorId)
    }
    visitorIdRef.current = visitorId

    // Track visit
    fetch('/api/track/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_id: pageId, visitor_id: visitorId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.visit_id) visitIdRef.current = data.visit_id
      })
      .catch(() => {})

    // Track time on unload
    const handleUnload = () => {
      if (!visitIdRef.current) return
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      navigator.sendBeacon(
        '/api/track/time',
        JSON.stringify({ visit_id: visitIdRef.current, seconds })
      )
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [pageId])

  return null
}

export function useTrackClick(pageId: string, blockId: string) {
  const handleClick = () => {
    const visitorId = localStorage.getItem('kuevo_visitor_id') || ''
    fetch('/api/track/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_id: pageId, block_id: blockId, visitor_id: visitorId }),
    }).catch(() => {})
  }
  return handleClick
}
