'use client';

import { ClosedPosition } from '@/types';

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

interface TableProps {
  positions: ClosedPosition[];
  showNumberColumns: boolean;
  sortColumn: keyof ClosedPosition | null;
  sortDirection: 'asc' | 'desc';
  onSort: (column: keyof ClosedPosition) => void;
  selectedPosition: ClosedPosition | null;
  onSelectPosition: (position: ClosedPosition | null) => void;
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

function formatNumberWithCommas(num: number, decimals: number = 1): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Table({
  positions,
  showNumberColumns,
  sortColumn,
  sortDirection,
  onSort,
  selectedPosition,
  onSelectPosition,
}: TableProps) {
  const SortIndicator = ({ column }: { column: keyof ClosedPosition }) => {
    if (sortColumn !== column) return null;
    return <span className="text-hyper-accent ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-hyper-panel border border-hyper-border rounded overflow-hidden">
      <div className="overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-hyper-panelHover sticky top-0 z-10">
            <tr>
              <th
                className="px-3 py-2 text-left text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                onClick={() => onSort('marketTitle')}
              >
                Market <SortIndicator column="marketTitle" />
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                onClick={() => onSort('outcomeName')}
              >
                Outcome <SortIndicator column="outcomeName" />
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                onClick={() => onSort('side')}
              >
                Side <SortIndicator column="side" />
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                onClick={() => onSort('openedAt')}
              >
                Opened <SortIndicator column="openedAt" />
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                onClick={() => onSort('closedAt')}
              >
                Closed <SortIndicator column="closedAt" />
              </th>
              {showNumberColumns && (
                <>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                    onClick={() => onSort('entryVWAP')}
                  >
                    Entry <SortIndicator column="entryVWAP" />
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                    onClick={() => onSort('exitVWAP')}
                  >
                    Exit <SortIndicator column="exitVWAP" />
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                    onClick={() => onSort('size')}
                  >
                    Size <SortIndicator column="size" />
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                    onClick={() => onSort('realizedPnL')}
                  >
                    PnL <SortIndicator column="realizedPnL" />
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                    onClick={() => onSort('realizedPnLPercent')}
                  >
                    PnL% <SortIndicator column="realizedPnLPercent" />
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase tracking-wider cursor-pointer hover:bg-hyper-border transition-colors select-none"
                    onClick={() => onSort('tradesCount')}
                  >
                    # <SortIndicator column="tradesCount" />
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hyper-border">
            {positions.map((pos, idx) => (
              <tr
                key={idx}
                className={`hover:bg-hyper-panelHover transition-colors cursor-pointer ${
                  selectedPosition === pos ? 'bg-hyper-panelHover' : ''
                }`}
                onClick={() => onSelectPosition(pos)}
              >
                <td 
                  className="px-3 py-2 text-hyper-textPrimary max-w-[200px] truncate" 
                  title={pos.marketTitle || '-'}
                >
                  <div className="flex items-center gap-2">
                    {pos.icon && (
                      <img 
                        src={pos.icon} 
                        alt="" 
                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    {(pos.slug || pos.conditionId || pos.marketTitle) ? (
                      <span 
                        className="truncate hover:text-hyper-accent transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = getPolymarketUrl(pos, 'market');
                          if (url !== '#') window.open(url, '_blank');
                        }}
                      >
                        {pos.marketTitle || '-'}
                      </span>
                    ) : (
                      <span className="truncate">-</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-hyper-textPrimary max-w-[80px] truncate" title={pos.outcomeName || pos.outcome}>
                  {pos.outcomeName || pos.outcome}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    pos.side === 'Long YES' ? 'bg-hyper-accent/20 text-hyper-accent' : 'bg-hyper-negative/20 text-hyper-negative'
                  }`}>
                    {pos.side === 'Long YES' ? 'YES' : 'NO'}
                  </span>
                </td>
                <td className="px-3 py-2 text-hyper-textSecondary">
                  {new Date(pos.openedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="px-3 py-2 text-hyper-textSecondary">
                  {pos.closedAt ? new Date(pos.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                </td>
                {showNumberColumns && (
                  <>
                    <td className="px-3 py-2 text-right font-mono-numeric text-hyper-textPrimary">
                      {pos.entryVWAP.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-numeric text-hyper-textPrimary">
                      {pos.exitVWAP.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-numeric text-hyper-textPrimary">
                      {formatNumberWithCommas(pos.size, 1)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono-numeric font-medium ${
                      pos.realizedPnL >= 0 ? 'text-hyper-positive' : 'text-hyper-negative'
                    }`}>
                      ${formatNumber(pos.realizedPnL)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono-numeric font-medium ${
                      pos.realizedPnLPercent >= 0 ? 'text-hyper-positive' : 'text-hyper-negative'
                    }`}>
                      {pos.realizedPnLPercent >= 0 ? '+' : ''}{pos.realizedPnLPercent.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono-numeric text-hyper-textPrimary">
                      {pos.tradesCount.toLocaleString('en-US')}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
