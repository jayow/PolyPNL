'use client';

import { LedgerSummaryShape, PnLValidation, LedgerEventRow } from '@/types';

interface Props {
  ledger: { summary: LedgerSummaryShape; byEvent: LedgerEventRow[] } | null;
  validation: PnLValidation | null;
}

export default function AccuracyPanel({ ledger, validation }: Props) {
  if (!ledger || !validation) return null;

  const tone = validation.significantDiff ? 'warning' : 'ok';
  const headlineClass = tone === 'warning' ? 'text-amber-300' : 'text-green-300';

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-2xl font-bold text-white">Accuracy check</h2>
        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${
          tone === 'warning' ? 'bg-amber-900/50 text-amber-300' : 'bg-green-900/50 text-green-300'
        }`}>
          {tone === 'warning' ? 'Review' : 'OK'}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        We rebuild realized PnL from raw activity (trades, splits, merges, redeems, conversions,
        rewards) and cross-check against Polymarket&apos;s per-position number. The ledger is exact
        for NegRisk events because conversions and redemptions net out at the event level.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Card label="Ledger realized PnL" value={`$${ledger.summary.totalRealizedPnL.toFixed(2)}`} highlight={headlineClass} />
        <Card label="Polymarket per-position" value={`$${validation.polymarketRealizedPnL.toFixed(2)}`} />
        <Card
          label="Difference"
          value={`${validation.diff >= 0 ? '+' : ''}$${validation.diff.toFixed(2)}`}
          highlight={tone === 'warning' ? 'text-amber-300' : 'text-gray-400'}
        />
      </div>

      {validation.significantDiff && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-4 text-sm text-amber-200">
          <p className="font-semibold mb-1">Numbers don&apos;t match exactly.</p>
          <p>
            Most common reasons: NegRisk conversion gains/losses that the per-position view
            doesn&apos;t fully attribute, redemption rewards on resolved markets, or
            maker/referral rebates. The ledger total above is what your wallet actually
            received in USDC across all activity.
          </p>
        </div>
      )}

      <details className="bg-gray-800 rounded-lg border border-gray-700">
        <summary className="px-4 py-3 cursor-pointer text-sm text-gray-300 hover:bg-gray-750 transition-colors">
          Activity breakdown ({ledger.summary.rowsProcessed} rows)
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-gray-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(ledger.summary.rowsByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="bg-gray-900/40 rounded p-2">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">{type}</div>
                  <div className="text-base font-semibold text-white">{count}</div>
                </div>
              ))}
          </div>
          {ledger.summary.totalRewards > 0 && (
            <div className="mt-3 text-xs text-gray-400">
              Rewards / rebates accrued: <span className="text-green-300 font-semibold">${ledger.summary.totalRewards.toFixed(2)}</span>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${highlight || 'text-white'}`}>{value}</div>
    </div>
  );
}
