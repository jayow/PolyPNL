/**
 * Cash-flow ledger PnL engine.
 *
 * Replaces the FIFO engine for NegRisk-correct accuracy. Instead of trying to
 * match buys against sells (which breaks when CONVERSION / SPLIT / MERGE /
 * REDEEM events transmute tokens without a clean counterparty trade), we
 * sum every USDC inflow and outflow for each (asset, event) bucket directly
 * from /activity rows.
 *
 * Why this is accurate for NegRisk:
 *   At the EVENT level, conversions are pure USDC deltas — the token sides
 *   net out within the event (a NO -> (YES + USDC) conversion still leaves
 *   the event's total token-collateral balance unchanged). So summing
 *   cash_in - cash_out per event gives the true realized PnL for resolved
 *   NegRisk events without needing onchain reads.
 *
 * Activity types and how they post to the ledger:
 *   TRADE  BUY  : cash_out += usdcSize, tokens_in += size  (asset)
 *   TRADE  SELL : cash_in  += usdcSize, tokens_out += size (asset)
 *   SPLIT       : cash_out += usdcSize, both YES+NO of conditionId minted
 *   MERGE       : cash_in  += usdcSize, both YES+NO of conditionId burned
 *   REDEEM      : cash_in  += usdcSize, tokens_out += size (asset)
 *   CONVERSION  : cash_in  += usdcSize  (NegRiskAdapter pays USDC; token
 *                                         transfers are internal to the event
 *                                         and net out at event scope)
 *   REWARD / MAKER_REBATE / REFERRAL_REWARD: cash_in += usdcSize (event-level
 *                                                                  if conditionId
 *                                                                  present, else
 *                                                                  unattributed)
 */

export interface RawActivity {
  type: string;
  side?: 'BUY' | 'SELL';
  size?: number;
  usdcSize?: number;
  price?: number;
  asset?: string;
  conditionId?: string;
  outcome?: string;
  outcomeIndex?: number;
  timestamp: number | string;
  transactionHash?: string;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  [key: string]: any;
}

export interface AssetBucket {
  asset: string;
  conditionId: string;
  outcome?: string;
  outcomeIndex?: number;
  cashIn: number;
  cashOut: number;
  tokensIn: number;
  tokensOut: number;
  tradesCount: number;
  firstTimestamp: number; // ms
  lastTimestamp: number;  // ms
  marketTitle?: string;
  eventSlug?: string;
  icon?: string;
  slug?: string;
}

export interface EventBucket {
  eventKey: string;        // eventSlug or conditionId fallback
  eventTitle?: string;
  cashIn: number;
  cashOut: number;
  tradesCount: number;
  splitsCount: number;
  mergesCount: number;
  redemptionsCount: number;
  conversionsCount: number;
  rewardsTotal: number;
  conditionIds: Set<string>;
}

export interface LedgerSummary {
  totalRealizedPnL: number;
  totalCashIn: number;
  totalCashOut: number;
  totalRewards: number;
  rowsProcessed: number;
  rowsByType: Record<string, number>;
  rowsSkipped: number; // malformed / unknown types
}

export interface LedgerResult {
  byAsset: AssetBucket[];
  byEvent: EventBucket[];
  summary: LedgerSummary;
}

const REWARD_TYPES = new Set(['REWARD', 'MAKER_REBATE', 'REFERRAL_REWARD']);

