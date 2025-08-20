import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}?error=${encodeURIComponent('Missing OAuth parameters')}`
      );
    }

    // Handle Zotero OAuth 1.0a callback - this is called after user approves
    // We need to exchange the verifier for an access token
    console.log('Processing Zotero OAuth callback with token:', oauthToken);

    // This should redirect to the main Zotero route which handles token exchange
    const callbackUrl = new URL('/api/auth/zotero', request.nextUrl.origin);
    callbackUrl.searchParams.set('oauth_token', oauthToken);
    callbackUrl.searchParams.set('oauth_verifier', oauthVerifier);

    return NextResponse.redirect(callbackUrl.toString());

  } catch (error) {
    console.error('Zotero callback error:', error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}?error=${encodeURIComponent('Authentication failed')}`
    );
  }
}
