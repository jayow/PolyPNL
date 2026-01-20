import { NormalizedTrade, ClosedPosition, TradeLot } from '@/types';

/**
 * FIFO PnL Calculation Engine
 * 
 * Tracks lots (buy positions) and matches sells against them in FIFO order.
 * Computes realized PnL when positions are fully or partially closed.
 */
export class FIFOPnLEngine {
  // Map: conditionId:outcome -> array of lots
  private lots: Map<string, TradeLot[]> = new Map();
  // Map: conditionId:outcome -> array of closed positions
  private closedPositions: Map<string, ClosedPosition[]> = new Map();
  // Map: conditionId:outcome -> aggregate stats for tracking current position
  private currentPositions: Map<string, {
    totalBuys: number;
    totalSells: number;
    netQty: number;
    totalBuyValue: number;
    totalSellValue: number;
    totalFees: number;
    firstBuyTime: string;
    lastSellTime: string | null;
    trades: NormalizedTrade[];
  }> = new Map();

  /**
   * Process a single trade and update lot tracking
   */
  processTrade(trade: NormalizedTrade): void {
    const key = `${trade.conditionId}:${trade.outcome}`;
    
    // Initialize position tracking if needed
    if (!this.currentPositions.has(key)) {
      this.currentPositions.set(key, {
        totalBuys: 0,
        totalSells: 0,
        netQty: 0,
        totalBuyValue: 0,
        totalSellValue: 0,
        totalFees: 0,
        firstBuyTime: trade.timestamp,
        lastSellTime: null,
        trades: [],
      });
    }

    const position = this.currentPositions.get(key)!;
    position.trades.push(trade);
    position.totalFees += trade.fees;

    if (trade.side === 'BUY') {
      this.processBuy(trade, key);
    } else {
      this.processSell(trade, key);
    }
  }

  private processBuy(trade: NormalizedTrade, key: string): void {
    // Add new lot
    if (!this.lots.has(key)) {
      this.lots.set(key, []);
    }

    const lot: TradeLot = {
      qty: trade.size,
      cost_basis: trade.notional + trade.fees,
      timestamp: trade.timestamp,
    };

    this.lots.get(key)!.push(lot);

    const position = this.currentPositions.get(key)!;
    position.totalBuys += trade.size;
    position.netQty += trade.size;
    position.totalBuyValue += trade.notional + trade.fees;
    
    if (trade.timestamp < position.firstBuyTime) {
      position.firstBuyTime = trade.timestamp;
    }
  }

