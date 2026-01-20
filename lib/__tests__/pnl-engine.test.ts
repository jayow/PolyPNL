import { FIFOPnLEngine } from '../pnl-engine';
import { NormalizedTrade } from '@/types';

describe('FIFOPnLEngine', () => {
  let engine: FIFOPnLEngine;

  beforeEach(() => {
    engine = new FIFOPnLEngine();
  });

  describe('Simple buy then sell', () => {
    it('should compute realized PnL for a simple buy-sell cycle', () => {
      const trades: NormalizedTrade[] = [
        {
          trade_id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'BUY',
          price: 0.5,
          size: 100,
          notional: 50,
          fees: 1,
        },
        {
          trade_id: '2',
          timestamp: '2024-01-02T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'SELL',
          price: 0.6,
          size: 100,
          notional: 60,
          fees: 1,
        },
      ];

      for (const trade of trades) {
        engine.processTrade(trade);
      }

      const positions = engine.getClosedPositions();
      expect(positions.length).toBeGreaterThan(0);
      
      const position = positions[0];
      expect(position.size).toBe(100);
      expect(position.realizedPnL).toBeCloseTo(8, 2); // (60-1) - (50+1) = 59 - 51 = 8
      expect(position.closedAt).toBeTruthy();
    });
  });

  describe('Partial closes', () => {
    it('should handle partial position closes', () => {
      const trades: NormalizedTrade[] = [
        {
          trade_id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'BUY',
          price: 0.5,
          size: 100,
          notional: 50,
          fees: 1,
        },
        {
          trade_id: '2',
          timestamp: '2024-01-02T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'SELL',
          price: 0.6,
          size: 50,
          notional: 30,
          fees: 0.5,
        },
      ];

      for (const trade of trades) {
        engine.processTrade(trade);
      }

      const positions = engine.getClosedPositions();
      expect(positions.length).toBeGreaterThan(0);
      
      const position = positions[0];
      expect(position.size).toBe(50);
      expect(position.open_qty_remaining).toBe(50);
      expect(position.closedAt).toBeNull(); // Position not fully closed
    });
  });

  describe('Multiple lots', () => {
    it('should handle multiple buy lots with FIFO matching', () => {
      const trades: NormalizedTrade[] = [
        {
          trade_id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'BUY',
          price: 0.4,
          size: 50,
          notional: 20,
          fees: 0.5,
        },
        {
          trade_id: '2',
          timestamp: '2024-01-02T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'BUY',
          price: 0.6,
          size: 50,
          notional: 30,
          fees: 0.5,
        },
        {
          trade_id: '3',
          timestamp: '2024-01-03T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'SELL',
          price: 0.7,
          size: 75,
          notional: 52.5,
          fees: 0.75,
        },
      ];

      for (const trade of trades) {
        engine.processTrade(trade);
      }

      const positions = engine.getClosedPositions();
      expect(positions.length).toBeGreaterThan(0);
      
      const position = positions[0];
      expect(position.size).toBe(75);
      // Should match FIFO: first 50 @ 0.4, next 25 @ 0.6
      // Cost basis: (20+0.5) + (30+0.5)*0.5 = 20.5 + 15.25 = 35.75
      // Proceeds: 52.5 - 0.75 = 51.75
      // PnL: 51.75 - 35.75 = 16
      expect(position.realizedPnL).toBeCloseTo(16, 2);
      expect(position.open_qty_remaining).toBe(25);
    });
  });

  describe('Invalid sell > buys', () => {
    it('should handle sells exceeding buys gracefully', () => {
      const trades: NormalizedTrade[] = [
        {
          trade_id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'BUY',
          price: 0.5,
          size: 50,
          notional: 25,
          fees: 0.5,
        },
        {
          trade_id: '2',
          timestamp: '2024-01-02T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'SELL',
          price: 0.6,
          size: 100, // Exceeds buys
          notional: 60,
          fees: 1,
        },
      ];

      // Should not throw
      for (const trade of trades) {
        engine.processTrade(trade);
      }

      const positions = engine.getClosedPositions();
      // Should still process what it can
      expect(positions.length).toBeGreaterThan(0);
      
      const position = positions[0];
      expect(position.size).toBe(100); // Tracks full sell
      // Excess 50 shares have zero cost basis
      // Cost basis for 50 shares: 25 + 0.5 = 25.5
      // Proceeds: 60 - 1 = 59
      // PnL: 59 - 25.5 = 33.5
      expect(position.realizedPnL).toBeCloseTo(33.5, 2);
    });
  });

  describe('Multiple partial closes', () => {
    it('should aggregate multiple partial closes correctly', () => {
      const trades: NormalizedTrade[] = [
        {
          trade_id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'BUY',
          price: 0.5,
          size: 200,
          notional: 100,
          fees: 2,
        },
        {
          trade_id: '2',
          timestamp: '2024-01-02T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'SELL',
          price: 0.6,
          size: 50,
          notional: 30,
          fees: 0.5,
        },
        {
          trade_id: '3',
          timestamp: '2024-01-03T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'SELL',
          price: 0.7,
          size: 50,
          notional: 35,
          fees: 0.5,
        },
        {
          trade_id: '4',
          timestamp: '2024-01-04T00:00:00Z',
          user: '0x123',
          conditionId: 'condition1',
          outcome: '0',
          side: 'SELL',
          price: 0.65,
          size: 100,
          notional: 65,
          fees: 1,
        },
      ];

      for (const trade of trades) {
        engine.processTrade(trade);
      }

      const positions = engine.getClosedPositions();
      expect(positions.length).toBeGreaterThan(0);
      
      const position = positions[0];
      expect(position.size).toBe(200); // All closed
      expect(position.closedAt).toBeTruthy();
      expect(position.tradesCount).toBeGreaterThan(1);
    });
  });
});
