import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet, fetchClosedPositions, fetchAllTrades, normalizeTrade, enrichTradesWithMetadata } from '@/lib/api-client';
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
    };
  }

  const totalRealizedPnL = positions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
  const winningPositions = positions.filter(pos => pos.realizedPnL > 0).length;
  const winrate = (winningPositions / positions.length) * 100;
  const avgPnLPerPosition = totalRealizedPnL / positions.length;
  
  const pnls = positions.map(pos => pos.realizedPnL);
  const biggestWin = Math.max(...pnls, 0);
  const biggestLoss = Math.min(...pnls, 0);

  return {
    totalRealizedPnL,
    winrate,
    avgPnLPerPosition,
    totalPositionsClosed: positions.length,
    biggestWin,
    biggestLoss,
  };
}
