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
  // The Side column should reflect the actual outcome the user holds.
  //
  // - If the outcome is a real label (team name, multi-choice candidate),
  //   the user holds that outcome's token directly: "Long Knicks".
  // - If the outcome is literally Yes / No (every binary market, including
  //   NegRisk threshold sub-markets where the question is "will views be in
  //   bucket X?"), then the side is YES or NO — that's what the user bought.
  //   The bucket label ("64–66M") describes the MARKET, not the side, and is
  //   surfaced via marketDisplayTitle() instead.
  if (pos.outcomeName && !isYesNo(pos.outcomeName)) {
    return `Long ${pos.outcomeName.trim()}`;
  }
  return pos.side;
}

/**
 * What to show in the "Market" column. For grouped markets (NegRisk view
 * buckets, price thresholds, spreads), Polymarket's `groupItemTitle` is a
 * short readable label — "64–66M", "$102", "Spread -15.5" — preferable to
 * the long marketTitle question.
 */
export function marketDisplayTitle(pos: {
  marketTitle?: string;
  groupItemTitle?: string;
}): string {
  return (pos.groupItemTitle?.trim()) || (pos.marketTitle?.trim()) || '';
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
  // Show the outcome the user actually holds — team name, multi-choice
  // candidate, or YES/NO. Bucket labels ("64–66M") are NOT the outcome,
  // they're the market.
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
