import { NextRequest, NextResponse } from 'next/server';

const ZOTERO_API_BASE_URL = process.env.ZOTERO_API_BASE_URL || 'https://api.zotero.org';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');
  const libraryType = searchParams.get('libraryType') || 'user'; // user or group
  const libraryId = searchParams.get('libraryId') || userId;

  if (!token || !userId) {
    return NextResponse.json({ error: 'Missing token or userId' }, { status: 400 });
  }

  try {
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'PaperMind/1.0',
    };

    // Fetch collections from Zotero API
    const collectionsUrl = `${ZOTERO_API_BASE_URL}/${libraryType}s/${libraryId}/collections`;
    const collectionsResponse = await fetch(collectionsUrl, {
      headers: authHeaders,
    });

    const collections: { [key: string]: string } = {};
    if (collectionsResponse.ok) {
      const collectionsData = await collectionsResponse.json();
      // Map collection keys to names
      collectionsData.forEach((collection: any) => {
        collections[collection.key] = collection.data.name;
      });
    }

    // Fetch library items from Zotero API with format=json to get collection membership
    // Only get top-level items (exclude annotations, notes, attachments)
    const itemsUrl = `${ZOTERO_API_BASE_URL}/${libraryType}s/${libraryId}/items/top?format=json&limit=100`;
    const itemsResponse = await fetch(itemsUrl, {
      headers: authHeaders,
    });

    if (!itemsResponse.ok) {
      throw new Error(`Zotero API error: ${itemsResponse.status} ${itemsResponse.statusText}`);
    }

    const items = await itemsResponse.json();
    
    // Transform Zotero items to our Paper format
    interface ZoteroCreator {
      lastName?: string;
      firstName?: string;
    }

    interface ZoteroTag {
      tag: string;
    }

    interface ZoteroItemData {
      itemType: string;
      title?: string;
      creators?: ZoteroCreator[];
      publicationTitle?: string;
      conferenceName?: string;
      websiteTitle?: string;
      blogTitle?: string;
      publisher?: string;
      bookTitle?: string;
      university?: string;
      institution?: string;
      date?: string;
      DOI?: string;
      tags?: ZoteroTag[];
      abstractNote?: string;
      dateAdded?: string;
      url?: string;
      collections?: string[];
    }

    interface ZoteroItem {
      key: string;
      version: number;
      data: ZoteroItemData;
    }

    const papers = (items as ZoteroItem[])
      .filter((item: ZoteroItem) => {
        const validTypes = [
          'journalArticle', 
          'conferencePaper', 
          'preprint',
          'webpage',
          'blogPost',
          'thesis',
          'book',
          'bookSection',
          'report',
          'document',
          'manuscript'
        ];
        return validTypes.includes(item.data.itemType);
      })
      .map((item: ZoteroItem) => {
        const itemType = item.data.itemType;
        
        // Handle different publication sources based on item type
        let publicationSource = 'Unknown';
        if (itemType === 'journalArticle') {
          publicationSource = item.data.publicationTitle || 'Unknown Journal';
        } else if (itemType === 'conferencePaper') {
          publicationSource = item.data.conferenceName || 'Unknown Conference';
        } else if (itemType === 'webpage') {
          let hostname = 'Web';
          if (item.data.url) {
            try {
              hostname = new URL(item.data.url).hostname;
            } catch {
              hostname = 'Web';
            }
          }
          publicationSource = item.data.websiteTitle || item.data.blogTitle || hostname;
        } else if (itemType === 'blogPost') {
          publicationSource = item.data.blogTitle || 'Blog Post';
        } else if (itemType === 'book') {
          publicationSource = item.data.publisher || 'Book';
        } else if (itemType === 'bookSection') {
          publicationSource = item.data.bookTitle || 'Book Section';
        } else if (itemType === 'thesis') {
          publicationSource = item.data.university || 'Thesis';
        } else if (itemType === 'report') {
          publicationSource = item.data.institution || 'Report';
        } else {
          publicationSource = item.data.publicationTitle || item.data.conferenceName || itemType;
        }

        return {
          id: item.key,
          title: item.data.title || 'Untitled',
          authors: item.data.creators?.map((creator: ZoteroCreator) => 
            `${creator.lastName || ''}, ${creator.firstName || ''}`.trim().replace(/^,\s*/, '')
          ) || [],
          journal: publicationSource,
          year: item.data.date ? new Date(item.data.date).getFullYear() : new Date().getFullYear(),
          doi: item.data.DOI || '',
          tags: item.data.tags?.map((tag: { tag: string }) => tag.tag) || [],
          notes: item.data.abstractNote || '',
          dateAdded: item.data.dateAdded || new Date().toISOString(),
          collections: item.data.collections?.map(collectionKey => collections[collectionKey]).filter(Boolean) || [],
          status: 'unread' as const, // Default status
          url: item.data.url || '',
          zoteroKey: item.key,
          zoteroVersion: item.version,
          itemType: itemType, // Add item type for reference
        };
      });

    return NextResponse.json({ papers, total: papers.length });
  } catch (error) {
    console.error('Error fetching Zotero library:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch library',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  // For future: sync changes back to Zotero
  return NextResponse.json({ error: 'Not implemented yet' }, { status: 501 });
}