import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet, fetchAllTrades, normalizeTrade, enrichTradesWithMetadata } from '@/lib/api-client';
import { NormalizedTrade } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    // Resolve proxy wallet first
    const resolveResult = await resolveProxyWallet(wallet);
    const userAddress = resolveResult.userAddressUsed;

    // Fetch all trades
    const rawTrades = await fetchAllTrades(userAddress, start || undefined, end || undefined);

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
