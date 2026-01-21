'use client';

import { PositionSummary } from '@/types';

interface SummaryCardsProps {
  summary: PositionSummary;
}

function formatNumber(num: number, decimals: number = 2): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}M`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}K`;
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

interface StatCardProps {
  variant?: 'hero' | 'mini';
  label: string;
  value: React.ReactNode;
  secondary?: string;
  className?: string;
}

function StatCard({ variant = 'mini', label, value, secondary, className = '' }: StatCardProps) {
  if (variant === 'hero') {
    return (
      <div className={`bg-hyper-panel border border-hyper-border rounded p-3 ${className}`}>
        <div className="text-[9px] text-hyper-textSecondary mb-1 uppercase tracking-wide">{label}</div>
        <div className="mb-0.5">{value}</div>
        {secondary && (
          <div className="text-[9px] text-hyper-textSecondary opacity-70">{secondary}</div>
        )}
        {/* Sparkline placeholder area */}
        <div className="mt-2 h-8 border-t border-hyper-border opacity-30"></div>
      </div>
    );
  }
  
  return (
    <div className={`bg-hyper-panel border border-hyper-border rounded p-2 ${className}`}>
      <div className="text-[10px] text-hyper-textSecondary mb-0.5">{label}</div>
      <div>{value}</div>
    </div>
  );
}

interface SummaryCardsLayoutProps {
  summary: PositionSummary;
  variant?: 'hero' | 'mini' | 'all';
}

export function SummaryCardsLayout({ summary, variant = 'all' }: SummaryCardsLayoutProps) {
  const heroCards = (
    <>
      <StatCard
        variant="hero"
        label="Total PnL"
        value={
          <div className={`text-xl  font-semibold ${
            summary.totalRealizedPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
          }`}>
            ${formatNumber(summary.totalRealizedPnL)}
          </div>
        }
        secondary="Realized PnL"
      />
      <StatCard
        variant="hero"
        label="Win Rate"
        value={
          <div className="text-xl  font-semibold text-hyper-accent">
            {summary.winrate.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </div>
        }
        secondary={`${summary.totalPositionsClosed} positions`}
      />
      <StatCard
        variant="hero"
        label="Positions"
        value={
          <div className="text-xl  font-semibold text-hyper-textPrimary">
            {summary.totalPositionsClosed.toLocaleString('en-US')}
          </div>
        }
        secondary="Closed positions"
      />
    </>
  );

  const miniCards = (
    <>
      <StatCard
        label="Avg PnL"
        value={
          <div className={`text-sm  font-medium ${
            summary.avgPnLPerPosition >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
          }`}>
            ${formatNumber(summary.avgPnLPerPosition)}
          </div>
        }
      />
      <StatCard
        label="Avg Pos Size"
        value={
          <div className="text-sm  font-medium text-hyper-textPrimary">
            {formatNumber(summary.avgPosSize, 1)}
          </div>
        }
      />
      <StatCard
        label="Avg Holding"
        value={
          <div className="text-sm  font-medium text-hyper-textPrimary">
            {summary.avgHoldingTime > 0 ? formatDays(summary.avgHoldingTime) : '-'}
          </div>
        }
      />
      <StatCard
        label="Top Category"
        value={
          <div className="text-sm font-medium text-hyper-textPrimary truncate" title={summary.mostUsedCategory}>
            {summary.mostUsedCategory}
          </div>
        }
      />
      <StatCard
        label="Biggest Win"
        value={
          <div className="text-sm  font-medium text-hyper-accent">
            ${formatNumber(summary.biggestWin)}
          </div>
        }
      />
      <StatCard
        label="Biggest Loss"
        value={
          <div className="text-sm  font-medium text-hyper-negative">
            ${formatNumber(summary.biggestLoss)}
          </div>
        }
      />
    </>
  );

  if (variant === 'hero') return heroCards;
  if (variant === 'mini') return miniCards;
  return <>{heroCards}{miniCards}</>;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return <SummaryCardsLayout summary={summary} variant="all" />;
}
