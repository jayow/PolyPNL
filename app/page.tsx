'use client';

import { useState, useEffect, useMemo } from 'react';
import { ClosedPosition, PositionSummary, ProxyWalletResponse } from '@/types';
import Toolbar from '@/components/Toolbar';
import SummaryCards, { SummaryCardsLayout } from '@/components/SummaryCards';
import YesNoAnalytics from '@/components/YesNoAnalytics';
import TopStatsRowV2 from '@/components/TopStatsRowV2';
import Table from '@/components/Table';
import DetailsPanel from '@/components/DetailsPanel';
import PnLGraph from '@/components/PnLGraph';
import CalendarView from '@/components/CalendarView';
import AdvancedAnalytics from '@/components/AdvancedAnalytics';

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
  const [selectedPosition, setSelectedPosition] = useState<ClosedPosition | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [autoSubmitAddress, setAutoSubmitAddress] = useState<string | null>(null);

  // Read address parameter from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const addressParam = params.get('address');
      
      if (addressParam) {
        const decodedAddress = decodeURIComponent(addressParam).trim();
        setWallet(decodedAddress);
        // Set flag to auto-submit after component is ready
        setAutoSubmitAddress(decodedAddress);
      }
    }
  }, []); // Only run on mount

  // Auto-submit when address is loaded from URL
  useEffect(() => {
    if (autoSubmitAddress && wallet === autoSubmitAddress && !loading) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        // Create a synthetic form event to trigger submit
        const form = document.querySelector('form');
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(submitEvent);
        }
        setAutoSubmitAddress(null); // Clear flag after triggering
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [autoSubmitAddress, wallet, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    // Update URL with address parameter for shareable links
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('address', wallet.trim());
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, '', newUrl);
    }

    setLoading(true);
    setError(null);
    setPositions([]);
    setSummary(null);
    setResolveResult(null);
    setSelectedPosition(null);

    try {
      const params = new URLSearchParams({
        wallet: wallet.trim(),
      });

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

  const handleSort = (column: keyof ClosedPosition) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const filteredPositions = useMemo(() => {
    let filtered = positions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pos =>
        pos.eventTitle?.toLowerCase().includes(query) ||
        pos.marketTitle?.toLowerCase().includes(query) ||
        pos.outcomeName?.toLowerCase().includes(query)
      );
    }

    if (pnlFilter === 'positive') {
      filtered = filtered.filter(pos => pos.realizedPnL > 0);
    } else if (pnlFilter === 'negative') {
      filtered = filtered.filter(pos => pos.realizedPnL < 0);
    }

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortColumn];
        let bVal: any = b[sortColumn];

        if (sortColumn === 'openedAt' || sortColumn === 'closedAt') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = (bVal || '').toLowerCase();
        }

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
    <div className="min-h-screen bg-hyper-bg text-hyper-textPrimary p-2" style={{ backgroundColor: '#0B0F14', color: '#E6EDF6' }}>
      <div className="max-w-full flex flex-col">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-sm font-medium text-hyper-textPrimary mb-0.5">Poly PNL</h1>
          <p className="text-[10px] text-hyper-textSecondary">Track your realized profit and loss from Polymarket trades</p>
        </div>

        {/* Toolbar */}
        <Toolbar
          wallet={wallet}
          setWallet={setWallet}
          onLoad={handleSubmit}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          pnlFilter={pnlFilter}
          setPnlFilter={setPnlFilter}
          showNumberColumns={showNumberColumns}
          setShowNumberColumns={setShowNumberColumns}
          onExport={exportToCSV}
          hasPositions={positions.length > 0}
        />

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-hyper-accent mb-2"></div>
              <p className="text-xs text-hyper-textSecondary">Loading trade data...</p>
              {wallet && (
                <p className="text-[10px] text-hyper-muted mt-2">
                  Wallet: {wallet.slice(0, 10)}...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Results Section */}
        {!loading && (positions.length > 0 || (resolveResult && positions.length === 0)) && (
          <div className="flex flex-col">
            {/* Empty State */}
            {positions.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-hyper-panel border border-hyper-border rounded p-4 max-w-md text-center">
                  <p className="text-xs text-hyper-textPrimary mb-1">No closed positions found</p>
                  <p className="text-[10px] text-hyper-textSecondary mb-2">
                    This wallet has no realized PnL.
                  </p>
                  <p className="text-[10px] text-hyper-muted">
                    Possible reasons:
                    <br />• No trades in the history
                    <br />• Wallet has no closed positions yet
                    <br />• Wallet may not be a Polymarket trading wallet
                  </p>
                  {resolveResult && (
                    <p className="text-[10px] text-hyper-muted mt-3 pt-3 border-t border-hyper-border">
                      Wallet: {resolveResult.userAddressUsed || wallet}
                      {resolveResult.proxyWalletFound && (
                        <><br />Proxy: {resolveResult.proxyWallet}</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Content Grid */}
            {positions.length > 0 && (
              <>
                {/* Top Analytics Row - Redesigned 4-Card Layout */}
                {summary && positions.length > 0 && (
                  <TopStatsRowV2 
                    summary={summary} 
                    positions={filteredPositions}
                    username={resolveResult?.username}
                    profileImage={resolveResult?.profileImage}
                    wallet={wallet}
                    resolveResult={resolveResult}
                  />
                )}

                {/* PnL Graph and Calendar View Side by Side */}
                {positions.length > 0 && (
                  <div className="mb-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Left: Chart Panel */}
                    <div className="h-[400px] md:h-[500px]">
                      <PnLGraph positions={filteredPositions} />
                    </div>
                    {/* Right: Calendar Panel */}
                    <div className="h-[400px] md:h-[500px]">
                      <CalendarView positions={filteredPositions} />
                    </div>
                  </div>
                )}

                {/* Results Count and View Toggle */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-[10px] text-hyper-textSecondary">
                    Showing {filteredPositions.length.toLocaleString('en-US')} of {positions.length.toLocaleString('en-US')} positions
                  </div>
                  <div className="flex items-center gap-1 bg-hyper-bg border border-hyper-border rounded p-0.5">
                    <button
                      onClick={() => setShowAnalytics(false)}
                      className={`px-3 py-1.5 rounded text-xs transition-colors ${
                        !showAnalytics
                          ? 'bg-hyper-accent text-hyper-bg'
                          : 'text-hyper-textSecondary hover:text-hyper-textPrimary'
                      }`}
                    >
                      Positions
                    </button>
                    <button
                      onClick={() => setShowAnalytics(true)}
                      className={`px-3 py-1.5 rounded text-xs transition-colors ${
                        showAnalytics
                          ? 'bg-hyper-accent text-hyper-bg'
                          : 'text-hyper-textSecondary hover:text-hyper-textPrimary'
                      }`}
                    >
                      Analytics
                    </button>
                  </div>
                </div>

                {/* Main Content: Table/Analytics + Details Panel */}
                {showAnalytics ? (
                  <div>
                    <AdvancedAnalytics positions={filteredPositions} />
                  </div>
                ) : (
                  <div className="grid grid-cols-[70%_30%] gap-2">
                    {/* Table */}
                    <div>
                      <Table
                        positions={filteredPositions}
                        showNumberColumns={showNumberColumns}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        selectedPosition={selectedPosition}
                        onSelectPosition={setSelectedPosition}
                        wallet={wallet}
                        resolveResult={resolveResult}
                      />
                    </div>

                    {/* Details Panel */}
                    <div>
                      <DetailsPanel
                        selectedPosition={selectedPosition}
                        resolveResult={resolveResult}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Empty Initial State */}
        {!loading && positions.length === 0 && !resolveResult && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-hyper-textSecondary text-center px-4">
              This tool fetches real trade data from Polymarket APIs to compute your realized PnL.
              <br />
              Enter a wallet address above to see your entire trade history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
