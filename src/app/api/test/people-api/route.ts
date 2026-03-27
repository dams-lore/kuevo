import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// TEMPORARY DEBUG ROUTE - Tests People API directly
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  console.log('[people-api test] user:', session.user.email)

  // Get integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  console.log('[people-api test] integration found:', !!integration)
  console.log('[people-api test] access_token present:', !!integration?.access_token)

  if (!integration?.access_token) {
    return NextResponse.json({ error: 'No Google integration found' }, { status: 400 })
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://kuevo.io/api/auth/google/callback'
  )
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
  })

  try {
    const peopleApi = google.people({ version: 'v1', auth: oauth2Client })
    
    // Test 1: Search in contacts
    console.log('[people-api test] calling people.searchContacts with query="John"')
    const searchRes = await peopleApi.people.searchContacts({
      query: 'John',
      readMask: 'names,emailAddresses,organizations',
      pageSize: 10,
    })
    console.log('[people-api test] searchContacts response:', JSON.stringify(searchRes.data, null, 2))

    // Test 2: Search in otherContacts
    console.log('[people-api test] calling otherContacts.search with query="John"')
    const otherRes = await peopleApi.otherContacts.search({
      query: 'John',
      readMask: 'names,emailAddresses,organizations',
      pageSize: 10,
    })
    console.log('[people-api test] otherContacts response:', JSON.stringify(otherRes.data, null, 2))

    return NextResponse.json({
      test: 'success',
      searchContacts: {
        results_count: searchRes.data.results?.length || 0,
        raw: searchRes.data,
      },
      otherContacts: {
        results_count: otherRes.data.results?.length || 0,
        raw: otherRes.data,
      },
    })
  } catch (e) {
    console.error('[people-api test] error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : String(e),
      details: e,
    }, { status: 500 })
  }
}
