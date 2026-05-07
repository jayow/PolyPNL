'use client';

import { LedgerSummaryShape, PnLValidation, LedgerEventRow } from '@/types';

interface Props {
  ledger: { summary: LedgerSummaryShape; byEvent: LedgerEventRow[] } | null;
  validation: PnLValidation | null;
}

export default function AccuracyPanel({ ledger, validation }: Props) {
  if (!ledger || !validation) return null;

  const tone = validation.significantDiff ? 'warning' : 'ok';

  // Trading-only realized (ledger total minus rewards) for fair apples-to-apples
  // comparison with Polymarket's per-position realizedPnl, which doesn't include
  // wallet-level rebates/yield.
  const ledgerTradingOnly = ledger.summary.totalRealizedPnL - ledger.summary.globalRewards;
  const tradingDiff = ledgerTradingOnly - validation.polymarketRealizedPnL;

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
        We rebuild realized PnL from raw activity (every trade, split, merge, redeem,
        conversion, reward, and yield row), back out the cost basis of still-open positions
        so unrealized capital isn&apos;t booked as a loss, and cross-check against
        Polymarket&apos;s per-position number. The ledger is exact for NegRisk events
        because conversions net out at the event level.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card label="Realized (trading)" value={`$${ledgerTradingOnly.toFixed(2)}`} highlight={ledgerTradingOnly >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Card label="Rewards / yield" value={`+$${ledger.summary.totalRewards.toFixed(2)}`} highlight="text-green-300" />
        <Card label="Unrealized (open)" value={`$${ledger.summary.totalUnrealizedPnL.toFixed(2)}`} highlight={ledger.summary.totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Card
          label="Total realized"
          value={`$${ledger.summary.totalRealizedPnL.toFixed(2)}`}
          highlight={ledger.summary.totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Cross-check vs Polymarket per-position sum</div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-gray-400">Ledger trading</div>
            <div className="font-semibold text-white">${ledgerTradingOnly.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Polymarket trading</div>
            <div className="font-semibold text-white">${validation.polymarketRealizedPnL.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Diff</div>
            <div className={`font-semibold ${Math.abs(tradingDiff) > 100 ? 'text-amber-300' : 'text-green-300'}`}>
              {tradingDiff >= 0 ? '+' : ''}${tradingDiff.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {Math.abs(tradingDiff) > 100 && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-4 text-sm text-amber-200">
          <p className="font-semibold mb-1">Trading totals don&apos;t match exactly.</p>
          <p>
            The ledger sums every USDC movement; Polymarket&apos;s per-position
            <code className="px-1 bg-black/30 rounded mx-1">realizedPnl</code> attributes
            partial closes by FIFO and may differ on multi-leg positions.
            The ledger value above is what your wallet actually received in USDC.
          </p>
        </div>
      )}

      <details className="bg-gray-800 rounded-lg border border-gray-700">
        <summary className="px-4 py-3 cursor-pointer text-sm text-gray-300 hover:bg-gray-750 transition-colors">
          Activity breakdown ({ledger.summary.rowsProcessed} rows, {Object.keys(ledger.summary.rowsByType).length} types)
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-gray-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {Object.entries(ledger.summary.rowsByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="bg-gray-900/40 rounded p-2">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">{type}</div>
                  <div className="text-base font-semibold text-white">{count}</div>
                </div>
              ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
            <div>
              <div className="font-semibold text-gray-300 mb-1">Cash flow</div>
              <div>cashIn − cashOut: <span className="text-gray-200 font-mono">${ledger.summary.totalCashflow.toFixed(2)}</span></div>
              <div>+ open cost basis: <span className="text-gray-200 font-mono">${ledger.summary.totalOpenCostBasis.toFixed(2)}</span></div>
              <div>+ global rewards: <span className="text-gray-200 font-mono">${ledger.summary.globalRewards.toFixed(2)}</span></div>
              <div className="mt-1 pt-1 border-t border-gray-700">= total realized: <span className="text-gray-200 font-mono">${ledger.summary.totalRealizedPnL.toFixed(2)}</span></div>
            </div>
            <div>
              <div className="font-semibold text-gray-300 mb-1">Open positions</div>
              <div>Cost basis still deployed: <span className="text-gray-200 font-mono">${ledger.summary.totalOpenCostBasis.toFixed(2)}</span></div>
              <div>Unrealized PnL: <span className="text-gray-200 font-mono">${ledger.summary.totalUnrealizedPnL.toFixed(2)}</span></div>
            </div>
          </div>
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
