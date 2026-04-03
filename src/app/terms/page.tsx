export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-slate-500">Last updated: April 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-12">
          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Service Description</h2>
            <p className="text-slate-600 leading-relaxed">
              Kuevo is a content sharing platform designed for sales and customer success teams. It enables users to create 
              branded sharing pages with personalized content from their email and Google Drive, with real-time engagement tracking.
            </p>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">User Responsibilities</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              By using Kuevo, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-3 text-slate-600 ml-2">
              <li>Use the service only for legitimate business purposes</li>
              <li>Be responsible for the content you share through Kuevo</li>
              <li>Ensure you have the right to share any content you include on your sharing pages</li>
              <li>Not use Kuevo to share confidential, proprietary, or sensitive information without proper authorization</li>
              <li>Comply with all applicable laws and regulations in your jurisdiction</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Kuevo is not responsible for any content you choose to share or the consequences thereof.
            </p>
          </section>

          {/* Data Handling */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Data Handling</h2>
            <p className="text-slate-600 leading-relaxed">
              For details on how Kuevo collects, uses, and protects your data, please refer to our{' '}
              <a href="/privacy" className="text-violet-600 hover:text-violet-700 font-medium">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          {/* Service Availability */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Service Availability</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Kuevo is provided on an <strong>as-is basis</strong> with best-effort uptime. While we strive to maintain 
              reliable service, we do not guarantee:
            </p>
            <ul className="list-disc list-inside space-y-3 text-slate-600 ml-2">
              <li>Uninterrupted service availability</li>
              <li>Freedom from errors or bugs</li>
              <li>Specific performance metrics or uptime SLAs</li>
              <li>Permanent data retention beyond what is stated in our Privacy Policy</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Kuevo is not liable for any damages resulting from service interruptions, data loss, or unavailability.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Questions or Disputes?</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about these terms or wish to report a violation, please contact us at{' '}
              <a href="mailto:team@kuevo.io" className="text-violet-600 hover:text-violet-700 font-medium">
                team@kuevo.io
              </a>
            </p>
          </section>

          {/* Modification */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Changes to These Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              Kuevo reserves the right to modify these terms at any time. Continued use of the service constitutes acceptance 
              of the updated terms. We will notify users of significant changes via email or through the application.
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
