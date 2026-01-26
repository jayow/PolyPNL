import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Screenshot API - Temporarily disabled during build
 * Puppeteer causes build-time issues with Next.js
 * 
 * To re-enable:
 * 1. Move app/api/screenshot.disabled back to app/api/screenshot
 * 2. Consider using html-to-image or a separate service instead of Puppeteer
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Screenshot service is currently unavailable',
    code: 'SERVICE_DISABLED',
    message: 'This feature is temporarily disabled. Please use the share card image generation instead.'
  }, { status: 503 });
}
