'use client'

interface BlockLinkProps {
  pageId: string
  blockId: string
  title: string
  url: string
  domain: string
}

export default function BlockLink({ pageId, blockId, title, url, domain }: BlockLinkProps) {
  function handleClick() {
    const visitorId = localStorage.getItem('kuevo_visitor_id') || ''
    fetch('/api/track/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_id: pageId, block_id: blockId, visitor_id: visitorId }),
    }).catch(() => {})
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="block group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/50 rounded-2xl p-5 transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold group-hover:text-violet-300 transition">{title}</h3>
          <p className="text-slate-400 text-sm mt-0.5">{domain}</p>
        </div>
        <span className="text-slate-400 group-hover:text-violet-400 transition text-sm font-medium">
          View →
        </span>
      </div>
    </a>
  )
}
