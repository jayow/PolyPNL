/**
 * Cash-flow ledger PnL engine.
 *
 * Replaces the FIFO engine for NegRisk-correct accuracy. Instead of trying to
 * match buys against sells (which breaks when CONVERSION / SPLIT / MERGE /
 * REDEEM events transmute tokens without a clean counterparty trade), we sum
 * every USDC inflow and outflow per event from /activity, then add back the
 * cost basis of still-open positions so we don't book unrealized capital
 * deployment as realized loss.
 *
 * Realized PnL identity:
 *
 *   realized_event = (cashIn_event - cashOut_event) + openCostBasis_event
 *
 *   - cashIn / cashOut: every USDC movement on the event from /activity
 *     (TRADE BUY/SELL, SPLIT, MERGE, REDEEM, CONVERSION, REWARD, etc.).
 *   - openCostBasis: dollars still tied up in tokens you haven't sold or
 *     redeemed yet. Sourced from /positions: sum(size * avgPrice) for any
 *     open asset whose conditionId is in this event.
 *
 *   Adding the open cost basis back removes the spend on currently-held
 *   tokens from "realized" — that capital isn't lost, it's deployed.
 *
 * Why event-level is exact for NegRisk:
 *
 *   Conversions are token transfers between candidate sub-markets within a
 *   single event. The USDC delta is the only thing that crosses the event
 *   boundary. cashIn - cashOut captures that delta exactly without needing
 *   onchain log reads.
 *
 * Activity types and how they post:
 *
 *   TRADE BUY                    cashOut += usdcSize   (asset, tokensIn += size)
 *   TRADE SELL                   cashIn  += usdcSize   (asset, tokensOut += size)
 *   SPLIT                        cashOut += usdcSize   (event)
 *   MERGE                        cashIn  += usdcSize   (event)
 *   REDEEM                       cashIn  += usdcSize   (asset + event)
 *   CONVERSION                   cashIn  += usdcSize   (event)
 *   REWARD/MAKER_REBATE/YIELD/   cashIn  += usdcSize, attributed to event
 *   REFERRAL_REWARD              if conditionId present, else to globalRewards.
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

/** Subset of PolymarketOpenPosition fields the ledger needs. */
export interface LedgerOpenPosition {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  eventSlug?: string;
  title?: string;
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
  firstTimestamp: number;
  lastTimestamp: number;
  marketTitle?: string;
  eventSlug?: string;
  icon?: string;
  slug?: string;
}

export interface EventBucket {
  eventKey: string;
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
  // Filled in once /positions data is folded in.
  openCostBasis: number;
  openCurrentValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  fullyClosed: boolean;
}

export interface LedgerSummary {
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalCashflow: number;       // cashIn - cashOut across all events
  totalOpenCostBasis: number;
  globalRewards: number;       // rewards/yield with no event attribution
  totalRewards: number;        // including event-attributed rewards
  rowsProcessed: number;
  rowsByType: Record<string, number>;
  rowsSkipped: number;
}

export interface LedgerResult {
  byAsset: AssetBucket[];
  byEvent: EventBucket[];
  summary: LedgerSummary;
}

const REWARD_TYPES = new Set(['REWARD', 'MAKER_REBATE', 'REFERRAL_REWARD', 'YIELD']);

function tsToMs(ts: number | string | undefined): number {
  if (ts == null) return 0;
  if (typeof ts === 'number') return ts < 1e12 ? ts * 1000 : ts;
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
    openCostBasis: 0,
    openCurrentValue: 0,
    unrealizedPnL: 0,
    realizedPnL: 0,
    fullyClosed: true,
  };
  map.set(key, fresh);
  return fresh;
}

export interface BuildLedgerOptions {
  /** Open positions from /positions, used to subtract still-deployed cost basis from "realized PnL". */
  openPositions?: LedgerOpenPosition[];
}

