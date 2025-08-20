import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Test if the token is valid by making a simple API call to get user's items
    // We don't actually need the items, just to verify the token works
    const zoteroResponse = await fetch(`https://api.zotero.org/users/${userId}/items?limit=1`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Zotero-API-Version': '3'
      }
    });

    if (!zoteroResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to validate token with Zotero API',
        status: zoteroResponse.status 
      }, { status: zoteroResponse.status });
    }

    // Since Zotero doesn't provide user profile info via API,
    // we'll just return basic info with the user ID
    return NextResponse.json({
      username: null,
      displayName: `Zotero User ${userId}`,
      id: userId
    });
  } catch (error) {
    console.error('Error fetching Zotero user info:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}