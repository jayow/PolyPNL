'use client';

import { PositionSummary } from '@/types';
import { ClosedPosition } from '@/types';

interface TopStatsRowV2Props {
  summary: PositionSummary;
  positions: ClosedPosition[];
}

// Reuse existing formatting functions (no logic changes)
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

function formatDays(days: number): string {
  if (days < 1) {
    return `${Math.round(days * 24)} hour${Math.round(days * 24) !== 1 ? 's' : ''}`;
  } else if (days < 7) {
    return `${days.toFixed(1)} day${days !== 1 ? 's' : ''}`;
  } else if (days < 30) {
    const weeks = days / 7;
    return `${weeks.toFixed(1)} week${weeks !== 1 ? 's' : ''}`;
  } else if (days < 365) {
    const months = days / 30;
    return `${months.toFixed(1)} month${months !== 1 ? 's' : ''}`;
  } else {
    const years = days / 365;
    return `${years.toFixed(1)} year${years !== 1 ? 's' : ''}`;
  }
}

export default function TopStatsRowV2({ summary, positions }: TopStatsRowV2Props) {
  // Calculate YES/NO stats (same logic as YesNoAnalytics, no changes)
  const yesPositions = positions.filter(pos => pos.side === 'Long YES');
  const noPositions = positions.filter(pos => pos.side === 'Long NO');
  
  const yesPnL = yesPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
  const yesWins = yesPositions.filter(pos => pos.realizedPnL > 0).length;
  const yesWinRate = yesPositions.length > 0 ? (yesWins / yesPositions.length) * 100 : 0;
  const yesAvgPnL = yesPositions.length > 0 ? yesPnL / yesPositions.length : 0;
  const yesCount = yesPositions.length;

  const noPnL = noPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
  const noWins = noPositions.filter(pos => pos.realizedPnL > 0).length;
  const noWinRate = noPositions.length > 0 ? (noWins / noPositions.length) * 100 : 0;
  const noAvgPnL = noPositions.length > 0 ? noPnL / noPositions.length : 0;
  const noCount = noPositions.length;

  // Get top 3 tags (using existing data)
  const topTags = summary.topTags && summary.topTags.length > 0 
    ? summary.topTags.slice(0, 3)
    : (summary.mostUsedTag ? [summary.mostUsedTag] : []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mb-2">
      {/* Card 1: Total PnL (Hero) */}
      <div className="bg-hyper-panel border border-hyper-border rounded py-3 px-3">
        <div className="text-[9px] text-hyper-textSecondary mb-1 uppercase tracking-wide">Total PnL</div>
        <div className={`text-2xl font-mono-numeric font-semibold mb-0.5 ${
          summary.totalRealizedPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
        }`}>
          ${formatNumber(summary.totalRealizedPnL)}
        </div>
        <div className="text-[9px] text-hyper-textSecondary mb-2">Realized PnL</div>
        
        {/* Sub-metrics: single row, spread equally */}
        <div className="flex gap-x-1 gap-y-1.5 pt-2 border-t border-hyper-border">
          <div className="flex-shrink-0">
            <div className="text-[9px] text-hyper-textSecondary">Avg PnL</div>
            <div className={`text-xs font-mono-numeric font-semibold ${
              summary.avgPnLPerPosition >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(summary.avgPnLPerPosition)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-2">
            <div className="text-[9px] text-hyper-textSecondary">Avg Size</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary">
              {formatNumber(summary.avgPosSize, 1)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-1">
            <div className="text-[9px] text-hyper-textSecondary">Avg Holding</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary whitespace-nowrap">
              {summary.avgHoldingTime > 0 ? formatDays(summary.avgHoldingTime) : '-'}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            <div className="text-[9px] text-hyper-textSecondary">Big Win</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-accent">
              ${formatNumber(summary.biggestWin)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            <div className="text-[9px] text-hyper-textSecondary">Big Loss</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-negative">
              ${formatNumber(summary.biggestLoss)}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Win Rate (Summary) */}
      <div className="bg-hyper-panel border border-hyper-border rounded py-3 px-3">
        <div className="text-[9px] text-hyper-textSecondary mb-1 uppercase tracking-wide">Win Rate</div>
        <div className="text-xl font-mono-numeric font-semibold text-hyper-accent mb-0.5">
          {summary.winrate.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
        </div>
        <div className="text-[9px] text-hyper-textSecondary mb-2">Win Rate</div>
        
        {/* Secondary items: single row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-hyper-border">
          <div>
            <div className="text-[9px] text-hyper-textSecondary">Positions</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary">
              {summary.totalPositionsClosed.toLocaleString('en-US')}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-hyper-textSecondary">Top Category</div>
            <div className="text-xs font-semibold text-hyper-textPrimary truncate" title={summary.mostUsedCategory}>
              {summary.mostUsedCategory}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-hyper-textSecondary mb-0.5">Top Tags</div>
            <div className="flex flex-wrap gap-1">
              {topTags.length > 0 ? (
                topTags.map((tag, idx) => (
                  <span key={idx} className="text-[9px] text-hyper-textSecondary px-1.5 py-0.5 bg-hyper-panelHover rounded">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-[9px] text-hyper-textSecondary">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Long YES */}
      <div className="bg-hyper-panel border border-hyper-border rounded py-3 px-3">
        <div className="text-[9px] text-hyper-textSecondary mb-1 uppercase tracking-wide">Long YES</div>
        
        {/* Highlighted PnL */}
        <div className={`text-xl font-mono-numeric font-semibold mb-0.5 ${
          yesPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
        }`}>
          ${formatNumber(yesPnL)}
        </div>
        <div className="text-[9px] text-hyper-textSecondary mb-2">PnL</div>
        
        {/* Other stats below divider */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-hyper-border">
          <div>
            <div className="text-[9px] text-hyper-textSecondary">WR</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary">
              {yesWinRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] text-hyper-textSecondary">Avg</div>
            <div className={`text-xs font-mono-numeric font-semibold ${
              yesAvgPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(yesAvgPnL)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-hyper-textSecondary">Cnt</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary">
              {yesCount.toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* Card 4: Long NO */}
      <div className="bg-hyper-panel border border-hyper-border rounded py-3 px-3">
        <div className="text-[9px] text-hyper-textSecondary mb-1 uppercase tracking-wide">Long NO</div>
        
        {/* Highlighted PnL */}
        <div className={`text-xl font-mono-numeric font-semibold mb-0.5 ${
          noPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
        }`}>
          ${formatNumber(noPnL)}
        </div>
        <div className="text-[9px] text-hyper-textSecondary mb-2">PnL</div>
        
        {/* Other stats below divider */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-hyper-border">
          <div>
            <div className="text-[9px] text-hyper-textSecondary">WR</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary">
              {noWinRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] text-hyper-textSecondary">Avg</div>
            <div className={`text-xs font-mono-numeric font-semibold ${
              noAvgPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(noAvgPnL)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-hyper-textSecondary">Cnt</div>
            <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary">
              {noCount.toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* Card 5: Share Stats */}
      <div className="bg-hyper-panel border border-hyper-border rounded py-3 px-3">
        <div className="text-[9px] text-hyper-textSecondary mb-1 uppercase tracking-wide">Share Stats</div>
        <div className="text-xs font-mono-numeric font-semibold text-hyper-textPrimary">
          -
        </div>
      </div>
    </div>
  );
}
