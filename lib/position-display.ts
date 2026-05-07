import { ClosedPosition, OpenPosition } from '@/types';

type SideInput = 'Long YES' | 'Long NO';

/**
 * Format a position's side label for display.
 *
 * Binary markets ("Will it rain?"): keep the canonical "Long YES" / "Long NO".
 *
 * Multi-outcome (NegRisk) events ("Who will win the election?"): the
 * underlying market is still binary YES/NO on a specific candidate, but a
 * "Long YES on Trump" is more readable as "Long Trump", and "Long NO on Trump"
 * as "Short Trump". The candidate name is carried on each sub-market's title.
 */
export function formatPositionLabel(pos: {
  side: SideInput;
  negRisk?: boolean;
  marketTitle?: string;
  outcomeName?: string;
}): string {
  if (!pos.negRisk) return pos.side;

  // Prefer marketTitle for multi-outcome events (it's the candidate name in
  // Polymarket's structure). Fall back to outcomeName, then the raw side.
  const candidate = (pos.marketTitle && pos.marketTitle.trim())
    || (pos.outcomeName && pos.outcomeName.trim() && !isYesNo(pos.outcomeName) ? pos.outcomeName : '');
  if (!candidate) return pos.side;

  return pos.side === 'Long YES' ? `Long ${candidate}` : `Short ${candidate}`;
}

function isYesNo(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === 'yes' || v === 'no' || v === 'true' || v === 'false';
}

/**
 * Tailwind classes for the side badge. Direction-based so "Short Trump" reads
 * the same as "Long NO" visually (both are bearish bets).
 */
export function sideBadgeClasses(side: SideInput): string {
  return side === 'Long YES'
    ? 'bg-blue-900/50 text-blue-300'
    : 'bg-purple-900/50 text-purple-300';
}

export type DisplayablePosition = ClosedPosition | OpenPosition;
