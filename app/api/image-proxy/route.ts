import { NextRequest, NextResponse } from 'next/server';
import { imageProxyQuerySchema, validateQueryParams } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Validate query parameters using Zod
  let validatedParams;
  try {
    validatedParams = validateQueryParams(imageProxyQuerySchema, searchParams);
  } catch (validationError) {
    return NextResponse.json(
      { 
        error: 'Validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid URL format'
      },
      { status: 400 }
    );
  }

  const url = validatedParams.url;

  try {
    console.log('[Image Proxy] Fetching:', url);
    
    // Follow redirects and handle download links
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
        'Accept': 'image/*,*/*;q=0.8', // Prefer images, but accept other types
      },
      redirect: 'follow', // Explicitly follow redirects
    });

    if (!response.ok) {
      console.error('[Image Proxy] Fetch failed:', response.status);
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    // Check if the response is actually an image
    const contentType = response.headers.get('Content-Type') || '';
    const contentDisposition = response.headers.get('Content-Disposition') || '';
    
    // If Content-Disposition indicates a download, we can still serve it if it's an image
    const isDownload = contentDisposition.toLowerCase().includes('attachment');
    const isImage = contentType.startsWith('image/') || 
                   (!contentType && !isDownload); // If no content-type and not explicitly a download, assume it might be an image
    
    if (!isImage && !isDownload) {
      console.warn('[Image Proxy] Response is not an image:', contentType);
      // Still try to serve it - might be an image without proper content-type
    }

    const buffer = await response.arrayBuffer();
    
    // Determine content type - use response type or infer from buffer
    let finalContentType = contentType;
    if (!finalContentType || !finalContentType.startsWith('image/')) {
      // Try to infer from buffer (check magic bytes)
      const bytes = new Uint8Array(buffer.slice(0, 4));
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        finalContentType = 'image/jpeg';
      } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        finalContentType = 'image/png';
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        finalContentType = 'image/gif';
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        finalContentType = 'image/webp';
      } else {
        finalContentType = 'image/png'; // Default fallback
      }
    }
    
    console.log('[Image Proxy] Success:', finalContentType, buffer.byteLength, 'bytes', 
                isDownload ? '(from download link)' : '');
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': finalContentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        // Remove Content-Disposition header to prevent browser from treating it as download
        'Content-Disposition': 'inline', // Force inline display instead of download
      },
    });
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return new NextResponse('Failed to fetch image', { status: 500 });
  }
}
