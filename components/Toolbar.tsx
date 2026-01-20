'use client';

import { ClosedPosition } from '@/types';

interface ToolbarProps {
  wallet: string;
  setWallet: (wallet: string) => void;
  onLoad: (e: React.FormEvent) => void;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  pnlFilter: 'all' | 'positive' | 'negative';
  setPnlFilter: (filter: 'all' | 'positive' | 'negative') => void;
  showNumberColumns: boolean;
  setShowNumberColumns: (show: boolean) => void;
  onExport: () => void;
  hasPositions: boolean;
  viewMode: 'chart' | 'calendar';
  setViewMode: (mode: 'chart' | 'calendar') => void;
}

export default function Toolbar({
  wallet,
  setWallet,
  onLoad,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  pnlFilter,
  setPnlFilter,
  showNumberColumns,
  setShowNumberColumns,
  onExport,
  hasPositions,
  viewMode,
  setViewMode,
}: ToolbarProps) {
  return (
    <div className="bg-hyper-panel border border-hyper-border rounded-md p-2 mb-2">
      <form onSubmit={onLoad} className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="0x..."
            className="w-full px-2 py-1.5 bg-hyper-bg border border-hyper-border rounded text-xs text-hyper-textPrimary placeholder-hyper-textSecondary focus:outline-none focus:border-hyper-accent"
            required
            disabled={loading}
          />
        </div>
        
        {hasPositions && (
          <>
            <div className="flex items-center gap-1 bg-hyper-bg border border-hyper-border rounded p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-hyper-accent text-hyper-bg'
                    : 'text-hyper-textSecondary hover:text-hyper-textPrimary'
                }`}
              >
                Chart
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-hyper-accent text-hyper-bg'
                    : 'text-hyper-textSecondary hover:text-hyper-textPrimary'
                }`}
              >
                Calendar
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2 py-1.5 bg-hyper-bg border border-hyper-border rounded text-xs text-hyper-textPrimary placeholder-hyper-textSecondary focus:outline-none focus:border-hyper-accent min-w-[150px]"
            />
            
            <select
              value={pnlFilter}
              onChange={(e) => setPnlFilter(e.target.value as 'all' | 'positive' | 'negative')}
              className="px-2 py-1.5 bg-hyper-bg border border-hyper-border rounded text-xs text-hyper-textPrimary focus:outline-none focus:border-hyper-accent"
            >
              <option value="all">All PnL</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </select>
            
            <button
              type="button"
              onClick={() => setShowNumberColumns(!showNumberColumns)}
              className={`px-2 py-1.5 rounded text-xs transition-colors ${
                showNumberColumns
                  ? 'bg-hyper-accent text-hyper-bg'
                  : 'bg-hyper-panelHover text-hyper-textSecondary border border-hyper-border'
              }`}
            >
              {showNumberColumns ? 'Hide Numbers' : 'Show Numbers'}
            </button>
            
            <button
              type="button"
              onClick={onExport}
              className="px-2 py-1.5 bg-hyper-panelHover border border-hyper-border rounded text-xs text-hyper-textPrimary hover:bg-hyper-border transition-colors"
            >
              Export CSV
            </button>
          </>
        )}
        
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 bg-hyper-accent text-hyper-bg rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
      </form>
      
      {error && (
        <div className="mt-2 px-2 py-1.5 bg-hyper-negative/20 border border-hyper-negative rounded text-xs text-hyper-negative">
          {error}
        </div>
      )}
    </div>
  );
}
