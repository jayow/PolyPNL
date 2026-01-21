import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Validate URL to prevent abuse
  try {
    new URL(url);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    console.log('[Image Proxy] Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
      },
    });

    if (!response.ok) {
      console.error('[Image Proxy] Fetch failed:', response.status);
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'image/png';
    
    console.log('[Image Proxy] Success:', contentType, buffer.byteLength, 'bytes');
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return new NextResponse('Failed to fetch image', { status: 500 });
  }
}
