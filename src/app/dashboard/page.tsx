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
  let { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  // If profile doesn't exist, create it
  if (profileError && profileError.code === 'PGRST116') {
    console.log('[dashboard] user_profiles row missing for user:', user.id, '- creating...')
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({ id: user.id, onboarding_completed: false })
      .select()
      .single()
    
    if (!insertError) {
      profile = newProfile
    } else {
      console.error('[dashboard] failed to create user_profiles row:', insertError.message)
    }
  }

  // Show onboarding if: profile doesn't exist OR onboarding_completed is false or null
  const showOnboarding = !profile || profile.onboarding_completed === false || profile.onboarding_completed === null

  return (
    <>
      <DashboardClient showOnboarding={showOnboarding} />
      <OnboardingModal show={showOnboarding} />
    </>
  )
}
