'use client'

import { useEffect, useRef } from 'react'

interface PageTrackerProps {
  pageId: string
  hubspotContactId?: string
  pageName?: string
}

export default function PageTracker({ pageId, hubspotContactId, pageName }: PageTrackerProps) {
  const visitIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const visitorIdRef = useRef<string>('')
  const clickCountRef = useRef<number>(0)

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

    // Track time on unload and send to HubSpot if connected
    const handleUnload = () => {
      if (!visitIdRef.current) return
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      navigator.sendBeacon(
        '/api/track/time',
        JSON.stringify({ visit_id: visitIdRef.current, seconds })
      )

      // Send engagement to HubSpot if contact is linked
      if (hubspotContactId) {
        navigator.sendBeacon(
          '/api/hubspot/send-engagement',
          JSON.stringify({
            pageId,
            hubspotContactId,
            pageName: pageName || 'Kuevo Page',
            opens: 1,
            clicks: clickCountRef.current,
            timeSpent: seconds * 1000,
          })
        )
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [pageId, hubspotContactId, pageName])

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
    
    // Increment click counter for HubSpot engagement
    if (typeof window !== 'undefined') {
      const counter = sessionStorage.getItem('kuevo_clicks') || '0'
      sessionStorage.setItem('kuevo_clicks', String(parseInt(counter) + 1))
    }
  }
  return handleClick
}
