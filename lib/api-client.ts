import { PolymarketPublicProfile, PolymarketTrade, NormalizedTrade, MarketMetadata, PolymarketClosedPosition, ClosedPosition } from '@/types';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const DATA_API_BASE = 'https://data-api.polymarket.com';
const DATA_API_V1_BASE = 'https://data-api.polymarket.com/v1';

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

// Simple in-memory cache for proxy wallet resolution and market metadata
const proxyWalletCache: Map<string, string | null> = new Map();
const marketMetadataCache: Map<string, MarketMetadata> = new Map();

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Resolve proxy wallet for a given wallet address
 */
export async function resolveProxyWallet(wallet: string): Promise<{
  inputWallet: string;
  userAddressUsed: string;
  proxyWalletFound: boolean;
  proxyWallet?: string;
}> {
  const normalizedWallet = wallet.toLowerCase().trim();

  // Check cache
  if (proxyWalletCache.has(normalizedWallet)) {
    const proxyWallet = proxyWalletCache.get(normalizedWallet);
    return {
      inputWallet: wallet,
      userAddressUsed: proxyWallet || normalizedWallet,
      proxyWalletFound: !!proxyWallet,
      proxyWallet: proxyWallet || undefined,
    };
  }

  // First, check if the input address already has closed positions
  // If it does, it's already a proxy wallet, use it directly
  try {
    const checkResponse = await fetchWithTimeout(
      `${DATA_API_V1_BASE}/closed-positions?user=${encodeURIComponent(normalizedWallet)}&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
      },
      10000
    );

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      const positions = Array.isArray(checkData) ? checkData : [];
      
      if (positions.length > 0) {
        // Input address has closed positions, it's already a proxy wallet
        console.log(`[API] Input address already has closed positions, treating as proxy wallet: ${normalizedWallet}`);
        proxyWalletCache.set(normalizedWallet, null); // Cache that it's already a proxy
        return {
          inputWallet: wallet,
          userAddressUsed: normalizedWallet,
          proxyWalletFound: false, // Not "found" because it was already the proxy
        };
      }
    }
  } catch (checkError) {
    // Continue with normal resolution if check fails
    console.log(`[API] Check for existing proxy wallet failed, continuing with resolution...`);
  }

  try {
    console.log(`[API] Resolving proxy wallet for: ${normalizedWallet}`);
    const response = await fetchWithTimeout(
      `${GAMMA_API_BASE}/public-profile?wallet=${encodeURIComponent(normalizedWallet)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      },
      10000 // 10 second timeout for proxy wallet resolution
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      // 422 (Invalid address) or 404 (Not found) are expected for some wallets
      // Try alternative method: fetch a trade to get proxyWallet from the trade data
      if (response.status === 422 || response.status === 404) {
        console.log(`[API] Proxy wallet API returned ${response.status}, trying alternative method via trades API...`);
        
        try {
          // Try to get proxy wallet from closed-positions API - it includes proxyWallet in response
          const positionsResponse = await fetchWithTimeout(
            `${DATA_API_V1_BASE}/closed-positions?user=${encodeURIComponent(normalizedWallet)}&limit=1`,
            {
              headers: {
                'Accept': 'application/json',
              },
            },
            10000
          );

          if (positionsResponse.ok) {
            const positionsData = await positionsResponse.json();
            const positions = Array.isArray(positionsData) ? positionsData : [];
            
            if (positions.length > 0 && positions[0].proxyWallet) {
              const proxyWallet = positions[0].proxyWallet.toLowerCase();
              // Only use it if it's different from input (meaning it's actually a proxy)
              if (proxyWallet !== normalizedWallet) {
                console.log(`[API] Found proxy wallet via closed-positions API: ${proxyWallet}`);
                proxyWalletCache.set(normalizedWallet, proxyWallet);
                return {
                  inputWallet: wallet,
                  userAddressUsed: proxyWallet,
                  proxyWalletFound: true,
                  proxyWallet: proxyWallet,
                };
              }
            }
            
            // If positions exist but proxyWallet matches input, input might already be the proxy
            if (positions.length > 0) {
              console.log(`[API] Input wallet has closed positions, using as-is (may already be proxy wallet)`);
              proxyWalletCache.set(normalizedWallet, null);
              return {
                inputWallet: wallet,
                userAddressUsed: normalizedWallet,
                proxyWalletFound: false,
              };
            }
          }
          
          // If closed-positions with EOA returns empty, try finding proxy wallets from trades
          // and check which one has closed positions (this is the actual user's proxy wallet)
          console.log(`[API] Closed-positions API returned empty for EOA, trying to find proxy via trades...`);
          
          // Also try trades API as fallback - collect all proxy wallets and prioritize most recent
          const tradesResponse = await fetchWithTimeout(
            `${DATA_API_BASE}/trades?maker=${encodeURIComponent(normalizedWallet)}&limit=100`,
            {
              headers: {
                'Accept': 'application/json',
              },
            },
            10000
          );

          if (tradesResponse.ok) {
            const tradesData = await tradesResponse.json();
            const trades = Array.isArray(tradesData) ? tradesData : (tradesData.trades || tradesData.data || []);
            
            if (trades.length > 0) {
              // Sort trades by timestamp (most recent first)
              const sortedTrades = [...trades].sort((a, b) => {
                const timeA = a.timestamp || a.createdAt || 0;
                const timeB = b.timestamp || b.createdAt || 0;
                return timeB - timeA; // Descending order
              });
              
              // Collect all proxy wallets from trades with their counts and most recent timestamp
              const proxyWalletInfo = new Map<string, { count: number; mostRecentTime: number }>();
              for (const trade of sortedTrades) {
                if (trade.proxyWallet) {
                  const pw = trade.proxyWallet.toLowerCase();
                  if (pw !== normalizedWallet) {
                    const tradeTime = trade.timestamp || trade.createdAt || 0;
                    if (!proxyWalletInfo.has(pw)) {
                      proxyWalletInfo.set(pw, { count: 0, mostRecentTime: tradeTime });
                    }
                    const info = proxyWalletInfo.get(pw)!;
                    info.count += 1;
                    if (tradeTime > info.mostRecentTime) {
                      info.mostRecentTime = tradeTime;
                    }
                  }
                }
              }
              
              if (proxyWalletInfo.size > 0) {
                // Check which proxy wallet has the most closed positions
                // This is the most reliable indicator of the active proxy wallet
                let bestProxy = '';
                let maxClosedPositions = -1;
                
                const proxyList = Array.from(proxyWalletInfo.keys());
                for (const pw of proxyList) {
                  try {
                    const verifyResponse = await fetchWithTimeout(
                      `${DATA_API_V1_BASE}/closed-positions?user=${encodeURIComponent(pw)}&limit=1000`,
                      {
                        headers: {
                          'Accept': 'application/json',
                        },
                      },
                      10000
                    );
                    
                    if (verifyResponse.ok) {
                      const verifyData = await verifyResponse.json();
                      const positionsCount = Array.isArray(verifyData) ? verifyData.length : 0;
                      if (positionsCount > maxClosedPositions) {
                        maxClosedPositions = positionsCount;
                        bestProxy = pw;
                      }
                    }
                  } catch (verifyError) {
                    // Skip this proxy if verification fails
                    continue;
                  }
                }
                
                if (bestProxy && maxClosedPositions > 0) {
                  // Found a proxy wallet with closed positions, use it
                  const info = proxyWalletInfo.get(bestProxy)!;
                  console.log(`[API] Found proxy wallet via trades API and verified with closed-positions: ${bestProxy} (${maxClosedPositions} closed positions, ${info.count} trades)`);
                  proxyWalletCache.set(normalizedWallet, bestProxy);
                  return {
                    inputWallet: wallet,
                    userAddressUsed: bestProxy,
                    proxyWalletFound: true,
                    proxyWallet: bestProxy,
                  };
                }
                
                // Fallback: prioritize proxy wallet from most recent trades, then by count
                let bestProxyByRecency = '';
                let bestScore = -1;
                for (const [pw, info] of proxyWalletInfo.entries()) {
                  // Score: most recent time (prioritize recent activity) * 1000 + count
                  const score = info.mostRecentTime * 1000 + info.count;
                  if (score > bestScore) {
                    bestScore = score;
                    bestProxyByRecency = pw;
                  }
                }
                
                if (bestProxyByRecency) {
                  const info = proxyWalletInfo.get(bestProxyByRecency)!;
                  console.log(`[API] Found proxy wallet via trades API (fallback to recency): ${bestProxyByRecency} (${info.count} trades, most recent: ${new Date(info.mostRecentTime * 1000).toISOString()})`);
                  proxyWalletCache.set(normalizedWallet, bestProxyByRecency);
                  return {
                    inputWallet: wallet,
                    userAddressUsed: bestProxyByRecency,
                    proxyWalletFound: true,
                    proxyWallet: bestProxyByRecency,
                  };
                }
              }
            }
          }
        } catch (apiError) {
          console.log(`[API] Alternative proxy wallet resolution failed:`, apiError);
        }

        // If alternative method also failed, fall back to using input wallet directly
        console.log(`[API] Could not resolve proxy wallet, using input wallet directly`);
        proxyWalletCache.set(normalizedWallet, null);
        return {
          inputWallet: wallet,
          userAddressUsed: normalizedWallet,
          proxyWalletFound: false,
        };
      }
      
      console.error(`[API] Proxy wallet fetch failed: ${response.status} ${JSON.stringify(errorData)}`);
      // For other errors, still fall back to input wallet rather than throwing
      proxyWalletCache.set(normalizedWallet, null);
      return {
        inputWallet: wallet,
        userAddressUsed: normalizedWallet,
        proxyWalletFound: false,
      };
    }

    const data: PolymarketPublicProfile = await response.json();
    console.log(`[API] Proxy wallet response:`, { wallet: data.wallet, proxyWallet: data.proxyWallet });
    const proxyWallet = data.proxyWallet?.toLowerCase() || null;
    
    // Cache result
    proxyWalletCache.set(normalizedWallet, proxyWallet);
    
    const userAddress = proxyWallet || normalizedWallet;

    return {
      inputWallet: wallet,
      userAddressUsed: userAddress,
      proxyWalletFound: !!proxyWallet,
      proxyWallet: proxyWallet || undefined,
    };
  } catch (error) {
    console.error('Error resolving proxy wallet:', error);
    // Fallback to input wallet on error
    proxyWalletCache.set(normalizedWallet, null);
    return {
      inputWallet: wallet,
      userAddressUsed: normalizedWallet,
      proxyWalletFound: false,
    };
  }
}

