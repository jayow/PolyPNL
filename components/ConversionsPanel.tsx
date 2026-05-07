'use client';

import { NegRiskActivity } from '@/types';

interface Props {
  activities: NegRiskActivity[];
  loading?: boolean;
  error?: string | null;
}

export default function ConversionsPanel({ activities, loading, error }: Props) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-8 text-sm text-gray-400">
        Loading conversion / redemption activity…
      </div>
    );
  }

  if (error) {
    // Silent — we don't want to scare the user with a partial-data warning if
    // the activity feed simply has no events for them.
    return null;
  }

  if (!activities || activities.length === 0) return null;

  const conversions = activities.filter((a) => a.type === 'CONVERSION');
  const redemptions = activities.filter((a) => a.type === 'REDEEM');

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2 text-white">Conditional-token activity</h2>
      <p className="text-sm text-gray-400 mb-3">
        NegRisk conversions and on-chain redemptions for this wallet. These events sit
        alongside trades but aren&apos;t modelled by the FIFO PnL above — treat the
        per-position PnL as an approximation when there are conversions on a NegRisk event.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-xs text-gray-400 uppercase tracking-wide">NegRisk Conversions</div>
          <div className="text-2xl font-bold text-amber-300">{conversions.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Redemptions</div>
          <div className="text-2xl font-bold text-blue-300">{redemptions.length}</div>
        </div>
      </div>

      <details className="bg-gray-800 rounded-lg border border-gray-700">
        <summary className="px-4 py-3 cursor-pointer text-sm text-gray-300 hover:bg-gray-750 transition-colors">
          Show recent events ({Math.min(activities.length, 25)} of {activities.length})
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="py-2">Type</th>
                <th className="py-2">When</th>
                <th className="py-2">Market / Event</th>
                <th className="py-2 text-right">Size</th>
                <th className="py-2 text-right">USDC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {activities.slice(0, 25).map((a, idx) => (
                <tr key={`${a.timestamp}-${idx}`} className="text-sm text-gray-200">
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${
                      a.type === 'CONVERSION'
                        ? 'bg-amber-900/50 text-amber-300'
                        : 'bg-blue-900/50 text-blue-300'
                    }`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400 whitespace-nowrap">
                    {new Date(a.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2 truncate max-w-xs">{a.marketTitle || a.eventTitle || a.conditionId || '-'}</td>
                  <td className="py-2 text-right">{a.size != null ? a.size.toFixed(2) : '-'}</td>
                  <td className="py-2 text-right">{a.usdcAmount != null ? `$${a.usdcAmount.toFixed(2)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
