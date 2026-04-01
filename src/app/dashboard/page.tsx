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

  // Get onboarding status
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  console.log('[dashboard] onboarding check - user.id:', user.id, 'profile:', profile, 'error:', profileError?.message)

  // Show onboarding if: profile doesn't exist OR onboarding_completed is false
  const showOnboarding = profile === null || profile?.onboarding_completed === false

  return (
    <>
      <DashboardClient showOnboarding={showOnboarding} />
      <OnboardingModal show={showOnboarding} />
    </>
  )
}
