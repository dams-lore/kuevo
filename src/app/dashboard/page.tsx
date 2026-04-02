import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'
import OnboardingModal from '@/components/dashboard/OnboardingModal'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // Check if user has created any pages
  const { count: pageCount } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  console.log('[dashboard] user has', pageCount, 'pages')

  // Show onboarding only if user has 0 pages (brand new user)
  const showOnboarding = pageCount === 0

  return (
    <>
      <DashboardClient showOnboarding={showOnboarding} />
      <OnboardingModal show={showOnboarding} />
    </>
  )
}
