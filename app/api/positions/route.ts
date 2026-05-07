import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet, fetchOpenPositions } from '@/lib/api-client';
import { OpenPosition, OpenPositionsSummary } from '@/types';
import { positionsQuerySchema, validateQueryParams } from '@/lib/validation';
import { pnlRateLimiter, getClientIP, checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimit(pnlRateLimiter, ip);
    if (rateLimitResult && !rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult.reset);
    }

    const searchParams = request.nextUrl.searchParams;

    let validatedParams;
    try {
      validatedParams = validateQueryParams(positionsQuerySchema, searchParams);
    } catch (validationError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input',
        },
        { status: 400 }
      );
    }

    const wallet = validatedParams.wallet;

    const resolveResult = await resolveProxyWallet(wallet);
    const userAddress = resolveResult.userAddressUsed;

    const positions = await fetchOpenPositions(userAddress);
    const summary = computeOpenPositionsSummary(positions);

    return NextResponse.json({
      positions,
      summary,
      resolveResult,
      count: positions.length,
    });
  } catch (error) {
    console.error('Error in /api/positions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch open positions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function computeOpenPositionsSummary(positions: OpenPosition[]): OpenPositionsSummary {
  if (positions.length === 0) {
    return {
      totalCurrentValue: 0,
      totalCostBasis: 0,
      totalUnrealizedPnL: 0,
      totalUnrealizedPnLPercent: 0,
      positionsCount: 0,
      redeemableCount: 0,
    };
  }

  const totalCurrentValue = positions.reduce((s, p) => s + (p.currentValue || 0), 0);
  const totalCostBasis = positions.reduce((s, p) => s + (p.initialValue || 0), 0);
  const totalUnrealizedPnL = positions.reduce((s, p) => s + (p.unrealizedPnL || 0), 0);
  const totalUnrealizedPnLPercent = totalCostBasis > 0
    ? (totalUnrealizedPnL / totalCostBasis) * 100
    : 0;
  const redeemableCount = positions.filter((p) => p.redeemable).length;

  return {
    totalCurrentValue,
    totalCostBasis,
    totalUnrealizedPnL,
    totalUnrealizedPnLPercent,
    positionsCount: positions.length,
    redeemableCount,
  };
}
