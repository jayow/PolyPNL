'use client';

import { useState, useEffect, useMemo } from 'react';
import { ClosedPosition, PositionSummary, ProxyWalletResponse } from '@/types';

// Format numbers with commas and k/m abbreviations
function formatNumber(num: number, decimals: number = 2): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}m`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}k`;
  } else {
    return `${sign}${absNum.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
}

// Format numbers with just commas (no k/m)
function formatNumberWithCommas(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Home() {
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<ClosedPosition[]>([]);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [resolveResult, setResolveResult] = useState<ProxyWalletResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pnlFilter, setPnlFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [showNumberColumns, setShowNumberColumns] = useState(true);
  const [sortColumn, setSortColumn] = useState<keyof ClosedPosition | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    setLoading(true);
    setError(null);
    setPositions([]);
    setSummary(null);
    setResolveResult(null);

    try {
      const params = new URLSearchParams({
        wallet: wallet.trim(),
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

  // Handle column sorting
  const handleSort = (column: keyof ClosedPosition) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Filter and sort positions
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

    // Sort
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortColumn];
        let bVal: any = b[sortColumn];

        // Handle different data types
        if (sortColumn === 'openedAt' || sortColumn === 'closedAt') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = (bVal || '').toLowerCase();
        }

        // Compare values
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [positions, searchQuery, pnlFilter, sortColumn, sortDirection]);

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Poly PNL
            </h1>
            <p className="text-xl text-gray-300">
              Track your realized profit and loss from Polymarket trades
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="wallet" className="block text-sm font-medium text-gray-300 mb-2">
                  Wallet Address
                </label>
                <input
                  type="text"
                  id="wallet"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                  required
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-400">
                  Enter your Ethereum wallet address (EOA) or Polymarket proxy wallet address. 
                  If you enter an EOA, we'll try to resolve the proxy wallet automatically.
                  If auto-resolution fails, enter your proxy wallet address directly.
                </p>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading trades...
                  </span>
                ) : (
                  'Load Trades'
                )}
              </button>
            </form>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-xl text-gray-300">Loading trade data and computing PnL...</p>
              <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
              {wallet && (
                <p className="text-xs text-gray-500 mt-4">
                  Wallet: {wallet.slice(0, 10)}...
                  <br />
                  Resolving proxy wallet and fetching entire trade history...
                </p>
              )}
            </div>
          )}

          {/* Results Section */}
          {!loading && (positions.length > 0 || (resolveResult && positions.length === 0)) && (
            <>
              {/* Wallet Info */}
              {resolveResult && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
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

              {/* Empty State */}
              {positions.length === 0 && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-8 text-center mb-8">
                  <p className="text-xl text-yellow-200 mb-2">No closed positions found</p>
                  <p className="text-yellow-300 mb-4">
                    This wallet has no realized PnL.
                  </p>
                  <p className="text-sm text-yellow-400">
                    Possible reasons:
                    <br />• No trades in the history
                    <br />• Wallet has no closed positions yet
                    <br />• Wallet may not be a Polymarket trading wallet
                  </p>
                  <p className="text-xs text-yellow-500 mt-4">
                    Wallet used: {resolveResult?.userAddressUsed || wallet}
                    {resolveResult?.proxyWalletFound && (
                      <><br />Proxy wallet found: {resolveResult.proxyWallet}</>
                    )}
                  </p>
                </div>
              )}

              {/* Summary Stats */}
              {summary && positions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Total Realized PnL</div>
                    <div className={`text-2xl font-bold ${summary.totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${formatNumber(summary.totalRealizedPnL)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Win Rate</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {summary.winrate.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Avg PnL/Position</div>
                    <div className={`text-2xl font-bold ${summary.avgPnLPerPosition >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${formatNumber(summary.avgPnLPerPosition)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Positions Closed</div>
                    <div className="text-2xl font-bold text-white">
                      {summary.totalPositionsClosed.toLocaleString('en-US')}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Biggest Win</div>
                    <div className="text-2xl font-bold text-green-400">
                      ${formatNumber(summary.biggestWin)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Biggest Loss</div>
                    <div className="text-2xl font-bold text-red-400">
                      ${formatNumber(summary.biggestLoss)}
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

                      <button
                        onClick={() => setShowNumberColumns(!showNumberColumns)}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          showNumberColumns 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {showNumberColumns ? 'Hide Numbers' : 'Show Numbers'}
                      </button>
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
                    Showing {filteredPositions.length.toLocaleString('en-US')} of {positions.length.toLocaleString('en-US')} positions
                  </div>
                </div>
              )}

              {/* Positions Table */}
              {filteredPositions.length > 0 && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-900">
                        <tr>
                          <th 
                            className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[120px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                            onClick={() => handleSort('eventTitle')}
                          >
                            <div className="flex items-center gap-1">
                              Event
                              {sortColumn === 'eventTitle' && (
                                <span className="text-blue-400">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[150px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                            onClick={() => handleSort('marketTitle')}
                          >
                            <div className="flex items-center gap-1">
                              Market
                              {sortColumn === 'marketTitle' && (
                                <span className="text-blue-400">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[45px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                            onClick={() => handleSort('outcomeName')}
                          >
                            <div className="flex items-center gap-1">
                              Outcome
                              {sortColumn === 'outcomeName' && (
                                <span className="text-blue-400">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[60px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                            onClick={() => handleSort('side')}
                          >
                            <div className="flex items-center gap-1">
                              Side
                              {sortColumn === 'side' && (
                                <span className="text-blue-400">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                            onClick={() => handleSort('openedAt')}
                          >
                            <div className="flex items-center gap-1">
                              Opened
                              {sortColumn === 'openedAt' && (
                                <span className="text-blue-400">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                            onClick={() => handleSort('closedAt')}
                          >
                            <div className="flex items-center gap-1">
                              Closed
                              {sortColumn === 'closedAt' && (
                                <span className="text-blue-400">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          {showNumberColumns && (
                            <>
                              <th 
                                className="px-2 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                                onClick={() => handleSort('entryVWAP')}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  Entry
                                  {sortColumn === 'entryVWAP' && (
                                    <span className="text-blue-400">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                                onClick={() => handleSort('exitVWAP')}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  Exit
                                  {sortColumn === 'exitVWAP' && (
                                    <span className="text-blue-400">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                                onClick={() => handleSort('size')}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  Size
                                  {sortColumn === 'size' && (
                                    <span className="text-blue-400">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider w-[80px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                                onClick={() => handleSort('realizedPnL')}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  PnL
                                  {sortColumn === 'realizedPnL' && (
                                    <span className="text-blue-400">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                                onClick={() => handleSort('realizedPnLPercent')}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  PnL%
                                  {sortColumn === 'realizedPnLPercent' && (
                                    <span className="text-blue-400">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-2 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider w-[60px] cursor-pointer hover:bg-gray-800 transition-colors select-none"
                                onClick={() => handleSort('tradesCount')}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  #
                                  {sortColumn === 'tradesCount' && (
                                    <span className="text-blue-400">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {filteredPositions.map((pos, idx) => (
                          <tr key={idx} className="hover:bg-gray-750 transition-colors">
                            <td className="px-2 py-3 text-xs text-gray-300 max-w-[120px] truncate" title={pos.eventTitle || '-'}>
                              {pos.eventTitle || '-'}
                            </td>
                            <td className="px-2 py-3 text-xs text-gray-300 max-w-[150px] truncate" title={pos.marketTitle || '-'}>
                              {pos.marketTitle || '-'}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-300 max-w-[45px] truncate" title={pos.outcomeName || pos.outcome}>
                              {pos.outcomeName || pos.outcome}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-xs">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                pos.side === 'Long YES' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'
                              }`}>
                                {pos.side === 'Long YES' ? 'YES' : 'NO'}
                              </span>
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-400">
                              {new Date(pos.openedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-400">
                              {pos.closedAt ? new Date(pos.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                            </td>
                            {showNumberColumns && (
                              <>
                                <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-300 text-right">
                                  {pos.entryVWAP.toFixed(3)}
                                </td>
                                <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-300 text-right">
                                  {pos.exitVWAP.toFixed(3)}
                                </td>
                                <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-300 text-right">
                                  {formatNumberWithCommas(pos.size, 1)}
                                </td>
                                <td className={`px-2 py-3 whitespace-nowrap text-xs font-semibold text-right ${
                                  pos.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  ${formatNumber(pos.realizedPnL)}
                                </td>
                                <td className={`px-2 py-3 whitespace-nowrap text-xs font-semibold text-right ${
                                  pos.realizedPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {pos.realizedPnLPercent >= 0 ? '+' : ''}{pos.realizedPnLPercent.toFixed(1)}%
                                </td>
                                <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-300 text-right">
                                  {pos.tradesCount.toLocaleString('en-US')}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && positions.length === 0 && !resolveResult && (
            <div className="mt-8 text-center text-sm text-gray-400">
              <p>
                This tool fetches real trade data from Polymarket APIs to compute your realized PnL.
                Enter a wallet address above to see your entire trade history.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
