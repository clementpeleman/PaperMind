import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDFUrl, isPDFContentType, validateExtractedText } from '@/lib/pdf-extractor';

const ZOTERO_API_BASE_URL = process.env.ZOTERO_API_BASE_URL || 'https://api.zotero.org';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemKey: string }> }
) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');
  const libraryType = searchParams.get('libraryType') || 'user';
  const libraryId = searchParams.get('libraryId') || userId;

  if (!token || !userId) {
    return NextResponse.json({ error: 'Missing token or userId' }, { status: 400 });
  }

  const resolvedParams = await params;
  if (!resolvedParams.itemKey) {
    return NextResponse.json({ error: 'Missing itemKey' }, { status: 400 });
  }

  try {
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'PaperMind/1.0',
    };

    // Fetch all children (attachments, notes) for the specific item
    const attachmentsUrl = `${ZOTERO_API_BASE_URL}/${libraryType}s/${libraryId}/items/${resolvedParams.itemKey}/children`;
    console.log(`📎 Fetching attachments for ${resolvedParams.itemKey} from: ${attachmentsUrl}`);
    
    const attachmentsResponse = await fetch(attachmentsUrl, {
      headers: authHeaders,
    });

    if (!attachmentsResponse.ok) {
      console.error(`❌ Zotero API error: ${attachmentsResponse.status} ${attachmentsResponse.statusText}`);
      throw new Error(`Zotero API error: ${attachmentsResponse.status} ${attachmentsResponse.statusText}`);
    }

    const children = await attachmentsResponse.json();
    
    // Filter for PDF and other text-based attachments
    const textAttachments = children.filter((child: any) => 
      child.data.itemType === 'attachment' && 
      (isPDFContentType(child.data.contentType) || 
       child.data.contentType?.includes('text/'))
    );

    if (textAttachments.length === 0) {
      return NextResponse.json({ 
        attachments: [], 
        message: 'No text-based attachments found' 
      });
    }

    // For each attachment, try to get the full text content
    const attachmentsWithContent = await Promise.all(
      textAttachments.map(async (attachment: any) => {
        try {
          // Try to fetch the file content from Zotero
          const fileUrl = `${ZOTERO_API_BASE_URL}/${libraryType}s/${libraryId}/items/${attachment.key}/file`;
          
          let fullText = '';
          let hasFullText = false;
          let textQuality = null;

          if (isPDFContentType(attachment.data.contentType)) {
            try {
              console.log(`📄 Attempting PDF extraction for ${attachment.key} from: ${fileUrl}`);
              fullText = await extractTextFromPDFUrl(fileUrl, authHeaders);
              textQuality = validateExtractedText(fullText);
              hasFullText = textQuality.isValid;
              console.log(`✅ PDF extracted: ${textQuality.wordCount} words, ${textQuality.estimatedPages} pages`);
            } catch (error) {
              console.error(`❌ PDF extraction failed for ${attachment.key}:`, error);
              fullText = `[PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
              hasFullText = false;
            }
          } else {
            // For other text-based files, try direct fetch
            try {
              const fileResponse = await fetch(fileUrl, {
                headers: authHeaders,
              });
              if (fileResponse.ok) {
                fullText = await fileResponse.text();
                textQuality = validateExtractedText(fullText);
                hasFullText = textQuality.isValid;
              }
            } catch (error) {
              console.log(`Could not fetch text content for ${attachment.key}:`, error);
            }
          }

          return {
            key: attachment.key,
            title: attachment.data.title,
            filename: attachment.data.filename,
            contentType: attachment.data.contentType,
            hasFullText,
            url: attachment.data.url,
            dateAdded: attachment.data.dateAdded,
            dateModified: attachment.data.dateModified,
            fullText: hasFullText ? fullText : '',
            textQuality: textQuality ? {
              wordCount: textQuality.wordCount,
              estimatedPages: textQuality.estimatedPages,
              isValid: textQuality.isValid
            } : null
          };
        } catch (error) {
          console.error(`Error processing attachment ${attachment.key}:`, error);
          return {
            key: attachment.key,
            title: attachment.data.title,
            filename: attachment.data.filename,
            contentType: attachment.data.contentType,
            hasFullText: false,
            fullText: '',
            error: 'Failed to access attachment content'
          };
        }
      })
    );

    return NextResponse.json({ 
      attachments: attachmentsWithContent,
      total: attachmentsWithContent.length 
    });

  } catch (error) {
    console.error('Error fetching Zotero attachments:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch attachments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}