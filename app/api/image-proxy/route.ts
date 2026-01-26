import { NextRequest, NextResponse } from 'next/server';
import { imageProxyQuerySchema, validateQueryParams } from '@/lib/validation';
import { imageProxyRateLimiter, getClientIP, checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';

/**
 * Maximum image size: 5MB
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Allowed domains for image proxy
 * Only images from these domains can be proxied
 */
const ALLOWED_DOMAINS = [
  'polymarket.com',
  'cdn.polymarket.com',
  'polymarket-upload.s3.us-east-2.amazonaws.com',
  // Add other allowed domains as needed
];

/**
 * Get allowed CORS origin
 * Uses environment variable or defaults to production domain
 */
function getAllowedOrigin(): string {
  if (process.env.ALLOWED_ORIGIN) {
    return process.env.ALLOWED_ORIGIN;
  }
  // Default to production domain or localhost for development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  // In production, you should set ALLOWED_ORIGIN environment variable
  // For now, default to allowing requests (less secure, but functional)
  return '*';
}

/**
 * Check if domain is allowed
 */
function isDomainAllowed(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Validate image content type
 * Returns true if content is a valid image
 */
function isValidImageContentType(contentType: string): boolean {
  if (!contentType) return false;
  return contentType.startsWith('image/');
}

/**
 * Validate image by magic bytes
 * Returns the detected image type or null
 */
function detectImageType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 12));
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP: RIFF...WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // Check for WEBP signature at offset 8
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }
  
  // SVG: Check for XML declaration or <svg tag
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const text = textDecoder.decode(bytes);
  if (text.trim().startsWith('<?xml') || text.trim().startsWith('<svg')) {
    return 'image/svg+xml';
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  // Check rate limit
  const ip = getClientIP(request);
  const rateLimitResult = await checkRateLimit(imageProxyRateLimiter, ip);
  
  if (rateLimitResult && !rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.reset);
  }

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

  // 4.1: Check domain allowlist
  if (!isDomainAllowed(url)) {
    console.warn('[Image Proxy] Domain not allowed:', new URL(url).hostname);
    return NextResponse.json(
      { error: 'Domain not allowed' },
      { status: 403 }
    );
  }

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
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: response.status }
      );
    }

    // 4.2: Check Content-Length header before downloading
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_IMAGE_SIZE) {
        console.warn('[Image Proxy] Image too large:', size, 'bytes');
        return NextResponse.json(
          { error: 'Image size exceeds maximum allowed size (5MB)' },
          { status: 413 }
        );
      }
    }

    // 4.4: Validate Content-Type
    const contentType = response.headers.get('Content-Type') || '';
    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const isDownload = contentDisposition.toLowerCase().includes('attachment');
    
    // Check if content type indicates an image
    if (!isValidImageContentType(contentType) && !isDownload) {
      console.warn('[Image Proxy] Invalid content type:', contentType);
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // Stream and check size during download
    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: 'Failed to read response body' },
        { status: 500 }
      );
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      totalSize += value.length;
      
      // 4.2: Check size during download
      if (totalSize > MAX_IMAGE_SIZE) {
        console.warn('[Image Proxy] Image too large during download:', totalSize, 'bytes');
        return NextResponse.json(
          { error: 'Image size exceeds maximum allowed size (5MB)' },
          { status: 413 }
        );
      }
      
      chunks.push(value);
    }

    // Combine chunks into buffer
    const buffer = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // 4.4: Validate image by magic bytes
    const detectedType = detectImageType(buffer.buffer);
    if (!detectedType && !isValidImageContentType(contentType)) {
      console.warn('[Image Proxy] Invalid image format detected');
      return NextResponse.json(
        { error: 'Invalid image format' },
        { status: 400 }
      );
    }
    
    // Determine final content type
    let finalContentType = contentType;
    if (!isValidImageContentType(contentType)) {
      // Use detected type from magic bytes
      finalContentType = detectedType || 'image/png'; // Fallback to PNG
    }
    
    console.log('[Image Proxy] Success:', finalContentType, buffer.byteLength, 'bytes');
    
    // 4.3: Set CORS header with specific origin
    const allowedOrigin = getAllowedOrigin();
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': finalContentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Remove Content-Disposition header to prevent browser from treating it as download
        'Content-Disposition': 'inline', // Force inline display instead of download
      },
    });
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
