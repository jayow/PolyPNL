import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet, fetchUserConversionActivities } from '@/lib/api-client';
import { positionsQuerySchema, validateQueryParams } from '@/lib/validation';
import { defaultRateLimiter, getClientIP, checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimit(defaultRateLimiter, ip);
    if (rateLimitResult && !rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult.reset);
    }

    let validatedParams;
    try {
      validatedParams = validateQueryParams(positionsQuerySchema, request.nextUrl.searchParams);
    } catch (validationError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input',
        },
        { status: 400 }
      );
    }

    const resolveResult = await resolveProxyWallet(validatedParams.wallet);
    const userAddress = resolveResult.userAddressUsed;

    const activities = await fetchUserConversionActivities(userAddress, [
      'CONVERSION',
      'REDEEM',
    ]);

    const counts = {
      CONVERSION: activities.filter((a) => a.type === 'CONVERSION').length,
      REDEEM: activities.filter((a) => a.type === 'REDEEM').length,
      total: activities.length,
    };

    return NextResponse.json({
      activities,
      counts,
      resolveResult,
    });
  } catch (error) {
    console.error('Error in /api/conversions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch conversion activities',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
