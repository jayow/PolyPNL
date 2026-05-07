'use client';

import { OpenPosition, OpenPositionsSummary } from '@/types';
import { formatPositionLabel, sideBadgeClasses } from '@/lib/position-display';

interface Props {
  positions: OpenPosition[];
  summary: OpenPositionsSummary | null;
  loading?: boolean;
  error?: string | null;
}

export default function OpenPositions({ positions, summary, loading, error }: Props) {
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

  if (!summary || positions.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-white">Open Positions</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card label="Open Positions" value={summary.positionsCount.toString()} />
        <Card label="Current Value" value={`$${summary.totalCurrentValue.toFixed(2)}`} />
        <Card
          label="Unrealized PnL"
          value={`$${summary.totalUnrealizedPnL.toFixed(2)}`}
          tone={summary.totalUnrealizedPnL >= 0 ? 'positive' : 'negative'}
        />
        <Card
          label="Unrealized %"
          value={`${summary.totalUnrealizedPnLPercent.toFixed(2)}%`}
          tone={summary.totalUnrealizedPnLPercent >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {summary.redeemableCount > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4 text-sm text-blue-200">
          {summary.redeemableCount} position{summary.redeemableCount === 1 ? ' is' : 's are'} redeemable on-chain
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
              {positions.map((pos, idx) => (
                <tr key={`${pos.conditionId}:${pos.asset}-${idx}`} className="hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{pos.marketTitle || '-'}</span>
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
