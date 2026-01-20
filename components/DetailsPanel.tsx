'use client';

import { useState, useEffect } from 'react';
import { ClosedPosition, ProxyWalletResponse } from '@/types';

// Helper to build Polymarket URL
function getPolymarketUrl(position: ClosedPosition, type: 'event' | 'market'): string {
  if (type === 'event' && position.eventSlug) {
    return `https://polymarket.com/event/${position.eventSlug}`;
  }
  if (type === 'market' && position.slug) {
    return `https://polymarket.com/market/${position.slug}`;
  }
  // Fallback: use conditionId for market
  if (type === 'market' && position.conditionId) {
    return `https://polymarket.com/market/${position.conditionId}`;
  }
  return '#';
}

interface DetailsPanelProps {
  selectedPosition: ClosedPosition | null;
  resolveResult: ProxyWalletResponse | null;
}

interface Activity {
  timestamp: number;
  type: 'TRADE' | 'REDEEM' | 'SPLIT' | 'MERGE' | 'REWARD' | 'CONVERSION' | 'MAKER_REBATE';
  side?: 'BUY' | 'SELL';
  price?: number;
  size?: number;
  usdcSize?: number;
  transactionHash?: string;
  [key: string]: any;
}

function formatNumber(num: number, decimals: number = 2): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}m`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}k`;
  } else {
    return `${sign}${absNum.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
}

export default function DetailsPanel({ selectedPosition, resolveResult }: DetailsPanelProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  // Fetch activities when position is selected
  useEffect(() => {
    if (!selectedPosition || !resolveResult?.userAddressUsed) {
      setActivities([]);
      return;
    }

    const fetchActivities = async () => {
      setLoadingActivities(true);
      setActivitiesError(null);

      try {
        const params = new URLSearchParams({
          user: resolveResult.userAddressUsed,
          conditionId: selectedPosition.conditionId,
          outcome: selectedPosition.outcome,
        });

        // Include time range to help filter activities
        if (selectedPosition.openedAt) {
          params.append('openedAt', selectedPosition.openedAt);
        }
        if (selectedPosition.closedAt) {
          params.append('closedAt', selectedPosition.closedAt);
        }

        const response = await fetch(`/api/activities?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.statusText}`);
        }

        const data = await response.json();
        setActivities(data.activities || []);
      } catch (error) {
        console.error('Error fetching activities:', error);
        setActivitiesError(error instanceof Error ? error.message : 'Failed to fetch activities');
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [selectedPosition, resolveResult]);

  if (!selectedPosition) {
    return (
      <div className="bg-hyper-panel border border-hyper-border rounded p-4 flex items-center justify-center min-h-[200px]">
        <div className="text-center text-hyper-textSecondary text-xs">
          <div className="mb-2">Select a row to view details</div>
          {resolveResult && (
            <div className="mt-4 pt-4 border-t border-hyper-border text-[10px]">
              <div className="mb-1">
                <span className="text-hyper-muted">Wallet:</span> {resolveResult.inputWallet}
              </div>
              {resolveResult.proxyWalletFound && (
                <div>
                  <span className="text-hyper-muted">Proxy:</span> {resolveResult.proxyWallet}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hyper-panel border border-hyper-border rounded p-4 flex flex-col h-full min-h-0">
      <div className="space-y-3 flex-shrink-0">
        <div>
          <div className="text-xs text-hyper-textSecondary mb-1.5">Market</div>
          <div className="flex items-start gap-2">
            {selectedPosition.icon && (
              <img 
                src={selectedPosition.icon} 
                alt="" 
                className="w-14 h-14 rounded object-cover flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              {(selectedPosition.slug || selectedPosition.conditionId || selectedPosition.marketTitle) ? (
                <a
                  href={getPolymarketUrl(selectedPosition, 'market')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-hyper-textPrimary hover:text-hyper-accent transition-colors cursor-pointer underline break-words"
                >
                  {selectedPosition.marketTitle || '-'}
                </a>
              ) : (
                <div className="text-sm text-hyper-textPrimary break-words">{selectedPosition.marketTitle || '-'}</div>
              )}
              {/* Outcome and Side below market name */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="text-xs text-hyper-textPrimary">
                  {selectedPosition.outcomeName || selectedPosition.outcome}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedPosition.side === 'Long YES' ? 'bg-hyper-accent/20 text-hyper-accent' : 'bg-hyper-negative/20 text-hyper-negative'
                }`}>
                  {selectedPosition.side}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-hyper-textSecondary mb-1.5">Opened</div>
            <div className="text-sm font-mono-numeric text-hyper-textPrimary">
              {new Date(selectedPosition.openedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div>
            <div className="text-xs text-hyper-textSecondary mb-1.5">Closed</div>
            <div className="text-sm font-mono-numeric text-hyper-textPrimary">
              {selectedPosition.closedAt ? new Date(selectedPosition.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
            </div>
          </div>
        </div>
        
        <div className="border-t border-hyper-border pt-2 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-hyper-textSecondary">Entry VWAP</span>
            <span className="text-sm font-mono-numeric text-hyper-textPrimary">{selectedPosition.entryVWAP.toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-hyper-textSecondary">Exit VWAP</span>
            <span className="text-sm font-mono-numeric text-hyper-textPrimary">{selectedPosition.exitVWAP.toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-hyper-textSecondary">Size</span>
            <span className="text-sm font-mono-numeric text-hyper-textPrimary">{selectedPosition.size.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-hyper-textSecondary">Realized PnL</span>
            <span className={`text-sm font-mono-numeric font-medium ${
              selectedPosition.realizedPnL >= 0 ? 'text-hyper-positive' : 'text-hyper-negative'
            }`}>
              ${formatNumber(selectedPosition.realizedPnL)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-hyper-textSecondary">PnL %</span>
            <span className={`text-sm font-mono-numeric font-medium ${
              selectedPosition.realizedPnLPercent >= 0 ? 'text-hyper-positive' : 'text-hyper-negative'
            }`}>
              {selectedPosition.realizedPnLPercent >= 0 ? '+' : ''}{selectedPosition.realizedPnLPercent.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-hyper-textSecondary">Trades</span>
            <span className="text-sm font-mono-numeric text-hyper-textPrimary">{selectedPosition.tradesCount.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Activities List */}
        <div className="border-t border-hyper-border pt-3 mt-3 flex-1 min-h-0 flex flex-col">
          <div className="text-xs text-hyper-textSecondary mb-2 font-medium flex-shrink-0">
            All Activities ({activities.length})
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loadingActivities && (
              <div className="text-center py-4 text-xs text-hyper-textSecondary">
                Loading activities...
              </div>
            )}

            {activitiesError && (
              <div className="text-center py-4 text-xs text-hyper-negative">
                {activitiesError}
              </div>
            )}

            {!loadingActivities && !activitiesError && activities.length === 0 && (
              <div className="text-center py-4 text-xs text-hyper-textSecondary">
                No activities found
              </div>
            )}

            {!loadingActivities && activities.length > 0 && (
              <div className="space-y-1.5">
              {activities.map((activity, idx) => {
                const timestamp = typeof activity.timestamp === 'number' 
                  ? new Date(activity.timestamp * 1000)
                  : new Date(activity.timestamp);
                
                const activityType = activity.type || 'TRADE';
                const isTrade = activityType === 'TRADE';
                const isBuy = activity.side === 'BUY';
                
                // Get badge color based on activity type
                const getTypeColor = (type: string) => {
                  switch (type) {
                    case 'TRADE':
                      return isBuy ? 'bg-hyper-accent/20 text-hyper-accent' : 'bg-hyper-negative/20 text-hyper-negative';
                    case 'REDEEM':
                      return 'bg-hyper-positive/20 text-hyper-positive';
                    case 'SPLIT':
                      return 'bg-hyper-warning/20 text-hyper-warning';
                    case 'MERGE':
                      return 'bg-hyper-warning/20 text-hyper-warning';
                    case 'REWARD':
                      return 'bg-hyper-positive/20 text-hyper-positive';
                    case 'CONVERSION':
                      return 'bg-hyper-accent/20 text-hyper-accent';
                    case 'MAKER_REBATE':
                      return 'bg-hyper-positive/20 text-hyper-positive';
                    default:
                      return 'bg-hyper-muted/20 text-hyper-muted';
                  }
                };

                // Calculate value based on activity type
                let displayValue = null;
                if (isTrade && activity.price && activity.size) {
                  displayValue = activity.price * activity.size;
                } else if (activity.usdcSize) {
                  displayValue = activity.usdcSize;
                } else if (activity.size) {
                  displayValue = activity.size;
                }

                return (
                  <div
                    key={idx}
                    className="bg-hyper-panelHover border border-hyper-border rounded p-2 text-xs"
                  >
                    {/* Header: Badge and Date/Time */}
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-medium flex-shrink-0 ${getTypeColor(activityType)}`}
                      >
                        {isTrade ? (isBuy ? 'BUY' : 'SELL') : activityType}
                      </span>
                      <div className="flex items-center gap-2 text-hyper-textSecondary flex-shrink-0">
                        <span className="text-[10px]">
                          {timestamp.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-hyper-muted text-[10px]">
                          {timestamp.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    
                    {/* Trade Details */}
                    {isTrade ? (
                      <div className="grid grid-cols-3 gap-2 text-hyper-textPrimary">
                        {activity.price !== undefined && (
                          <div className="min-w-0">
                            <div className="text-[9px] text-hyper-textSecondary mb-1">Price</div>
                            <div className="font-mono-numeric text-[10px] truncate" title={activity.price.toFixed(4)}>
                              {activity.price.toFixed(4)}
                            </div>
                          </div>
                        )}
                        {activity.size !== undefined && (
                          <div className="min-w-0">
                            <div className="text-[9px] text-hyper-textSecondary mb-1">Size</div>
                            <div className="font-mono-numeric text-[10px] truncate" title={activity.size.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}>
                              {activity.size.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        )}
                        {displayValue !== null && (
                          <div className="min-w-0">
                            <div className="text-[9px] text-hyper-textSecondary mb-1">Value</div>
                            <div className="font-mono-numeric text-[10px] truncate" title={`$${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                              ${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-hyper-textPrimary">
                        {displayValue !== null && (
                          <div className="font-mono-numeric text-[10px]">
                            ${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                        {activity.size !== undefined && activity.usdcSize === undefined && (
                          <div className="font-mono-numeric text-[10px]">
                            {activity.size.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Transaction Hash */}
                    {activity.transactionHash && (
                      <div className="mt-1.5 pt-1.5 border-t border-hyper-border">
                        <a
                          href={`https://polygonscan.com/tx/${activity.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] text-hyper-accent hover:underline break-all block"
                          title={activity.transactionHash}
                        >
                          {activity.transactionHash.slice(0, 12)}...{activity.transactionHash.slice(-10)}
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
