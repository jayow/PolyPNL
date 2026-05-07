'use client';

import { ClosedPosition } from '@/types';

interface EventGroup {
  eventKey: string;
  eventTitle: string;
  positionsCount: number;
  totalRealizedPnL: number;
  wins: number;
  losses: number;
  winRate: number;
  biggestWin: number;
  biggestLoss: number;
  candidates: Array<{
    label: string;
    pnl: number;
    side: 'Long YES' | 'Long NO';
  }>;
}

interface Props {
  positions: ClosedPosition[];
}

export function groupNegRiskPositionsByEvent(positions: ClosedPosition[]): EventGroup[] {

  const groups = new Map<string, EventGroup>();

  for (const pos of positions) {
    if (!pos.negRisk) continue;
    const key = pos.eventSlug || pos.eventTitle || pos.conditionId;
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        eventKey: key,
        eventTitle: pos.eventTitle || pos.eventSlug || 'NegRisk event',
        positionsCount: 0,
        totalRealizedPnL: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        biggestWin: 0,
        biggestLoss: 0,
        candidates: [],
      });
    }

    const g = groups.get(key)!;
    g.positionsCount++;
    g.totalRealizedPnL += pos.realizedPnL;
    if (pos.realizedPnL > 0) g.wins++;
    else if (pos.realizedPnL < 0) g.losses++;
    g.biggestWin = Math.max(g.biggestWin, pos.realizedPnL);
    g.biggestLoss = Math.min(g.biggestLoss, pos.realizedPnL);
    g.candidates.push({
      label: pos.marketTitle || pos.outcomeName || pos.outcome,
      pnl: pos.realizedPnL,
      side: pos.side,
    });
  }

  for (const g of groups.values()) {
    const decided = g.wins + g.losses;
    g.winRate = decided > 0 ? (g.wins / decided) * 100 : 0;
    g.candidates.sort((a, b) => b.pnl - a.pnl);
  }

  return Array.from(groups.values()).sort((a, b) => b.totalRealizedPnL - a.totalRealizedPnL);
}

export default function NegRiskEventSummary({ positions }: Props) {
  const groups = groupNegRiskPositionsByEvent(positions);
  if (groups.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-white">By NegRisk Event</h2>
      <p className="text-sm text-gray-400 mb-4">
        Multi-outcome events grouped by their parent. Each row aggregates PnL across the
        individual candidate sub-markets you traded.
      </p>

      <div className="space-y-3">
        {groups.map((g) => (
          <details key={g.eventKey} className="bg-gray-800 rounded-lg border border-gray-700 group">
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-750 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-900/50 text-amber-300 rounded uppercase tracking-wide">
                  NegRisk
                </span>
                <span className="text-sm text-white truncate">{g.eventTitle}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {g.positionsCount} candidate{g.positionsCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <span className="text-gray-400">Win rate {g.winRate.toFixed(0)}%</span>
                <span className={g.totalRealizedPnL >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                  ${g.totalRealizedPnL.toFixed(2)}
                </span>
              </div>
            </summary>

            <div className="px-4 pb-4 pt-2 border-t border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                <Stat label="Wins" value={g.wins.toString()} />
                <Stat label="Losses" value={g.losses.toString()} />
                <Stat label="Biggest win" value={`$${g.biggestWin.toFixed(2)}`} tone="positive" />
                <Stat label="Biggest loss" value={`$${g.biggestLoss.toFixed(2)}`} tone="negative" />
              </div>


              <div className="bg-gray-900/40 rounded p-3">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Candidate breakdown</div>
                <ul className="space-y-1">
                  {g.candidates.map((c, idx) => (
                    <li key={`${g.eventKey}-${idx}`} className="flex items-center justify-between text-sm">
                      <span className="text-gray-200 truncate">
                        {c.side === 'Long YES' ? 'Long' : 'Short'} {c.label}
                      </span>
                      <span className={c.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ${c.pnl.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const valueClass = tone === 'positive' ? 'text-green-400' : tone === 'negative' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-gray-900/40 rounded p-2">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-base font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
