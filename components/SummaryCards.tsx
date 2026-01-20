'use client';

import { PositionSummary } from '@/types';

interface SummaryCardsProps {
  summary: PositionSummary;
}

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
    return `${Math.round(days * 24)}h`;
  } else if (days < 7) {
    return `${days.toFixed(1)}d`;
  } else if (days < 30) {
    const weeks = days / 7;
    return `${weeks.toFixed(1)}w`;
  } else if (days < 365) {
    const months = days / 30;
    return `${months.toFixed(1)}mo`;
  } else {
    const years = days / 365;
    return `${years.toFixed(1)}y`;
  }
}

interface SummaryCardsContainerProps {
  summary: PositionSummary;
  children?: React.ReactNode;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <>
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Total PnL</div>
        <div className={`text-sm font-mono-numeric font-medium ${
          summary.totalRealizedPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
        }`}>
          ${formatNumber(summary.totalRealizedPnL)}
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Win Rate</div>
        <div className="text-sm font-mono-numeric font-medium text-hyper-accent">
          {summary.winrate.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Avg PnL</div>
        <div className={`text-sm font-mono-numeric font-medium ${
          summary.avgPnLPerPosition >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
        }`}>
          ${formatNumber(summary.avgPnLPerPosition)}
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Positions</div>
        <div className="text-sm font-mono-numeric font-medium text-hyper-textPrimary">
          {summary.totalPositionsClosed.toLocaleString('en-US')}
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Avg Pos Size</div>
        <div className="text-sm font-mono-numeric font-medium text-hyper-textPrimary">
          {formatNumber(summary.avgPosSize, 1)}
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Avg Holding</div>
        <div className="text-sm font-mono-numeric font-medium text-hyper-textPrimary">
          {summary.avgHoldingTime > 0 ? formatDays(summary.avgHoldingTime) : '-'}
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Top Category</div>
        <div className="text-sm font-medium text-hyper-textPrimary truncate" title={summary.mostUsedCategory}>
          {summary.mostUsedCategory}
        </div>
        <div className="text-[10px] text-hyper-textSecondary mb-0.5 mt-1">Top Tags</div>
        <div className="text-xs font-medium text-hyper-textPrimary truncate" title={summary.topTags && summary.topTags.length > 0 ? summary.topTags.join(', ') : summary.mostUsedTag || '-'}>
          {summary.topTags && summary.topTags.length > 0 ? (
            summary.topTags.join(', ')
          ) : (
            summary.mostUsedTag || '-'
          )}
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Biggest Win</div>
        <div className="text-sm font-mono-numeric font-medium text-hyper-accent">
          ${formatNumber(summary.biggestWin)}
        </div>
      </div>
      
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-0.5">Biggest Loss</div>
        <div className="text-sm font-mono-numeric font-medium text-hyper-negative">
          ${formatNumber(summary.biggestLoss)}
        </div>
      </div>
    </>
  );
}
