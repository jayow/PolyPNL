'use client';

import { useEffect, useRef, useState } from 'react';

const MARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

/**
 * Subscribe to Polymarket's public market WebSocket and return a live price
 * map keyed by asset_id (token id). Public channel — no auth required.
 *
 * The hook keeps a single WebSocket open per render, reconnects with
 * exponential backoff on close, and falls back silently on any error so the
 * polled REST data continues to render unchanged.
 */
export function useLivePrices(assetIds: string[]): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Stable dep key so we don't reconnect on every render. Sort to make
  // ['a','b'] and ['b','a'] equivalent.
  const assetIdsKey = assetIds.slice().sort().join('|');

  useEffect(() => {
    if (assetIdsKey.length === 0 || typeof window === 'undefined') return;
    const ids = assetIdsKey.split('|').filter(Boolean);
    if (ids.length === 0) return;

    let alive = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const updatePrice = (assetId: string, price: number) => {
      if (!Number.isFinite(price) || price <= 0 || price >= 1) {
        // Polymarket prices are probabilities in (0, 1). Reject obvious noise.
        return;
      }
      setPrices((prev) => (prev[assetId] === price ? prev : { ...prev, [assetId]: price }));
    };

    const handleMessage = (raw: string) => {
      // The server sometimes batches multiple JSON objects per frame; accept
      // both single-object and array payloads.
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      for (const m of messages) {
        if (!m || typeof m !== 'object') continue;
        const msg = m as Record<string, any>;
        switch (msg.event_type) {
          case 'last_trade_price': {
            if (msg.asset_id && msg.price) {
              updatePrice(msg.asset_id, parseFloat(msg.price));
            }
            break;
          }
          case 'best_bid_ask': {
            if (msg.asset_id && msg.best_bid && msg.best_ask) {
              const mid = (parseFloat(msg.best_bid) + parseFloat(msg.best_ask)) / 2;
              updatePrice(msg.asset_id, mid);
            }
            break;
          }
          case 'book': {
            const bestBid = msg.bids?.[0]?.price ?? msg.bids?.[0]?.[0];
            const bestAsk = msg.asks?.[0]?.price ?? msg.asks?.[0]?.[0];
            if (msg.asset_id && bestBid && bestAsk) {
              const mid = (parseFloat(bestBid) + parseFloat(bestAsk)) / 2;
              updatePrice(msg.asset_id, mid);
            }
            break;
          }
          case 'price_change': {
            if (Array.isArray(msg.price_changes)) {
              for (const pc of msg.price_changes) {
                if (pc?.asset_id && pc.best_bid && pc.best_ask) {
                  const mid = (parseFloat(pc.best_bid) + parseFloat(pc.best_ask)) / 2;
                  updatePrice(pc.asset_id, mid);
                }
              }
            }
            break;
          }
        }
      }
    };

    const connect = () => {
      if (!alive) return;
      try {
        ws = new WebSocket(MARKET_WS_URL);

        ws.onopen = () => {
          attempt = 0;
          ws?.send(
            JSON.stringify({
              assets_ids: ids,
              type: 'market',
              custom_feature_enabled: true,
            })
          );
        };

        ws.onmessage = (event) => handleMessage(typeof event.data === 'string' ? event.data : '');

        ws.onclose = () => {
          if (!alive) return;
          const delay = Math.min(30000, 1000 * Math.pow(2, attempt++));
          reconnectTimer = setTimeout(connect, delay);
        };

        ws.onerror = () => {
          // Let onclose handle reconnection.
        };
      } catch {
        if (!alive) return;
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch { /* ignore */ }
        ws = null;
      }
    };
  }, [assetIdsKey]);

  return prices;
}
