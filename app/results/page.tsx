'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ClosedPosition, PositionSummary, ProxyWalletResponse } from '@/types';

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [positions, setPositions] = useState<ClosedPosition[]>([]);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [resolveResult, setResolveResult] = useState<ProxyWalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pnlFilter, setPnlFilter] = useState<'all' | 'positive' | 'negative'>('all');

  const wallet = searchParams.get('wallet') || '';
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';

  useEffect(() => {
    if (!wallet) {
      router.push('/');
      return;
    }

    fetchPnL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, start, end]);

  const fetchPnL = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        wallet,
        ...(start && { start }),
        ...(end && { end }),
      });

      // Add timeout to fetch request (60 seconds for entire operation)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`/api/pnl?${params.toString()}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to fetch PnL data`);
      }

      const data = await response.json();
      setPositions(data.positions || []);
      setSummary(data.summary || null);
      setResolveResult(data.resolveResult || null);
      
      // Log result for debugging
      console.log('[Frontend] PnL data received:', {
        positionsCount: data.positions?.length || 0,
        tradesCount: data.tradesCount || 0,
        proxyWallet: data.resolveResult?.proxyWalletFound,
        userAddress: data.resolveResult?.userAddressUsed,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. The API may be slow or the wallet has too many trades. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      console.error('[Frontend] Error fetching PnL:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter positions
  const filteredPositions = useMemo(() => {
    let filtered = positions;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pos =>
        pos.eventTitle?.toLowerCase().includes(query) ||
        pos.marketTitle?.toLowerCase().includes(query) ||
        pos.outcomeName?.toLowerCase().includes(query)
      );
    }

    // PnL filter
    if (pnlFilter === 'positive') {
      filtered = filtered.filter(pos => pos.realizedPnL > 0);
    } else if (pnlFilter === 'negative') {
      filtered = filtered.filter(pos => pos.realizedPnL < 0);
    }

    return filtered;
  }, [positions, searchQuery, pnlFilter]);

  const exportToCSV = () => {
    const headers = [
      'Event Title',
      'Market Title',
      'Outcome',
      'Side',
      'Opened At',
      'Closed At',
      'Entry VWAP',
      'Exit VWAP',
      'Size',
      'Realized PnL (USDC)',
      'Realized PnL %',
      '# Trades',
    ];

    const rows = filteredPositions.map(pos => [
      pos.eventTitle || '',
      pos.marketTitle || '',
      pos.outcomeName || pos.outcome,
      pos.side,
      pos.openedAt,
      pos.closedAt || '',
      pos.entryVWAP.toFixed(6),
      pos.exitVWAP.toFixed(6),
      pos.size.toFixed(6),
      pos.realizedPnL.toFixed(2),
      pos.realizedPnLPercent.toFixed(2),
      pos.tradesCount.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poly-pnl-${wallet.slice(0, 10)}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-xl text-gray-300">Loading trade data and computing PnL...</p>
            <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
            <p className="text-xs text-gray-500 mt-4">
              Wallet: {wallet.slice(0, 10)}...
              <br />
              Resolving proxy wallet and fetching trades...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-4 text-red-200">Error</h2>
              <p className="text-red-300 mb-6">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
          
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            PnL Results
          </h1>
          
          {resolveResult && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-200">
                <span className="font-semibold">Wallet:</span> {resolveResult.inputWallet}
              </p>
              {resolveResult.proxyWalletFound && (
                <p className="text-sm text-blue-200 mt-1">
                  <span className="font-semibold">Using proxy wallet:</span> {resolveResult.proxyWallet}
                </p>
              )}
            </div>
          )}

          {positions.length === 0 && !loading && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-8 text-center">
              <p className="text-xl text-yellow-200 mb-2">No closed positions found</p>
              <p className="text-yellow-300 mb-4">
                This wallet has no realized PnL for the selected date range.
              </p>
              <p className="text-sm text-yellow-400">
                Possible reasons:
                <br />• No trades in the selected date range
                <br />• Wallet has no closed positions yet
                <br />• Wallet may not be a Polymarket trading wallet
                <br />• Try expanding the date range
              </p>
              <p className="text-xs text-yellow-500 mt-4">
                Wallet used: {resolveResult?.userAddressUsed || wallet}
                {resolveResult?.proxyWalletFound && (
                  <><br />Proxy wallet found: {resolveResult.proxyWallet}</>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {summary && positions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Total Realized PnL</div>
              <div className={`text-2xl font-bold ${summary.totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${summary.totalRealizedPnL.toFixed(2)}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-blue-400">
                {summary.winrate.toFixed(1)}%
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Avg PnL/Position</div>
              <div className={`text-2xl font-bold ${summary.avgPnLPerPosition >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${summary.avgPnLPerPosition.toFixed(2)}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Positions Closed</div>
              <div className="text-2xl font-bold text-white">
                {summary.totalPositionsClosed}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Biggest Win</div>
              <div className="text-2xl font-bold text-green-400">
                ${summary.biggestWin.toFixed(2)}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Biggest Loss</div>
              <div className="text-2xl font-bold text-red-400">
                ${summary.biggestLoss.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Filters and Export */}
        {positions.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                <input
                  type="text"
                  placeholder="Search by event/market title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500 flex-1"
                />
                
                <select
                  value={pnlFilter}
                  onChange={(e) => setPnlFilter(e.target.value as 'all' | 'positive' | 'negative')}
                  className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white"
                >
                  <option value="all">All PnL</option>
                  <option value="positive">Positive PnL</option>
                  <option value="negative">Negative PnL</option>
                </select>
              </div>
              
              <button
                onClick={exportToCSV}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download CSV
              </button>
            </div>
            
            <div className="mt-4 text-sm text-gray-400">
              Showing {filteredPositions.length} of {positions.length} positions
            </div>
          </div>
        )}

        {/* Positions Table */}
        {filteredPositions.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Event</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Market</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Outcome</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Side</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Opened</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Closed</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Entry VWAP</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Exit VWAP</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Realized PnL</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">PnL %</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredPositions.map((pos, idx) => (
                    <tr key={idx} className="hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {pos.eventTitle || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                        {pos.marketTitle || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {pos.outcomeName || pos.outcome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          pos.side === 'Long YES' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'
                        }`}>
                          {pos.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(pos.openedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {pos.closedAt ? new Date(pos.closedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                        {pos.entryVWAP.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                        {pos.exitVWAP.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                        {pos.size.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                        pos.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${pos.realizedPnL.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                        pos.realizedPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {pos.realizedPnLPercent.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                        {pos.tradesCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-xl text-gray-300">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <ResultsContent />
    </Suspense>
  );
}