/**
 * Fetch user activity (simpler than trades API for getting first BUY timestamps)
 * Uses the activity API which can filter by type=TRADE and side=BUY
 * @see https://docs.polymarket.com/api-reference/core/get-user-activity
 */
export async function fetchUserActivity(
  userAddress: string,
  options: {
    type?: string[];
    side?: 'BUY' | 'SELL';
    sortBy?: 'TIMESTAMP' | 'TOKENS' | 'CASH';
    sortDirection?: 'ASC' | 'DESC';
    limit?: number;
  } = {}
): Promise<Array<{
  timestamp: number;
  conditionId: string;
  outcome: string;
  outcomeIndex?: number;
  side?: 'BUY' | 'SELL';
  type: string;
  [key: string]: any;
}>> {
  const allActivities: any[] = [];
  let offset = 0;
  const pageSize = Math.min(options.limit || 100, 500); // API max is 500
  const maxOffset = 10000; // API max offset

  console.log(`[API] Fetching user activity for: ${userAddress}`, options);

  while (offset < maxOffset && (!options.limit || allActivities.length < options.limit)) {
    try {
      const params = new URLSearchParams({
        user: userAddress.toLowerCase(),
        limit: pageSize.toString(),
        offset: offset.toString(),
        sortBy: options.sortBy || 'TIMESTAMP',
        sortDirection: options.sortDirection || 'ASC',
      });

      // Only add type filter if provided and not empty
      // If no type filter, API should return all activity types
      if (options.type && options.type.length > 0) {
        options.type.forEach(t => params.append('type', t));
      }
      // If no type specified, don't add type parameter - fetch all types

      if (options.side) {
        params.append('side', options.side);
      }

      console.log(`[API] Fetching activity offset ${offset} for user: ${userAddress}`);
      
      const response = await fetchWithTimeout(
        `${DATA_API_BASE}/activity?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        },
        15000 // 15 second timeout per page
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[API] Activity fetch failed (offset ${offset}): ${response.status} ${errorText}`);
        
        // If we have some activities, return them; otherwise throw
        if (allActivities.length === 0) {
          throw new Error(`Failed to fetch user activity: ${response.status} ${errorText}`);
        }
        break;
      }

      const data: any[] = await response.json();
      console.log(`[API] Found ${data.length} activities at offset ${offset}`);

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      // Add activities to result
      for (const activity of data) {
        allActivities.push(activity);
      }

      // If we got fewer than pageSize, we've reached the end
      if (data.length < pageSize) {
        break;
      }

      offset += pageSize;

      // Check if we've reached the limit
      if (options.limit && allActivities.length >= options.limit) {
        break;
      }
    } catch (error) {
      console.error(`[API] Error fetching activity at offset ${offset}:`, error);
      if (allActivities.length === 0) {
        throw error;
      }
      break;
    }
  }

  console.log(`[API] Total activities fetched: ${allActivities.length}`);
  return allActivities;
}

