// API Response Types
export interface ProxyWalletResponse {
  inputWallet: string;
  userAddressUsed: string;
  proxyWalletFound: boolean;
  proxyWallet?: string;
}

export interface PolymarketPublicProfile {
  wallet: string;
  proxyWallet?: string | null;
}

export interface PolymarketTrade {
  id: string;
  hash?: string;
  timestamp: string;
  user: string;
  conditionId?: string;
  tokenId?: string;
  outcome?: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  notional: number;
  fees?: number;
  eventTitle?: string;
  marketTitle?: string;
  outcomeName?: string;
  [key: string]: any; // Allow additional fields from API
}

export interface NormalizedTrade {
  trade_id: string;
  timestamp: string;
  user: string;
  conditionId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  notional: number;
  fees: number;
  eventTitle?: string;
  marketTitle?: string;
  outcomeName?: string;
  eventSlug?: string;
  slug?: string;
  icon?: string;
}

export interface TradeLot {
  qty: number;
  cost_basis: number;
  timestamp: string;
}

export interface ClosedPosition {
  conditionId: string;
  outcome: string;
  eventTitle?: string;
  marketTitle?: string;
  outcomeName?: string;
  side: 'Long YES' | 'Long NO';
  openedAt: string;
  closedAt: string | null;
  entryVWAP: number;
  exitVWAP: number;
  size: number;
  realizedPnL: number;
  realizedPnLPercent: number;
  tradesCount: number;
  open_qty_remaining?: number;
  avg_entry_price_open?: number;
  eventSlug?: string;
  slug?: string;
  icon?: string;
}

export interface PositionSummary {
  totalRealizedPnL: number;
  winrate: number;
  avgPnLPerPosition: number;
  totalPositionsClosed: number;
  biggestWin: number;
  biggestLoss: number;
  avgPosSize: number;
  avgHoldingTime: number; // in days
  mostUsedCategory: string;
}

export interface MarketMetadata {
  eventTitle?: string;
  marketTitle?: string;
  outcomeName?: string;
}

// Polymarket API Response for closed positions
export interface PolymarketClosedPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  avgPrice: number;
  totalBought: number;
  realizedPnl: number;
  curPrice: number;
  timestamp: number; // Unix timestamp
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
  outcomeIndex?: number;
  oppositeOutcome?: string;
  oppositeAsset?: string;
  endDate?: string;
}
