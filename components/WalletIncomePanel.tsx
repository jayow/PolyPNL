'use client';

import { OpenPositionsSummary, PositionSummary } from '@/types';

interface Props {
  realizedSummary: PositionSummary | null;
  openSummary: OpenPositionsSummary | null;
  rewards: { total: number; byType: Record<string, number> } | null;
}

/**
 * Single, defensible source per number:
 *   Realized PnL    -> sum of /closed-positions realizedPnl (Polymarket's own field)
 *   Unrealized PnL  -> sum of /positions cashPnl (Polymarket's own field)
 *   Rewards / yield -> sum of REWARD/MAKER_REBATE/REFERRAL_REWARD/YIELD rows from /activity
 *
 * No competing totals, no internal cross-checks shown to the user — every
 * figure cites a specific upstream Polymarket endpoint.
 */
export default function WalletIncomePanel({ realizedSummary, openSummary, rewards }: Props) {
  if (!realizedSummary && !openSummary && !rewards) return null;

  const realized = realizedSummary?.totalRealizedPnL ?? 0;
  const unrealized = openSummary?.totalUnrealizedPnL ?? 0;
  const rewardsTotal = rewards?.total ?? 0;
  const totalNet = realized + unrealized + rewardsTotal;

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-3 text-white">Wallet income</h2>
      <p className="text-sm text-gray-400 mb-4">
        Each number below comes from one Polymarket endpoint. No estimation or reconciliation.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card
          label="Realized (closed positions)"
          value={fmt(realized)}
          tone={realized >= 0 ? 'positive' : 'negative'}
          source="/closed-positions"
        />
        <Card
          label="Unrealized (open positions)"
          value={fmt(unrealized)}
          tone={unrealized >= 0 ? 'positive' : 'negative'}
          source="/positions"
        />
        <Card
          label="Rewards & yield"
          value={fmt(rewardsTotal, true)}
          tone="positive"
          source="/activity"
        />
        <Card
          label="Net total"
          value={fmt(totalNet)}
          tone={totalNet >= 0 ? 'positive' : 'negative'}
          source="sum of the three above"
          emphasis
        />
      </div>

      {rewards && rewards.total > 0 && (
        <details className="bg-gray-800 rounded-lg border border-gray-700">
          <summary className="px-4 py-3 cursor-pointer text-sm text-gray-300 hover:bg-gray-750 transition-colors">
            Rewards breakdown
          </summary>
          <div className="px-4 pb-4 pt-2 border-t border-gray-700">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(rewards.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, amount]) => (
                  <div key={type} className="bg-gray-900/40 rounded p-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">{type}</div>
                    <div className="text-base font-semibold text-green-300">${amount.toFixed(2)}</div>
                  </div>
                ))}
            </div>
          </div>
        </details>
      )}
    </section>
  );
}

function fmt(n: number, alwaysSign = false): string {
  const sign = n >= 0 ? (alwaysSign ? '+' : '') : '';
  return `${sign}$${n.toFixed(2)}`;
}

function Card({
  label,
  value,
  tone,
  source,
  emphasis,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
  source: string;
  emphasis?: boolean;
}) {
  const valueClass = tone === 'positive' ? 'text-green-400' : 'text-red-400';
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${emphasis ? 'border-gray-500' : 'border-gray-700'}`}>
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-1 font-mono">{source}</div>
    </div>
  );
}
