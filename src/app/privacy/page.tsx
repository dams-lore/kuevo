export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-slate-500">Last updated: April 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-12">
          {/* Data Collection */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">What Data Kuevo Collects</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Kuevo collects the following data to provide its services:
            </p>
            <ul className="list-disc list-inside space-y-3 text-slate-600 ml-2">
              <li><strong>Email address</strong> — Your email from your Kuevo account</li>
              <li><strong>Gmail metadata</strong> — Email subjects and snippets only (full email bodies are never stored)</li>
              <li><strong>Google Drive information</strong> — File names and URLs only (file contents are not stored permanently)</li>
            </ul>
          </section>

          {/* Data Usage */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">How Your Data Is Used</h2>
            <p className="text-slate-600 leading-relaxed">
              Kuevo uses your data exclusively to generate personalized sharing pages and help you find relevant content from your email and Drive. 
              Your data is <strong>never sold, shared, or disclosed to third parties</strong>. It is used only for the specific purpose of powering your Kuevo experience.
            </p>
          </section>

          {/* Google API Usage */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Google API Usage</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Kuevo uses the following Google APIs on your behalf:
            </p>
            <ul className="list-disc list-inside space-y-3 text-slate-600 ml-2">
              <li><strong>Gmail API (read-only)</strong> — To fetch email subjects and snippets for context analysis</li>
              <li><strong>Google Drive API (read-only)</strong> — To search and retrieve file names and URLs</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              All API calls are processed in real-time. Email snippets and Drive metadata are analyzed but never permanently stored on our servers.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Data Retention</h2>
            <ul className="list-disc list-inside space-y-3 text-slate-600 ml-2">
              <li><strong>OAuth tokens</strong> — Stored securely in an encrypted database to maintain your Google connection</li>
              <li><strong>Email/Drive metadata</strong> — Processed in real-time and not permanently stored</li>
              <li><strong>Sharing page analytics</strong> — Engagement data (opens, clicks) retained for reporting purposes</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              You can disconnect your Google account at any time from Settings, which will revoke all API access and delete your stored tokens.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Questions or Concerns?</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about how we handle your data, please contact us at{' '}
              <a href="mailto:team@kuevo.io" className="text-violet-600 hover:text-violet-700 font-medium">
                team@kuevo.io
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>© 2026 Kuevo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
