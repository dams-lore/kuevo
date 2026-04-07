import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.HUBSPOT_CLIENT_ID
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://kuevo.io'}/api/auth/hubspot/callback`
  const scopes = ['crm.objects.contacts.read', 'crm.objects.notes.write']

  console.log('[hubspot/auth] clientId:', clientId?.substring(0, 10) + '***')
  console.log('[hubspot/auth] redirect_uri:', redirectUri)
  console.log('[hubspot/auth] scopes:', scopes.join(' '))

  if (!clientId) {
    console.error('[hubspot/auth] HUBSPOT_CLIENT_ID not configured')
    return NextResponse.json({ error: 'HubSpot client ID not configured' }, { status: 500 })
  }

  // Use EU region if needed (check HubSpot portal region)
  // For EU accounts, use https://app-eu1.hubspot.com/oauth/authorize
  const authUrl = new URL('https://app-eu1.hubspot.com/oauth/authorize')
  authUrl.searchParams.append('client_id', clientId)
  authUrl.searchParams.append('redirect_uri', redirectUri)
  authUrl.searchParams.append('scope', scopes.join(' '))

  console.log('[hubspot/auth] redirecting to:', authUrl.toString().substring(0, 100) + '...')

  return NextResponse.redirect(authUrl.toString())
}