/**
 * Fetch all trades for a user with pagination
 */
export async function fetchAllTrades(
  userAddress: string,
  startDate?: string,
  endDate?: string
): Promise<PolymarketTrade[]> {
  const allTrades: PolymarketTrade[] = [];
  let page = 1;
  const pageSize = 100;
  const maxPages = 100; // Safety limit to prevent infinite loops (10,000 trades max)
  const seenIds = new Set<string>();
  let useMakerParam = false; // Track which parameter format works
  let consecutiveEmptyPages = 0; // Track consecutive pages with no new trades

  while (page <= maxPages) {
    try {
      let params: URLSearchParams;
      
      if (useMakerParam) {
        // Use maker parameter with offset-based pagination
        const offset = (page - 1) * pageSize;
        params = new URLSearchParams({
          maker: userAddress.toLowerCase(),
          limit: pageSize.toString(),
          offset: offset.toString(),
        });
      } else {
        // Try 'user' parameter first with page-based pagination
        params = new URLSearchParams({
          user: userAddress.toLowerCase(),
          page: page.toString(),
          pageSize: pageSize.toString(),
        });

        if (startDate) {
          params.append('start', startDate);
        }
        if (endDate) {
          params.append('end', endDate);
        }
      }

      console.log(`[API] Fetching trades page ${page} for user: ${userAddress} (using ${useMakerParam ? 'maker' : 'user'} param)`);
      
      // Use shorter timeout per page to avoid getting stuck (15 seconds per page)
      const pageTimeout = 15000;
      
      let response = await fetchWithTimeout(
        `${DATA_API_BASE}/trades?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        },
        pageTimeout
      );

      // If 'user' parameter doesn't work on first page, try 'maker' parameter
      if (!response.ok && page === 1 && !useMakerParam) {
        console.log(`[API] 'user' parameter failed (${response.status}), trying 'maker' parameter...`);
        useMakerParam = true;
        const offset = 0;
        params = new URLSearchParams({
          maker: userAddress.toLowerCase(),
          limit: pageSize.toString(),
          offset: offset.toString(),
        });
        response = await fetchWithTimeout(
          `${DATA_API_BASE}/trades?${params.toString()}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          },
          pageTimeout
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[API] Trades fetch failed (page ${page}): ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch trades: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log(`[API] Trades page ${page} response type:`, Array.isArray(data) ? 'array' : typeof data, 'keys:', Object.keys(data || {}));
      
      // Handle different possible response formats
      let trades: PolymarketTrade[] = [];
      
      if (Array.isArray(data)) {
        trades = data;
      } else if (data.trades && Array.isArray(data.trades)) {
        trades = data.trades;
      } else if (data.data && Array.isArray(data.data)) {
        trades = data.data;
      } else if (data.results && Array.isArray(data.results)) {
        trades = data.results;
      } else {
        // Log unexpected response format for debugging
        console.warn(`[API] Unexpected trades response format on page ${page}:`, {
          type: typeof data,
          keys: Object.keys(data || {}),
          sample: JSON.stringify(data).substring(0, 200),
        });
      }

      console.log(`[API] Found ${trades.length} trades on page ${page}`);

      if (trades.length === 0) {
        console.log(`[API] No more trades found, stopping pagination`);
        break;
      }

      // Deduplicate and add trades
      let newTradesCount = 0;
      for (const trade of trades) {
        const tradeId = trade.id || trade.hash || `${trade.timestamp}-${trade.user}-${trade.size}`;
        if (!seenIds.has(tradeId)) {
          seenIds.add(tradeId);
          allTrades.push(trade);
          newTradesCount++;
        }
      }

      console.log(`[API] Added ${newTradesCount} new trades (${trades.length - newTradesCount} duplicates)`);

      // Safety check: If all trades were duplicates, we might be stuck in a loop
      if (newTradesCount === 0 && trades.length > 0) {
        console.log(`[API] All trades on page ${page} were duplicates, stopping pagination`);
        break;
      }

      // Check if there are more pages
      if (trades.length < pageSize) {
        console.log(`[API] Got less than pageSize (${trades.length} < ${pageSize}), stopping pagination`);
        break;
      }

      // Safety check: If we've reached max pages
      if (page >= maxPages) {
        console.log(`[API] Reached maximum page limit (${maxPages}), stopping pagination`);
        break;
      }

      page++;
    } catch (error) {
      console.error(`Error fetching trades page ${page}:`, error);
      // Don't break on error if we have some trades - return what we have
      if (allTrades.length === 0) {
        throw error; // If we have no trades at all, throw the error
      }
      console.log(`[API] Error on page ${page}, returning ${allTrades.length} trades collected so far`);
      break;
    }
  }

  console.log(`[API] Completed fetching trades: ${allTrades.length} total trades from ${page - 1} pages`);

  // Sort by timestamp ascending
  allTrades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return allTrades;
}

