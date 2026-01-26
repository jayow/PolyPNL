import { NextRequest, NextResponse } from 'next/server';
import { fetchUserActivity } from '@/lib/api-client';
import { activitiesQuerySchema, validateQueryParams } from '@/lib/validation';
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
      validatedParams = validateQueryParams(activitiesQuerySchema, searchParams);
    } catch (validationError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input'
        },
        { status: 400 }
      );
    }

    const userAddress = validatedParams.user;
    const conditionId = validatedParams.conditionId;
    const outcome = validatedParams.outcome;
    const openedAt = validatedParams.openedAt;
    const closedAt = validatedParams.closedAt;

    console.log(`[API /activities] Fetching activities for user: ${userAddress}, conditionId: ${conditionId}, outcome: ${outcome}`);
    console.log(`[API /activities] Time range: ${openedAt} to ${closedAt || 'now'}`);

    // Fetch ALL activities for the user WITHOUT type filter first
    // The API might return more activities when we don't filter by type
    // Then we'll filter client-side
    const activities = await fetchUserActivity(userAddress, {
      // Don't pass type filter - fetch ALL activity types
      sortBy: 'TIMESTAMP',
      sortDirection: 'ASC',
      limit: 10000, // Higher limit to get all activities
    });
    
    console.log(`[API /activities] Fetched ${activities.length} total activities from API`);
    console.log(`[API /activities] Activity types found:`, [...new Set(activities.map(a => a.type))]);

    // Parse time range if provided
    // Extend closeTime by 1 day to catch REDEEM activities that happen after the last SELL
    // REDEEM often happens after market resolution, which can be after the last trade
    const openTime = openedAt ? new Date(openedAt).getTime() : null;
    const closeTime = closedAt ? new Date(closedAt).getTime() + (24 * 60 * 60 * 1000) : Date.now(); // Add 1 day buffer

    // Filter activities very inclusively - prioritize time range matching
    // Include ALL activities that happened during the position's lifetime
    // This ensures we catch SELL, REDEEM, and all other activities
    const filteredActivities = activities.filter(activity => {
      const activityTimestamp = typeof activity.timestamp === 'number' 
        ? activity.timestamp * 1000 // Convert seconds to ms
        : new Date(activity.timestamp).getTime();
      
      const activityOutcome = activity.outcome || 
                             (activity.outcomeIndex !== undefined ? activity.outcomeIndex.toString() : '0') ||
                             (activity.asset ? activity.asset.split(':')[1] : '0');
      
      // Check if activity is within the position's time range
      const inTimeRange = openTime && (activityTimestamp >= openTime && activityTimestamp <= closeTime);
      
      // First priority: Exact match on conditionId and outcome
      const conditionIdMatch = activity.conditionId === conditionId;
      const outcomeMatch = activityOutcome === outcome || 
                         activityOutcome === outcome.toString() || 
                         outcome === activityOutcome.toString();
      const exactMatch = conditionIdMatch && outcomeMatch;
      
      // For TRADE activities
      if (activity.type === 'TRADE') {
        // Include if:
        // 1. Exact match (conditionId + outcome), OR
        // 2. conditionId matches and in time range, OR
        // 3. Just in time range (captures all trades during position lifetime)
        return exactMatch || (conditionIdMatch && inTimeRange) || inTimeRange;
      } else {
        // For non-trade activities (REDEEM, SPLIT, MERGE, REWARD, CONVERSION, MAKER_REBATE):
        // Include if conditionId matches OR if it's in the time range
        // This catches all redeems/claims/rewards that happened during the position's lifetime
        // even if they don't have exact conditionId match (market-wide actions)
        return conditionIdMatch || (inTimeRange && openTime);
      }
    });
    
    // Log what we're including/excluding for debugging
    const tradeCount = filteredActivities.filter(a => a.type === 'TRADE').length;
    const redeemCount = filteredActivities.filter(a => a.type === 'REDEEM').length;
    const otherCount = filteredActivities.filter(a => a.type !== 'TRADE' && a.type !== 'REDEEM').length;
    console.log(`[API /activities] Filtered activities: ${tradeCount} trades, ${redeemCount} redeems, ${otherCount} other`);
    
    // Log sample of activities for debugging
    if (activities.length > 0) {
      console.log(`[API /activities] Sample activities (first 5):`, activities.slice(0, 5).map(a => ({
        type: a.type,
        conditionId: a.conditionId,
        outcome: a.outcome,
        timestamp: a.timestamp,
        side: a.side,
      })));
    }
    
    // Log filtered activities for debugging
    if (filteredActivities.length > 0) {
      console.log(`[API /activities] Filtered activities sample:`, filteredActivities.map(a => ({
        type: a.type,
        conditionId: a.conditionId,
        outcome: a.outcome,
        timestamp: a.timestamp,
        side: a.side,
      })));
    }

    console.log(`[API /activities] Found ${filteredActivities.length} activities for position (from ${activities.length} total)`);

    return NextResponse.json({
      activities: filteredActivities,
      count: filteredActivities.length,
    });
  } catch (error) {
    console.error('Error in /api/activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