  private processSell(trade: NormalizedTrade, key: string): void {
    const lots = this.lots.get(key) || [];
    const position = this.currentPositions.get(key)!;

    let remainingSellQty = trade.size;
    const sellProceeds = trade.notional - trade.fees;
    let totalCostBasis = 0;
    let consumedQty = 0;

    // Consume lots in FIFO order
    while (remainingSellQty > 0 && lots.length > 0) {
      const lot = lots[0];
      
      if (lot.qty <= remainingSellQty) {
        // Fully consume this lot
        consumedQty += lot.qty;
        totalCostBasis += lot.cost_basis;
        remainingSellQty -= lot.qty;
        lots.shift();
      } else {
        // Partially consume this lot
        const consumedRatio = remainingSellQty / lot.qty;
        consumedQty += remainingSellQty;
        totalCostBasis += lot.cost_basis * consumedRatio;
        lot.qty -= remainingSellQty;
        lot.cost_basis = lot.cost_basis * (1 - consumedRatio);
        remainingSellQty = 0;
      }
    }

    if (remainingSellQty > 0) {
      // More sells than buys - invalid state
      // Clamp: treat excess as zero cost basis (realized PnL = full proceeds)
      console.warn(`Sell exceeds buys for ${key}. Excess: ${remainingSellQty}`);
      totalCostBasis += 0; // Excess sells have no cost basis
      consumedQty = trade.size; // Still track the full sell
    }

    if (consumedQty > 0) {
      const realizedPnL = sellProceeds - totalCostBasis;
      const realizedPnLPercent = totalCostBasis > 0 
        ? (realizedPnL / totalCostBasis) * 100 
        : 100;

      // Track this closed position segment
      if (!this.closedPositions.has(key)) {
        this.closedPositions.set(key, []);
      }

      // Get metadata from the first trade for this position
      const firstTrade = position.trades[0];
      
      const closedPosition: ClosedPosition = {
        conditionId: trade.conditionId,
        outcome: trade.outcome,
        eventTitle: trade.eventTitle || firstTrade?.eventTitle,
        marketTitle: trade.marketTitle || firstTrade?.marketTitle,
        outcomeName: trade.outcomeName || firstTrade?.outcomeName,
        side: this.determineSide(trade.outcome),
        openedAt: position.firstBuyTime,
        closedAt: position.netQty === 0 ? trade.timestamp : null,
        entryVWAP: totalCostBasis / consumedQty,
        exitVWAP: sellProceeds / consumedQty,
        size: consumedQty,
        realizedPnL,
        realizedPnLPercent,
        tradesCount: 1, // Will be aggregated later
        open_qty_remaining: position.netQty > 0 ? position.netQty : undefined,
        avg_entry_price_open: position.netQty > 0 
          ? (position.totalBuyValue - totalCostBasis) / position.netQty 
          : undefined,
        eventSlug: trade.eventSlug || firstTrade?.eventSlug,
        slug: trade.slug || firstTrade?.slug,
        icon: trade.icon || firstTrade?.icon,
        category: trade.category || firstTrade?.category,
        tags: trade.tags || firstTrade?.tags,
      };

      this.closedPositions.get(key)!.push(closedPosition);
    }

    // Update position stats
    position.totalSells += trade.size;
    position.netQty -= trade.size;
    position.totalSellValue += sellProceeds;
    position.lastSellTime = trade.timestamp;

    // If position is fully closed, finalize any remaining closed positions
    if (position.netQty === 0 && lots.length === 0) {
      // Mark all closed positions for this key as fully closed
      const closed = this.closedPositions.get(key) || [];
      closed.forEach(cp => {
        if (!cp.closedAt) {
          cp.closedAt = trade.timestamp;
        }
      });
    }
  }

  private determineSide(outcome: string): 'Long YES' | 'Long NO' {
    // Heuristic: if outcome contains "yes" or "true", it's Long YES
    const lower = outcome.toLowerCase();
    if (lower.includes('yes') || lower.includes('true') || lower === '1') {
      return 'Long YES';
    }
    return 'Long NO';
  }

  /**
   * Get all closed positions, aggregated by (conditionId, outcome)
   */
  getClosedPositions(): ClosedPosition[] {
    const aggregated: Map<string, ClosedPosition> = new Map();

    for (const [key, positions] of this.closedPositions.entries()) {
      for (const pos of positions) {
        // Aggregate positions with same key that are both fully or partially closed
        const existing = aggregated.get(key);
        
        if (existing) {
          // Aggregate: combine stats
          const totalSize = existing.size + pos.size;
          const existingCostBasis = existing.entryVWAP * existing.size;
          const posCostBasis = pos.entryVWAP * pos.size;
          const totalCostBasis = existingCostBasis + posCostBasis;
          const existingProceeds = existing.exitVWAP * existing.size;
          const posProceeds = pos.exitVWAP * pos.size;
          const totalProceeds = existingProceeds + posProceeds;
          
          existing.entryVWAP = totalCostBasis / totalSize;
          existing.exitVWAP = totalProceeds / totalSize;
          existing.size = totalSize;
          existing.realizedPnL += pos.realizedPnL;
          existing.realizedPnLPercent = totalCostBasis > 0 
            ? (existing.realizedPnL / totalCostBasis) * 100 
            : 0;
          existing.tradesCount += pos.tradesCount;
          
          // Update closedAt if this position fully closes
          if (!existing.closedAt && pos.closedAt) {
            existing.closedAt = pos.closedAt;
          }
          
          // Update open remaining (use the most recent value)
          if (pos.open_qty_remaining !== undefined) {
            existing.open_qty_remaining = pos.open_qty_remaining;
          }
          if (pos.avg_entry_price_open !== undefined) {
            existing.avg_entry_price_open = pos.avg_entry_price_open;
          }
        } else {
          aggregated.set(key, { ...pos });
        }
      }
    }

    return Array.from(aggregated.values());
  }

  /**
   * Reset engine state
   */
  reset(): void {
    this.lots.clear();
    this.closedPositions.clear();
    this.currentPositions.clear();
  }
}
