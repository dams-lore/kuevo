import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'
import OnboardingModal from '@/components/dashboard/OnboardingModal'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Get onboarding status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('id', session.user.id)
    .single()

  // Show onboarding if: profile doesn't exist OR onboarding_completed is false or null
  const showOnboarding = !profile || profile.onboarding_completed === false || profile.onboarding_completed === null

  return (
    <>
      <DashboardClient showOnboarding={showOnboarding} />
      <OnboardingModal show={showOnboarding} />
    </>
  )
}
