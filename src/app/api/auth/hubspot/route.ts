import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_HUBSPOT_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://kuevo.io'}/api/auth/hubspot/callback`
  const scopes = ['crm.objects.contacts.read', 'crm.objects.notes.write']

  if (!clientId) {
    return NextResponse.json({ error: 'HubSpot client ID not configured' }, { status: 500 })
  }

  const authUrl = new URL('https://app.hubapi.com/oauth/authorize')
  authUrl.searchParams.append('client_id', clientId)
  authUrl.searchParams.append('redirect_uri', redirectUri)
  authUrl.searchParams.append('scope', scopes.join(' '))

  return NextResponse.redirect(authUrl.toString())
}
