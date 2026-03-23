import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kuevo — Share the right docs, at the right time',
  description:
    'Kuevo connects your Google Drive, Gmail and SharePoint to automatically assemble a branded, tracked sharing page — zero upload, zero effort.',
  metadataBase: new URL('https://kuevo.io'),
  openGraph: {
    title: 'Kuevo — Share the right docs, at the right time',
    description:
      'Kuevo connects your Google Drive, Gmail and SharePoint to automatically assemble a branded, tracked sharing page — zero upload, zero effort.',
    url: 'https://kuevo.io',
    siteName: 'Kuevo',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-inter antialiased bg-white text-slate-900">
        {children}
      </body>
    </html>
  )
}
