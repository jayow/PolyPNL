import { ClosedPosition, OpenPosition } from '@/types';

type SideInput = 'Long YES' | 'Long NO';

/**
 * Format a position's side label for display. There are three cases:
 *
 * 1. Pure Yes/No binary ("Will it rain?", outcome ∈ {Yes, No}):
 *    show the canonical "Long YES" / "Long NO".
 *
 * 2. NegRisk multi-outcome event ("Who wins the election?"): each candidate
 *    sub-market is a binary YES/NO on that candidate, with the candidate name
 *    in marketTitle. "Long YES on Trump" reads as "Long Trump"; "Long NO on
 *    Trump" as "Short Trump".
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
}): string {
  // (2) NegRisk: candidate name lives in marketTitle.
  if (pos.negRisk && pos.marketTitle?.trim()) {
    const candidate = pos.marketTitle.trim();
    return pos.side === 'Long YES' ? `Long ${candidate}` : `Short ${candidate}`;
  }

  // (3) Outcome is a real label (team name, choice, etc.) rather than Yes/No.
  // The user holds that outcome's token directly; "Long {outcome}" is the
  // accurate description regardless of which outcomeIndex it sits at upstream.
  if (pos.outcomeName && !isYesNo(pos.outcomeName)) {
    return `Long ${pos.outcomeName.trim()}`;
  }

  // (1) Pure Yes/No binary — keep canonical labelling.
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
}): string {
  if (pos.negRisk && pos.marketTitle?.trim()) {
    return pos.marketTitle.trim();
  }
  if (pos.outcomeName?.trim()) {
    const v = pos.outcomeName.trim();
    return isYesNo(v) ? v.toUpperCase() : v;
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