function tsToMs(ts: number | string | undefined): number {
  if (ts == null) return 0;
  if (typeof ts === 'number') {
    return ts < 1e12 ? ts * 1000 : ts;
  }
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function ensureAsset(map: Map<string, AssetBucket>, key: string, seed: Partial<AssetBucket>): AssetBucket {
  const existing = map.get(key);
  if (existing) return existing;
  const fresh: AssetBucket = {
    asset: seed.asset || key,
    conditionId: seed.conditionId || '',
    outcome: seed.outcome,
    outcomeIndex: seed.outcomeIndex,
    cashIn: 0,
    cashOut: 0,
    tokensIn: 0,
    tokensOut: 0,
    tradesCount: 0,
    firstTimestamp: Number.POSITIVE_INFINITY,
    lastTimestamp: 0,
    marketTitle: seed.marketTitle,
    eventSlug: seed.eventSlug,
    icon: seed.icon,
    slug: seed.slug,
  };
  map.set(key, fresh);
  return fresh;
}

function ensureEvent(map: Map<string, EventBucket>, key: string, seed: Partial<EventBucket>): EventBucket {
  const existing = map.get(key);
  if (existing) return existing;
  const fresh: EventBucket = {
    eventKey: key,
    eventTitle: seed.eventTitle,
    cashIn: 0,
    cashOut: 0,
    tradesCount: 0,
    splitsCount: 0,
    mergesCount: 0,
    redemptionsCount: 0,
    conversionsCount: 0,
    rewardsTotal: 0,
    conditionIds: new Set(),
  };
  map.set(key, fresh);
  return fresh;
}

export function buildLedger(rows: RawActivity[]): LedgerResult {
  const byAsset = new Map<string, AssetBucket>();
  const byEvent = new Map<string, EventBucket>();
  const summary: LedgerSummary = {
    totalRealizedPnL: 0,
    totalCashIn: 0,
    totalCashOut: 0,
    totalRewards: 0,
    rowsProcessed: 0,
    rowsByType: {},
    rowsSkipped: 0,
  };

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      summary.rowsSkipped++;
      continue;
    }
    const type = (row.type || '').toUpperCase();
    summary.rowsByType[type] = (summary.rowsByType[type] || 0) + 1;
    summary.rowsProcessed++;

    const usdc = typeof row.usdcSize === 'number' ? row.usdcSize : 0;
    const size = typeof row.size === 'number' ? row.size : 0;
    const tsMs = tsToMs(row.timestamp);
    const eventKey = row.eventSlug || row.conditionId || '';
    const assetKey = row.asset || `${row.conditionId || ''}:${row.outcomeIndex ?? ''}`;

    const eventBucket = eventKey
      ? ensureEvent(byEvent, eventKey, { eventTitle: row.title })
      : null;
    if (eventBucket && row.conditionId) eventBucket.conditionIds.add(row.conditionId);

    const seedAsset: Partial<AssetBucket> = {
      asset: row.asset,
      conditionId: row.conditionId,
      outcome: row.outcome,
      outcomeIndex: row.outcomeIndex,
      marketTitle: row.title,
      eventSlug: row.eventSlug,
      icon: row.icon,
      slug: row.slug,
    };

    const touchAssetTime = (a: AssetBucket) => {
      if (tsMs && tsMs < a.firstTimestamp) a.firstTimestamp = tsMs;
      if (tsMs && tsMs > a.lastTimestamp) a.lastTimestamp = tsMs;
    };

    switch (type) {
      case 'TRADE': {
        if (!row.asset) {
          summary.rowsSkipped++;
          break;
        }
        const asset = ensureAsset(byAsset, assetKey, seedAsset);
        if (row.side === 'BUY') {
          asset.cashOut += usdc;
          asset.tokensIn += size;
          if (eventBucket) eventBucket.cashOut += usdc;
        } else if (row.side === 'SELL') {
          asset.cashIn += usdc;
          asset.tokensOut += size;
          if (eventBucket) eventBucket.cashIn += usdc;
        } else {
          summary.rowsSkipped++;
          break;
        }
        asset.tradesCount++;
        touchAssetTime(asset);
        if (eventBucket) eventBucket.tradesCount++;
        break;
      }

      case 'SPLIT': {
        // User pays USDC, receives YES+NO pair. Asset is typically empty.
        if (eventBucket) {
          eventBucket.cashOut += usdc;
          eventBucket.splitsCount++;
        }
        break;
      }

      case 'MERGE': {
        // User burns YES+NO pair, gets USDC. Asset is typically empty.
        if (eventBucket) {
          eventBucket.cashIn += usdc;
          eventBucket.mergesCount++;
        }
        break;
      }

      case 'REDEEM': {
        if (row.asset) {
          const asset = ensureAsset(byAsset, assetKey, seedAsset);
          asset.cashIn += usdc;
          asset.tokensOut += size;
          touchAssetTime(asset);
        }
        if (eventBucket) {
          eventBucket.cashIn += usdc;
          eventBucket.redemptionsCount++;
        }
        break;
      }

      case 'CONVERSION': {
        // NegRiskAdapter pays USDC; token transfers are internal to the
        // event and net out at event scope. Asset-level attribution would
        // require parsing onchain logs, which we skip — the asset-level
        // PnL for NegRisk events is approximate; the event-level number
        // is exact.
        if (eventBucket) {
          eventBucket.cashIn += usdc;
          eventBucket.conversionsCount++;
        }
        break;
      }

      case 'REWARD':
      case 'MAKER_REBATE':
      case 'REFERRAL_REWARD': {
        summary.totalRewards += usdc;
        if (eventBucket) {
          eventBucket.cashIn += usdc;
          eventBucket.rewardsTotal += usdc;
        }
        break;
      }

      default: {
        // Unknown type — count it but don't post to ledger.
        summary.rowsSkipped++;
        break;
      }
    }
  }

  // Realized PnL totals
  for (const a of byAsset.values()) {
    summary.totalCashIn += a.cashIn;
    summary.totalCashOut += a.cashOut;
  }
  // Add event-level totals that aren't asset-attributable (SPLIT/MERGE/CONVERSION).
  // Avoid double-counting trades/redeems already in asset totals.
  for (const e of byEvent.values()) {
    const tradeRedeemSpread = 0; // placeholder if we later split out
    // We don't add event cash to totals since asset cash is the source of truth
    // for trade+redeem; event-only flows (split/merge/conversion/reward) need a
    // separate accumulation.
    void tradeRedeemSpread;
  }
  // Net: total realized PnL = sum across events (cashIn - cashOut), since events
  // capture every flow we attribute. Use event totals as the authoritative number.
  let eventNet = 0;
  for (const e of byEvent.values()) eventNet += e.cashIn - e.cashOut;
  // Add unattributed rewards (no event/conditionId) from the running total —
  // those are already captured per-event when conditionId was present, but if
  // conditionId is missing we still want them in the grand total.
  let attributedRewards = 0;
  for (const e of byEvent.values()) attributedRewards += e.rewardsTotal;
  const unattributedRewards = Math.max(0, summary.totalRewards - attributedRewards);
  summary.totalRealizedPnL = eventNet + unattributedRewards;

  return {
    byAsset: Array.from(byAsset.values()),
    byEvent: Array.from(byEvent.values()),
    summary,
  };
}

/**
 * Compute realized PnL per asset = cashIn - cashOut. For OPEN positions
 * (tokensIn > tokensOut), that number understates true PnL because the
 * remaining tokens haven't been monetized yet. Caller is expected to layer
 * mark-to-market unrealized PnL from /positions on top.
 */
export function realizedPnLForAsset(a: AssetBucket): number {
  return a.cashIn - a.cashOut;
}

export function realizedPnLForEvent(e: EventBucket): number {
  return e.cashIn - e.cashOut;
}
