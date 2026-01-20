import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet, fetchClosedPositions, fetchAllTrades, fetchUserActivity, normalizeTrade, enrichTradesWithMetadata } from '@/lib/api-client';
import { FIFOPnLEngine } from '@/lib/pnl-engine';
import { ClosedPosition, PositionSummary } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const method = searchParams.get('method') || 'fifo'; // fifo or avg

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    // Resolve proxy wallet first
    console.log(`[API /pnl] Resolving proxy wallet for: ${wallet}`);
    const resolveResult = await resolveProxyWallet(wallet);
    const userAddress = resolveResult.userAddressUsed;
    console.log(`[API /pnl] Using address: ${userAddress} (proxy found: ${resolveResult.proxyWalletFound})`);

    // Try to fetch closed positions directly from Polymarket API (much more efficient!)
    // Fetch entire history (no date filtering)
    console.log(`[API /pnl] Attempting to fetch closed positions from Polymarket API (entire history)...`);
    let closedPositions: ClosedPosition[] = [];
    let tradesCount = 0;

    try {
      closedPositions = await fetchClosedPositions(
        userAddress,
        undefined, // No start date - get entire history
        undefined, // No end date - get entire history
        1000 // Limit to 1000 positions max
      );
      console.log(`[API /pnl] Fetched ${closedPositions.length} closed positions from API`);
      
      // If API doesn't work, fall back to computing from trades
      if (closedPositions.length === 0) {
        throw new Error('No closed positions from API, falling back to trade computation');
      }

      // Enhance positions with accurate open times and trade counts from user activity
      // The closed-positions API doesn't provide open times or trade counts, so we use the activity API
      console.log(`[API /pnl] Enhancing positions with open times and trade counts from user activity...`);
      try {
        // Fetch all TRADE activities (both BUY and SELL) to get:
        // 1. First BUY timestamp for each position (for holding time)
        // 2. Total trade count for each position
        const allTradeActivities = await fetchUserActivity(userAddress, {
          type: ['TRADE'],
          sortBy: 'TIMESTAMP',
          sortDirection: 'ASC',
          limit: 10000, // Higher limit to get all trades for accurate counts
        });
        console.log(`[API /pnl] Fetched ${allTradeActivities.length} trade activities for enhancement`);
        
        if (allTradeActivities.length > 0) {
          // Create maps for first BUY times and trade counts
          const firstBuyTimes = new Map<string, string>();
          const tradeCounts = new Map<string, number>();
          
          for (const activity of allTradeActivities) {
            // Extract outcome from activity (could be outcome, outcomeIndex, or asset)
            const outcome = activity.outcome || 
                          (activity.outcomeIndex !== undefined ? activity.outcomeIndex.toString() : '0') ||
                          (activity.asset ? activity.asset.split(':')[1] : '0');
            const conditionId = activity.conditionId;
            
            if (!conditionId) continue;
            
            const key = `${conditionId}:${outcome}`;
            
            // Count all trades for this position (BUY and SELL)
            tradeCounts.set(key, (tradeCounts.get(key) || 0) + 1);
            
            // Track first BUY timestamp (for holding time calculation)
            if (activity.side === 'BUY' && !firstBuyTimes.has(key)) {
              // Convert timestamp to ISO string if it's a number
              const timestamp = typeof activity.timestamp === 'number' 
                ? new Date(activity.timestamp * 1000).toISOString() // API returns seconds, convert to ms
                : activity.timestamp;
              firstBuyTimes.set(key, timestamp);
            }
          }

          // Update closed positions with accurate open times and trade counts
          let enhancedTimeCount = 0;
          let enhancedTradeCount = 0;
          closedPositions = closedPositions.map(pos => {
            const key = `${pos.conditionId}:${pos.outcome}`;
            const firstBuyTime = firstBuyTimes.get(key);
            const tradeCount = tradeCounts.get(key);
            
            const updates: Partial<ClosedPosition> = {};
            
            if (firstBuyTime) {
              updates.openedAt = firstBuyTime;
              enhancedTimeCount++;
            }
            
            if (tradeCount !== undefined) {
              updates.tradesCount = tradeCount;
              enhancedTradeCount++;
            }
            
            if (Object.keys(updates).length > 0) {
              return { ...pos, ...updates };
            }
            return pos;
          });
          
          console.log(`[API /pnl] Enhanced ${enhancedTimeCount} positions with open times, ${enhancedTradeCount} with trade counts from activity API`);
        }
      } catch (activityError) {
        console.warn(`[API /pnl] Failed to fetch activity for open time enhancement:`, activityError);
        // Fallback to trades API if activity API fails
        console.log(`[API /pnl] Falling back to trades API for open time enhancement...`);
        try {
          const rawTrades = await fetchAllTrades(userAddress, undefined, undefined);
          console.log(`[API /pnl] Fetched ${rawTrades.length} trades for open time calculation (fallback)`);
          
          if (rawTrades.length > 0) {
            const firstBuyTimes = new Map<string, string>();
            const normalizedTrades = rawTrades.map(trade => normalizeTrade(trade, userAddress));
            
            for (const trade of normalizedTrades) {
              if (trade.side === 'BUY') {
                const key = `${trade.conditionId}:${trade.outcome}`;
                const existingTime = firstBuyTimes.get(key);
                const tradeTime = new Date(trade.timestamp).getTime();
                
                if (!existingTime || tradeTime < new Date(existingTime).getTime()) {
                  firstBuyTimes.set(key, trade.timestamp);
                }
              }
            }

            closedPositions = closedPositions.map(pos => {
              const key = `${pos.conditionId}:${pos.outcome}`;
              const firstBuyTime = firstBuyTimes.get(key);
              
              if (firstBuyTime) {
                return {
                  ...pos,
                  openedAt: firstBuyTime,
                };
              }
              return pos;
            });
          }
        } catch (tradeError) {
          console.warn(`[API /pnl] Failed to fetch trades for open time enhancement (fallback):`, tradeError);
          // Continue with closed positions as-is if both fail
        }
      }
    } catch (apiError) {
      console.log(`[API /pnl] Closed positions API failed, falling back to trade computation:`, apiError);
      
      // Fallback: Fetch all trades and compute PnL manually
      // Fetch entire history (no date filtering)
      console.log(`[API /pnl] Fetching trades for: ${userAddress} (entire history)`);
      const rawTrades = await fetchAllTrades(userAddress, undefined, undefined);
      console.log(`[API /pnl] Fetched ${rawTrades.length} raw trades`);
      
      if (rawTrades.length === 0) {
        console.log(`[API /pnl] No trades found for wallet: ${userAddress}`);
        return NextResponse.json({
          positions: [],
          summary: {
            totalRealizedPnL: 0,
            winrate: 0,
            avgPnLPerPosition: 0,
            totalPositionsClosed: 0,
            biggestWin: 0,
            biggestLoss: 0,
          },
          resolveResult,
          tradesCount: 0,
          method,
          message: `No trades found for wallet ${wallet}. This wallet may not have any trades, or it may not be a valid Polymarket trading wallet.`,
        });
      }

      // Normalize trades
      const normalizedTrades = rawTrades.map(trade =>
        normalizeTrade(trade, userAddress)
      );
      console.log(`[API /pnl] Normalized ${normalizedTrades.length} trades`);

      // Enrich with metadata
      console.log(`[API /pnl] Enriching with metadata...`);
      const enrichedTrades = await enrichTradesWithMetadata(normalizedTrades);
      console.log(`[API /pnl] Enrichment complete`);

      // Sort trades by timestamp (ascending) for FIFO processing
      enrichedTrades.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Compute PnL using FIFO engine (avg cost not yet implemented)
      const engine = new FIFOPnLEngine();
      
      for (const trade of enrichedTrades) {
        engine.processTrade(trade);
      }

      closedPositions = engine.getClosedPositions();
      tradesCount = enrichedTrades.length;
      console.log(`[API /pnl] Computed ${closedPositions.length} closed positions from trades`);
    }

    // Calculate summary statistics
    const summary = calculateSummary(closedPositions);

    return NextResponse.json({
      positions: closedPositions,
      summary,
      resolveResult,
      tradesCount: tradesCount || closedPositions.length,
      method: closedPositions.length > 0 && tradesCount === 0 ? 'api' : method, // Mark if using API
    });
  } catch (error) {
    console.error('Error in /api/pnl:', error);
    return NextResponse.json(
      { error: 'Failed to compute PnL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function calculateSummary(positions: ClosedPosition[]): PositionSummary {
  if (positions.length === 0) {
    return {
      totalRealizedPnL: 0,
      winrate: 0,
      avgPnLPerPosition: 0,
      totalPositionsClosed: 0,
      biggestWin: 0,
      biggestLoss: 0,
      avgPosSize: 0,
      avgHoldingTime: 0,
      mostUsedCategory: '-',
    };
  }

  const totalRealizedPnL = positions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
  const winningPositions = positions.filter(pos => pos.realizedPnL > 0).length;
  const winrate = (winningPositions / positions.length) * 100;
  const avgPnLPerPosition = totalRealizedPnL / positions.length;
  
  const pnls = positions.map(pos => pos.realizedPnL);
  const biggestWin = Math.max(...pnls, 0);
  const biggestLoss = Math.min(...pnls, 0);

  // Calculate average position size
  const totalSize = positions.reduce((sum, pos) => sum + pos.size, 0);
  const avgPosSize = totalSize / positions.length;

  // Calculate average holding time (in days)
  // Filter for positions with valid close dates AND different open/close times
  const positionsWithValidHoldingTime = positions.filter(pos => {
    if (!pos.closedAt) return false;
    const openDate = new Date(pos.openedAt);
    const closeDate = new Date(pos.closedAt);
    // Skip positions where open and close times are identical or very close (within 1 minute)
    // This happens when using the API endpoint that doesn't provide open times
    const timeDiff = Math.abs(closeDate.getTime() - openDate.getTime());
    return timeDiff > 60000; // More than 1 minute difference
  });
  
  let avgHoldingTime = 0;
  if (positionsWithValidHoldingTime.length > 0) {
    const totalHoldingTime = positionsWithValidHoldingTime.reduce((sum, pos) => {
      const openDate = new Date(pos.openedAt);
      const closeDate = new Date(pos.closedAt!);
      const days = (closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24);
      return sum + Math.max(0, days); // Ensure non-negative
    }, 0);
    avgHoldingTime = totalHoldingTime / positionsWithValidHoldingTime.length;
  }

  // Find most used category (extract from eventTitle)
  const categoryCounts = new Map<string, number>();
  positions.forEach(pos => {
    const eventTitle = pos.eventTitle || '';
    // Extract category - use the first part before a dash or colon, or use first word
    let category = eventTitle.split(' - ')[0].split(':')[0].trim();
    if (!category) {
      category = pos.marketTitle?.split(' - ')[0]?.split(':')[0]?.trim() || 'Unknown';
    }
    if (category) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
  });
  
  let mostUsedCategory = '-';
  let maxCount = 0;
  categoryCounts.forEach((count, category) => {
    if (count > maxCount) {
      maxCount = count;
      mostUsedCategory = category;
    }
  });

  // Truncate category if too long
  if (mostUsedCategory.length > 20) {
    mostUsedCategory = mostUsedCategory.substring(0, 17) + '...';
  }

  return {
    totalRealizedPnL,
    winrate,
    avgPnLPerPosition,
    totalPositionsClosed: positions.length,
    biggestWin,
    biggestLoss,
    avgPosSize,
    avgHoldingTime,
    mostUsedCategory,
  };
}
