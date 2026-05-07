/**
 * CLOB V2 went live on Apr 28, 2026, around 11:00 UTC, migrating the
 * collateral token from USDC.e to pUSD. Both are 1:1 USD-denominated, so
 * dollar amounts are comparable across the boundary, but for transparency we
 * label which token a trade settled in.
 *
 * Reference: Polymarket changelog, Apr 28, 2026 entry.
 */
export const CLOB_V2_CUTOVER_MS = Date.UTC(2026, 3, 28, 11, 0, 0); // months are 0-indexed

export type CollateralToken = 'pUSD' | 'USDC.e';

export function collateralAtTimestamp(timestamp?: string | number | null): CollateralToken {
  if (timestamp == null) return 'pUSD';
  const ms = typeof timestamp === 'number'
    // Polymarket's Data API uses Unix seconds; treat values that look like
    // seconds as such, otherwise assume milliseconds.
    ? (timestamp < 1e12 ? timestamp * 1000 : timestamp)
    : new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return 'pUSD';
  return ms >= CLOB_V2_CUTOVER_MS ? 'pUSD' : 'USDC.e';
}

/**
 * Summarize collateral mix across a set of timestamped events. Useful when a
 * wallet's history straddles the migration.
 */
export function collateralMix(timestamps: Array<string | number | null | undefined>): {
  pUSDCount: number;
  USDCeCount: number;
  primary: CollateralToken;
  mixed: boolean;
} {
  let pUSDCount = 0;
  let USDCeCount = 0;
  for (const ts of timestamps) {
    if (collateralAtTimestamp(ts) === 'pUSD') pUSDCount++;
    else USDCeCount++;
  }
  const primary: CollateralToken = pUSDCount >= USDCeCount ? 'pUSD' : 'USDC.e';
  return {
    pUSDCount,
    USDCeCount,
    primary,
    mixed: pUSDCount > 0 && USDCeCount > 0,
  };
}
