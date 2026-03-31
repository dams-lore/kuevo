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
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', session.user.id)
    .single()

  const showOnboarding = !profile?.onboarding_completed

  return (
    <>
      <DashboardClient showOnboarding={showOnboarding} />
      <OnboardingModal show={showOnboarding} />
    </>
  )
}
