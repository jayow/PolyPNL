import { ClosedPosition, OpenPosition } from '@/types';

type SideInput = 'Long YES' | 'Long NO';

/**
 * Format a position's side label for display. There are three cases:
 *
 * 1. Pure Yes/No binary ("Will it rain?", outcome ∈ {Yes, No}):
 *    show the canonical "Long YES" / "Long NO".
 *
 * 2. NegRisk multi-outcome event ("Who wins the election?", "MrBeast video
 *    views day 3"): each sub-market is binary YES/NO on a specific candidate
 *    or threshold. Polymarket exposes the short candidate label on each
 *    sub-market as `groupItemTitle` ("Donald Trump", "64–66M"). When that's
 *    available, "Long YES on 64–66M" reads as "Long 64–66M"; "Long NO" as
 *    "Short 64–66M". If groupItemTitle isn't present, fall back to the long
 *    marketTitle question rather than misleadingly labelling it Yes/No.
 *
 * 3. Non-Yes/No binary outcomes (sports games like "76ers vs. Knicks", where
 *    Polymarket uses team names directly as outcomes): the user holds tokens
 *    of one specific outcome. Show "Long {team}" — there's no "Long YES"
 *    semantic to map onto, the asset itself is the team's token.
 */
export function formatPositionLabel(pos: {
  side: SideInput;
  negRisk?: boolean;
  marketTitle?: string;
  outcomeName?: string;
  groupItemTitle?: string;
}): string {
  // 1) Outcome itself is a real label (team name, multi-choice option) rather
  //    than Yes/No. The user holds that outcome's token directly. "Long Knicks".
  if (pos.outcomeName && !isYesNo(pos.outcomeName)) {
    return `Long ${pos.outcomeName.trim()}`;
  }

  // 2) Grouped sub-market (NegRisk threshold buckets, price targets,
  //    spreads, etc.). Polymarket gives us a short bucket label in
  //    groupItemTitle ("64–66M", "$102", "Spread -15.5"). When outcome is
  //    Yes/No, that short label is the meaningful thing the user bet on.
  if (pos.groupItemTitle?.trim()) {
    const candidate = pos.groupItemTitle.trim();
    return pos.side === 'Long YES' ? `Long ${candidate}` : `Short ${candidate}`;
  }

  // 3) NegRisk event without groupItemTitle — fall back to the long question
  //    rather than misleadingly saying "Long YES" on an opaque sub-market.
  if (pos.negRisk && pos.marketTitle?.trim()) {
    const candidate = pos.marketTitle.trim();
    return pos.side === 'Long YES' ? `Long ${candidate}` : `Short ${candidate}`;
  }

  // 4) Pure Yes/No binary ("Will it rain tomorrow?") — keep canonical labels.
  return pos.side;
}

function isYesNo(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === 'yes' || v === 'no' || v === 'true' || v === 'false';
}

/**
 * Is this position a "real" binary Yes/No bet? Only positions where the
 * outcome is literally "Yes" / "No" / "True" / "False" qualify. Sports
 * games (Knicks vs 76ers), multi-choice, and any other non-binary-named
 * outcomes are NOT Yes/No bets even though they may be 2-outcome markets
 * under the hood. Filter analytics on this so things like "win rate on
 * NO bets" don't get polluted by team bets that happen to live at
 * outcomeIndex 1.
 */
export function isBinaryYesNoOutcome(pos: { outcomeName?: string }): boolean {
  if (!pos.outcomeName) return false;
  return isYesNo(pos.outcomeName);
}

/**
 * Short, prominent label for cards and badges. Returns the actual outcome
 * the user holds — team name for sports, candidate for NegRisk, "YES"/"NO"
 * for binary Yes/No markets.
 */
export function shortOutcomeLabel(pos: {
  side: SideInput;
  negRisk?: boolean;
  marketTitle?: string;
  outcomeName?: string;
  groupItemTitle?: string;
}): string {
  // Real outcome label (team / choice) — show it directly.
  if (pos.outcomeName && !isYesNo(pos.outcomeName)) {
    return pos.outcomeName.trim();
  }
  // Grouped sub-market with a short bucket label.
  if (pos.groupItemTitle?.trim()) {
    return pos.groupItemTitle.trim();
  }
  // NegRisk fallback — long question better than misleading YES/NO.
  if (pos.negRisk && pos.marketTitle?.trim()) {
    return pos.marketTitle.trim();
  }
  // Pure Yes/No.
  if (pos.outcomeName?.trim()) {
    return pos.outcomeName.trim().toUpperCase();
  }
  return pos.side === 'Long YES' ? 'YES' : 'NO';
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
