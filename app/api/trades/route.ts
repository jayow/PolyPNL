import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet, fetchAllTrades, normalizeTrade, enrichTradesWithMetadata } from '@/lib/api-client';
import { NormalizedTrade } from '@/types';
import { tradesQuerySchema, validateQueryParams } from '@/lib/validation';
import { defaultRateLimiter, getClientIP, checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimit(defaultRateLimiter, ip);
    
    if (rateLimitResult && !rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult.reset);
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Validate query parameters using Zod
    let validatedParams;
    try {
      validatedParams = validateQueryParams(tradesQuerySchema, searchParams);
    } catch (validationError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input'
        },
        { status: 400 }
      );
    }

    // Resolve proxy wallet first
    const resolveResult = await resolveProxyWallet(validatedParams.wallet);
    const userAddress = resolveResult.userAddressUsed;

    // Fetch all trades
    const rawTrades = await fetchAllTrades(userAddress, validatedParams.start || undefined, validatedParams.end || undefined);

    // Normalize trades
    const normalizedTrades: NormalizedTrade[] = rawTrades.map(trade =>
      normalizeTrade(trade, userAddress)
    );

    // Enrich with metadata
    const enrichedTrades = await enrichTradesWithMetadata(normalizedTrades);

    return NextResponse.json({
      trades: enrichedTrades,
      resolveResult,
      count: enrichedTrades.length,
    });
  } catch (error) {
    console.error('Error in /api/trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