/**
 * Normalize a Polymarket trade to our standard format
 */
export function normalizeTrade(trade: PolymarketTrade, userAddress: string): NormalizedTrade {
  // Extract conditionId from various possible fields
  const conditionId = trade.conditionId || 
                     trade.condition_id || 
                     trade.market?.conditionId ||
                     trade.tokenId?.split(':')[0] ||
                     'unknown';

  // Extract outcome from various possible fields
  const outcome = trade.outcome || 
                 trade.tokenId?.split(':')[1] ||
                 trade.asset?.outcome ||
                 '0';

  // Extract price and size
  const price = typeof trade.price === 'number' ? trade.price : parseFloat(String(trade.price || '0'));
  const size = typeof trade.size === 'number' ? trade.size : parseFloat(String(trade.size || '0'));

  // Calculate notional
  const notional = price * size;

  // Extract fees
  const fees = typeof trade.fees === 'number' ? trade.fees : parseFloat(String(trade.fees || '0'));

  // Determine side
  const side: 'BUY' | 'SELL' = trade.side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY';

  // Get trade ID
  const trade_id = trade.id || trade.hash || `${trade.timestamp}-${userAddress}-${size}`;

  return {
    trade_id,
    timestamp: trade.timestamp,
    user: userAddress,
    conditionId,
    outcome,
    side,
    price,
    size,
    notional,
    fees,
    eventTitle: trade.eventTitle,
    marketTitle: trade.marketTitle,
    outcomeName: trade.outcomeName,
    eventSlug: trade.eventSlug,
    slug: trade.slug,
    icon: trade.icon,
  };
}

