import { NextRequest, NextResponse } from 'next/server';
import { resolveUsernameToWallet } from '@/lib/api-client';
import { resolveUsernameQuerySchema, validateQueryParams } from '@/lib/validation';
import { resolveUsernameRateLimiter, getClientIP, checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimit(resolveUsernameRateLimiter, ip);
    
    if (rateLimitResult && !rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult.reset);
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Validate query parameters using Zod
    let validatedParams;
    try {
      validatedParams = validateQueryParams(resolveUsernameQuerySchema, searchParams);
    } catch (validationError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input'
        },
        { status: 400 }
      );
    }

    const result = await resolveUsernameToWallet(validatedParams.username);

    if (!result.walletAddress) {
      return NextResponse.json(
        { error: `Could not resolve username "${username}" to a wallet address` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/resolve-username:', error);
    return NextResponse.json(
      { error: 'Failed to resolve username' },
      { status: 500 }
    );
  }
}
