'use client';

import { useMemo } from 'react';
import { OpenPosition, OpenPositionsSummary } from '@/types';
import { formatPositionLabel, sideBadgeClasses, marketDisplayTitle } from '@/lib/position-display';
import { useLivePrices } from '@/lib/use-live-prices';

interface Props {
  positions: OpenPosition[];
  summary: OpenPositionsSummary | null;
  loading?: boolean;
  error?: string | null;
}

export default function OpenPositions({ positions, summary, loading, error }: Props) {
  // Hooks must run unconditionally on every render (rules-of-hooks); keep all
  // useMemo / useLivePrices calls above any early returns below.
  const assetIds = useMemo(
    () => positions.map((p) => p.asset).filter((a): a is string => Boolean(a)),
    [positions]
  );
  const livePrices = useLivePrices(assetIds);
  const isLive = Object.keys(livePrices).length > 0;

  // Recompute current value / unrealized PnL using live mark prices when
  // available, otherwise the polled REST snapshot.
  const livePositions = useMemo(() => {
    return positions.map((p) => {
      const live = p.asset ? livePrices[p.asset] : undefined;
      if (live === undefined) return p;
      const currentValue = live * p.size;
      const unrealizedPnL = currentValue - p.initialValue;
      const unrealizedPnLPercent = p.initialValue > 0
        ? (unrealizedPnL / p.initialValue) * 100
        : 0;
      return {
        ...p,
        currentPrice: live,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercent,
      };
    });
  }, [positions, livePrices]);

  const liveSummary = useMemo<OpenPositionsSummary | null>(() => {
    if (!summary) return null;
    if (!isLive) return summary;
    const totalCurrentValue = livePositions.reduce((s, p) => s + (p.currentValue || 0), 0);
    const totalCostBasis = livePositions.reduce((s, p) => s + (p.initialValue || 0), 0);
    const totalUnrealizedPnL = livePositions.reduce((s, p) => s + (p.unrealizedPnL || 0), 0);
    const totalUnrealizedPnLPercent = totalCostBasis > 0
      ? (totalUnrealizedPnL / totalCostBasis) * 100
      : 0;
    return {
      ...summary,
      totalCurrentValue,
      totalCostBasis,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercent,
    };
  }, [isLive, livePositions, summary]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
        <div className="text-sm text-gray-400">Loading open positions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-8">
        <p className="text-sm text-yellow-300">
          <span className="font-semibold">Open positions unavailable:</span> {error}
        </p>
      </div>
    );
  }

  if (!summary || !liveSummary || positions.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Open Positions</h2>
        {isLive && (
          <span className="flex items-center gap-2 text-xs text-green-300" title="Live mark prices via Polymarket market WebSocket">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
            </span>
            Live
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card label="Open Positions" value={liveSummary.positionsCount.toString()} />
        <Card label="Current Value" value={`$${liveSummary.totalCurrentValue.toFixed(2)}`} />
        <Card
          label="Unrealized PnL"
          value={`$${liveSummary.totalUnrealizedPnL.toFixed(2)}`}
          tone={liveSummary.totalUnrealizedPnL >= 0 ? 'positive' : 'negative'}
        />
        <Card
          label="Unrealized %"
          value={`${liveSummary.totalUnrealizedPnLPercent.toFixed(2)}%`}
          tone={liveSummary.totalUnrealizedPnLPercent >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {liveSummary.redeemableCount > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4 text-sm text-blue-200">
          {liveSummary.redeemableCount} position{liveSummary.redeemableCount === 1 ? ' is' : 's are'} redeemable on-chain
          (the underlying market has resolved).
        </div>
      )}

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Market</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Outcome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Side</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Avg</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Mark</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Unrealized PnL</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">PnL %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {livePositions.map((pos, idx) => (
                <tr key={`${pos.conditionId}:${pos.asset}-${idx}`} className="hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      <span className="truncate" title={pos.marketTitle || ''}>{marketDisplayTitle(pos) || '-'}</span>
                      {pos.negRisk && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-900/50 text-amber-300 rounded uppercase tracking-wide" title="Multi-outcome (NegRisk) market">
                          NegRisk
                        </span>
                      )}
                      {pos.redeemable && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-green-900/50 text-green-300 rounded uppercase tracking-wide" title="Redeemable on-chain">
                          Redeemable
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                    {pos.outcomeName || pos.outcome}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sideBadgeClasses(pos.side)}`}>
                      {formatPositionLabel(pos)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right">{pos.size.toFixed(2)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right">{pos.avgPrice.toFixed(4)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right">{pos.currentPrice.toFixed(4)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right">${pos.currentValue.toFixed(2)}</td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${pos.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${pos.unrealizedPnL.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${pos.unrealizedPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pos.unrealizedPnLPercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const valueClass = tone === 'positive' ? 'text-green-400' : tone === 'negative' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
