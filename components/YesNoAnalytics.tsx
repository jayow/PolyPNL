'use client';

import { useMemo } from 'react';
import { ClosedPosition } from '@/types';

interface YesNoAnalyticsProps {
  positions: ClosedPosition[];
}

function formatNumber(num: number, decimals: number = 2): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}m`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}k`;
  } else {
    return `${sign}${absNum.toFixed(decimals)}`;
  }
}

export default function YesNoAnalytics({ positions }: YesNoAnalyticsProps) {
  const analytics = useMemo(() => {
    const yesPositions = positions.filter(pos => pos.side === 'Long YES');
    const noPositions = positions.filter(pos => pos.side === 'Long NO');

    // YES positions stats
    const yesPnL = yesPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
    const yesWins = yesPositions.filter(pos => pos.realizedPnL > 0).length;
    const yesWinRate = yesPositions.length > 0 ? (yesWins / yesPositions.length) * 100 : 0;
    const yesAvgPnL = yesPositions.length > 0 ? yesPnL / yesPositions.length : 0;

    // NO positions stats
    const noPnL = noPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
    const noWins = noPositions.filter(pos => pos.realizedPnL > 0).length;
    const noWinRate = noPositions.length > 0 ? (noWins / noPositions.length) * 100 : 0;
    const noAvgPnL = noPositions.length > 0 ? noPnL / noPositions.length : 0;

    return {
      yes: {
        pnl: yesPnL,
        winRate: yesWinRate,
        avgPnL: yesAvgPnL,
        count: yesPositions.length,
      },
      no: {
        pnl: noPnL,
        winRate: noWinRate,
        avgPnL: noAvgPnL,
        count: noPositions.length,
      },
    };
  }, [positions]);

  return (
    <>
      {/* YES Card - Mini variant */}
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-1 font-medium">Long YES</div>
        <div className="space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">PnL</span>
            <span className={`text-xs font-mono-numeric font-medium ${
              analytics.yes.pnl >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(analytics.yes.pnl)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">WR</span>
            <span className="text-xs font-mono-numeric font-medium text-hyper-textPrimary">
              {analytics.yes.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">Avg</span>
            <span className={`text-xs font-mono-numeric font-medium ${
              analytics.yes.avgPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(analytics.yes.avgPnL)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">Cnt</span>
            <span className="text-xs font-mono-numeric font-medium text-hyper-textPrimary">
              {analytics.yes.count.toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </div>

      {/* NO Card - Mini variant */}
      <div className="bg-hyper-panel border border-hyper-border rounded p-2">
        <div className="text-[10px] text-hyper-textSecondary mb-1 font-medium">Long NO</div>
        <div className="space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">PnL</span>
            <span className={`text-xs font-mono-numeric font-medium ${
              analytics.no.pnl >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(analytics.no.pnl)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">WR</span>
            <span className="text-xs font-mono-numeric font-medium text-hyper-textPrimary">
              {analytics.no.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">Avg</span>
            <span className={`text-xs font-mono-numeric font-medium ${
              analytics.no.avgPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(analytics.no.avgPnL)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-hyper-textSecondary">Cnt</span>
            <span className="text-xs font-mono-numeric font-medium text-hyper-textPrimary">
              {analytics.no.count.toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