/**
 * Fetch market metadata for a conditionId/outcome
 * Uses caching to avoid repeated API calls
 */
export async function fetchMarketMetadata(
  conditionId: string,
  outcome?: string
): Promise<MarketMetadata> {
  const cacheKey = `${conditionId}:${outcome || ''}`;

  if (marketMetadataCache.has(cacheKey)) {
    return marketMetadataCache.get(cacheKey)!;
  }

  try {
    // Try to fetch market info from Gamma API
    // Note: The exact endpoint may vary, this is a placeholder structure
    const response = await fetchWithTimeout(
      `${GAMMA_API_BASE}/markets?conditionId=${encodeURIComponent(conditionId)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      },
      10000 // 10 second timeout for metadata
    );

    if (response.ok) {
      const data = await response.json();
      
      // Handle different response formats
      let market: any = null;
      if (Array.isArray(data) && data.length > 0) {
        market = data[0];
      } else if (data.market) {
        market = data.market;
      } else if (data.data) {
        market = data.data;
      }

      if (market) {
        const metadata: MarketMetadata = {
          eventTitle: market.event?.title || market.eventTitle,
          marketTitle: market.question || market.title || market.marketTitle,
          outcomeName: outcome ? market.outcomes?.[parseInt(outcome)]?.name : undefined,
        };

        marketMetadataCache.set(cacheKey, metadata);
        return metadata;
      }
    }
  } catch (error) {
    console.error(`Error fetching market metadata for ${conditionId}:`, error);
  }

  // Return empty metadata on error
  const emptyMetadata: MarketMetadata = {};
  marketMetadataCache.set(cacheKey, emptyMetadata);
  return emptyMetadata;
}

/**
 * Enrich trades with market metadata
 */
export async function enrichTradesWithMetadata(trades: NormalizedTrade[]): Promise<NormalizedTrade[]> {
  // Group trades by conditionId to batch metadata fetching
  const conditionIds = new Set(trades.map(t => t.conditionId));

  // Fetch metadata for all unique conditionIds
  const metadataPromises = Array.from(conditionIds).map(conditionId =>
    fetchMarketMetadata(conditionId)
  );

  const metadataArray = await Promise.all(metadataPromises);
  const metadataMap = new Map<string, MarketMetadata>();

  let index = 0;
  for (const conditionId of conditionIds) {
    metadataMap.set(conditionId, metadataArray[index]);
    index++;
  }

  // Enrich trades with metadata
  return trades.map(trade => {
    const metadata = metadataMap.get(trade.conditionId);
    if (metadata) {
      return {
        ...trade,
        eventTitle: trade.eventTitle || metadata.eventTitle,
        marketTitle: trade.marketTitle || metadata.marketTitle,
        outcomeName: trade.outcomeName || metadata.outcomeName,
      };
    }
    return trade;
  });
}

/**
 * Fetch closed positions for a user using the Polymarket Data API v1 endpoint
 * This is more efficient than fetching all trades and computing PnL manually
 * @see https://docs.polymarket.com/api-reference/core/get-closed-positions-for-a-user
 */
export async function fetchClosedPositions(
  userAddress: string,
  startDate?: string,
  endDate?: string,
  limit: number = 1000
): Promise<ClosedPosition[]> {
  const allPositions: ClosedPosition[] = [];
  let offset = 0;
  const pageSize = 50; // API max is 50 per page
  const maxOffset = 100000; // API max offset
  const seenIds = new Set<string>();

  console.log(`[API] Fetching closed positions for user: ${userAddress}`);

  while (offset < maxOffset && allPositions.length < limit) {
    try {
      const params = new URLSearchParams({
        user: userAddress.toLowerCase(),
        limit: pageSize.toString(),
        offset: offset.toString(),
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC',
      });

      // Note: The API doesn't support date filtering directly, but we can filter client-side

      console.log(`[API] Fetching closed positions offset ${offset} for user: ${userAddress}`);
      
      const response = await fetchWithTimeout(
        `${DATA_API_V1_BASE}/closed-positions?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        },
        15000 // 15 second timeout per page
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[API] Closed positions fetch failed (offset ${offset}): ${response.status} ${errorText}`);
        
        // If we have some positions, return them; otherwise throw
        if (allPositions.length === 0) {
          throw new Error(`Failed to fetch closed positions: ${response.status} ${errorText}`);
        }
        break;
      }

      const data: PolymarketClosedPosition[] = await response.json();
      console.log(`[API] Found ${data.length} closed positions at offset ${offset}`);

      if (data.length === 0) {
        console.log(`[API] No more closed positions found, stopping pagination`);
        break;
      }

      // Convert Polymarket API format to our ClosedPosition format
      for (const pos of data) {
        // Create a unique key for deduplication
        const positionKey = `${pos.conditionId}-${pos.asset}-${pos.timestamp}`;
        if (seenIds.has(positionKey)) {
          continue;
        }
        seenIds.add(positionKey);

        // Convert timestamp from Unix seconds to ISO string
        const closedAt = new Date(pos.timestamp * 1000).toISOString();
        
        // Extract outcome from asset or use outcome field
        const outcome = pos.outcome || pos.asset.split(':')[1] || '0';
        
        // Determine side based on outcomeIndex (0 = Yes, 1 = No)
        // If outcomeIndex is 0, it's Long YES; if 1, it's Long NO
        const side: 'Long YES' | 'Long NO' = pos.outcomeIndex === 0 
          ? 'Long YES' 
          : 'Long NO';

        // Calculate realized PnL percentage
        const costBasis = pos.avgPrice * pos.totalBought;
        const realizedPnLPercent = costBasis > 0 
          ? (pos.realizedPnl / costBasis) * 100 
          : 0;

        const closedPosition: ClosedPosition = {
          conditionId: pos.conditionId,
          outcome: outcome,
          eventTitle: pos.eventSlug || (pos.title ? pos.title.split(' - ')[0] : undefined),
          marketTitle: pos.title || pos.slug || '',
          outcomeName: pos.outcome || outcome,
          side: side,
          openedAt: closedAt, // API doesn't provide open time, use close time as approximation
          closedAt: closedAt,
          entryVWAP: pos.avgPrice,
          exitVWAP: pos.curPrice,
          size: pos.totalBought,
          realizedPnL: pos.realizedPnl,
          realizedPnLPercent: realizedPnLPercent,
          tradesCount: 1, // API doesn't provide trade count, default to 1
          eventSlug: pos.eventSlug,
          slug: pos.slug,
          icon: pos.icon,
        };

        // Filter by date range if provided (client-side filtering)
        if (startDate || endDate) {
          const closeDate = new Date(pos.timestamp * 1000);
          if (startDate && closeDate < new Date(startDate)) {
            continue;
          }
          if (endDate && closeDate > new Date(endDate)) {
            continue;
          }
        }

        allPositions.push(closedPosition);
      }

      // Check if there are more pages
      if (data.length < pageSize) {
        console.log(`[API] Got less than pageSize (${data.length} < ${pageSize}), stopping pagination`);
        break;
      }

      offset += pageSize;
      
      // Safety check to prevent infinite loops
      if (allPositions.length >= limit) {
        console.log(`[API] Reached limit (${limit} positions), stopping pagination`);
        break;
      }
    } catch (error) {
      console.error(`Error fetching closed positions at offset ${offset}:`, error);
      // Return what we have so far if we have any positions
      if (allPositions.length === 0) {
        throw error;
      }
      break;
    }
  }

  console.log(`[API] Completed fetching closed positions: ${allPositions.length} total positions`);

  // Sort by timestamp descending (most recent first)
  allPositions.sort((a, b) => {
    const dateA = new Date(a.closedAt || a.openedAt).getTime();
    const dateB = new Date(b.closedAt || b.openedAt).getTime();
    return dateB - dateA;
  });

  return allPositions;
}