export function buildLedger(rows: RawActivity[], opts: BuildLedgerOptions = {}): LedgerResult {
  const byAsset = new Map<string, AssetBucket>();
  const byEvent = new Map<string, EventBucket>();
  const summary: LedgerSummary = {
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    totalCashflow: 0,
    totalOpenCostBasis: 0,
    globalRewards: 0,
    totalRewards: 0,
    rowsProcessed: 0,
    rowsByType: {},
    rowsSkipped: 0,
  };

  // Pre-index open positions by conditionId so we can attribute open cost basis
  // back to events even when /activity SPLIT/MERGE rows don't carry the asset.
  const openByConditionId = new Map<string, LedgerOpenPosition[]>();
  if (opts.openPositions) {
    for (const p of opts.openPositions) {
      if (!p.conditionId || !(p.size > 0)) continue;
      const arr = openByConditionId.get(p.conditionId) ?? [];
      arr.push(p);
      openByConditionId.set(p.conditionId, arr);
    }
  }

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
        if (eventBucket) {
          eventBucket.cashOut += usdc;
          eventBucket.splitsCount++;
        }
        break;
      }

      case 'MERGE': {
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
        if (eventBucket) {
          eventBucket.cashIn += usdc;
          eventBucket.conversionsCount++;
        }
        break;
      }

      case 'REWARD':
      case 'MAKER_REBATE':
      case 'REFERRAL_REWARD':
      case 'YIELD': {
        summary.totalRewards += usdc;
        if (eventBucket) {
          eventBucket.cashIn += usdc;
          eventBucket.rewardsTotal += usdc;
        } else {
          // Wallet-level reward (no event attribution) — held in a global
          // bucket and added to total realized at the end.
          summary.globalRewards += usdc;
        }
        break;
      }

      default: {
        summary.rowsSkipped++;
        break;
      }
    }
  }

  // Fold open positions into events: subtract still-deployed cost basis from
  // realized PnL, and surface unrealized PnL.
  for (const e of byEvent.values()) {
    let openCostBasis = 0;
    let openCurrentValue = 0;
    let openUnrealized = 0;
    let hasOpen = false;

    for (const cId of e.conditionIds) {
      const positions = openByConditionId.get(cId);
      if (!positions) continue;
      for (const p of positions) {
        hasOpen = true;
        openCostBasis += p.size * p.avgPrice;
        openCurrentValue += p.currentValue || 0;
        openUnrealized += p.cashPnl || 0;
      }
    }

    e.openCostBasis = openCostBasis;
    e.openCurrentValue = openCurrentValue;
    e.unrealizedPnL = openUnrealized;
    e.fullyClosed = !hasOpen;
    // Realized = cashflow + cost basis of still-deployed capital.
    e.realizedPnL = (e.cashIn - e.cashOut) + openCostBasis;
  }

  // Account for open positions in events that had no /activity rows but appear
  // in /positions (rare — but possible if user only bought via SPLIT etc.).
  if (opts.openPositions) {
    const seenEvents = new Set(byEvent.keys());
    for (const p of opts.openPositions) {
      if (!p.size) continue;
      const key = p.eventSlug || p.conditionId || '';
      if (!key || seenEvents.has(key)) continue;
      const e = ensureEvent(byEvent, key, { eventTitle: p.title });
      e.openCostBasis = p.size * p.avgPrice;
      e.openCurrentValue = p.currentValue || 0;
      e.unrealizedPnL = p.cashPnl || 0;
      e.fullyClosed = false;
      e.realizedPnL = e.openCostBasis; // cashflow is 0; realized is just cost-basis offset (=0 net)
    }
  }

  // Roll up totals.
  let totalCashflow = 0;
  let totalOpenCostBasis = 0;
  let totalUnrealized = 0;
  let eventRealizedSum = 0;
  for (const e of byEvent.values()) {
    totalCashflow += e.cashIn - e.cashOut;
    totalOpenCostBasis += e.openCostBasis;
    totalUnrealized += e.unrealizedPnL;
    eventRealizedSum += e.realizedPnL;
  }
  summary.totalCashflow = totalCashflow;
  summary.totalOpenCostBasis = totalOpenCostBasis;
  summary.totalUnrealizedPnL = totalUnrealized;
  // Realized = sum of per-event realized + global rewards (wallet-level rebates).
  summary.totalRealizedPnL = eventRealizedSum + summary.globalRewards;

  return {
    byAsset: Array.from(byAsset.values()),
    byEvent: Array.from(byEvent.values()),
    summary,
  };
}

export function realizedPnLForAsset(a: AssetBucket): number {
  return a.cashIn - a.cashOut;
}

export function realizedPnLForEvent(e: EventBucket): number {
  return e.realizedPnL;
}
