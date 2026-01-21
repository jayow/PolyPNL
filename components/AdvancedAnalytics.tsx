'use client';

import { useMemo, useState } from 'react';
import { ClosedPosition } from '@/types';

interface AdvancedAnalyticsProps {
  positions: ClosedPosition[];
}

interface TagStats {
  tag: string;
  totalPnL: number;
  positionCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgPnL: number;
  biggestWin: number;
  biggestLoss: number;
  yesPnL: number;
  yesWinRate: number;
  yesAvgPnL: number;
  yesCount: number;
  noPnL: number;
  noWinRate: number;
  noAvgPnL: number;
  noCount: number;
}

function formatNumber(num: number, decimals: number = 2): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}M`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}K`;
  } else {
    return `${sign}${absNum.toFixed(decimals)}`;
  }
}

export default function AdvancedAnalytics({ positions }: AdvancedAnalyticsProps) {
  const [sortColumn, setSortColumn] = useState<keyof TagStats | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const analytics = useMemo(() => {
    if (positions.length === 0) {
      return {
        tagStats: [] as TagStats[],
      };
    }

    // Group positions by tags
    const tagMap = new Map<string, {
      positions: ClosedPosition[];
      totalPnL: number;
      wins: number[];
      losses: number[];
    }>();

    for (const pos of positions) {
      // Get tags from position, or use category as fallback
      let tags = pos.tags || [];
      if (tags.length === 0 && pos.category) {
        // Use category as a tag if no tags exist
        tags = [pos.category];
      }

      // Process each tag for this position
      for (const tag of tags) {
        if (!tag || tag === 'NONE' || tag.toLowerCase() === 'none') continue;

        // Initialize tag stats if not exists
        if (!tagMap.has(tag)) {
          tagMap.set(tag, {
            positions: [],
            totalPnL: 0,
            wins: [],
            losses: [],
          });
        }

        const stats = tagMap.get(tag)!;
        // Check if this position was already added to this tag (avoid duplicates within same tag)
        const positionKey = `${pos.conditionId}:${pos.outcome}`;
        const alreadyAdded = stats.positions.some(p => `${p.conditionId}:${p.outcome}` === positionKey);
        
        // Add position to this tag's stats (if not already added to this specific tag)
        if (!alreadyAdded) {
          stats.positions.push(pos);
          stats.totalPnL += pos.realizedPnL;
          
          if (pos.realizedPnL > 0) {
            stats.wins.push(pos.realizedPnL);
          } else if (pos.realizedPnL < 0) {
            stats.losses.push(pos.realizedPnL);
          }
        }
      }
    }

    // Calculate tag statistics
    const tagStats: TagStats[] = Array.from(tagMap.entries()).map(([tag, data]) => {
      const positionCount = data.positions.length;
      const winCount = data.wins.length;
      const lossCount = data.losses.length;
      const winRate = positionCount > 0 ? (winCount / positionCount) * 100 : 0;
      const avgPnL = positionCount > 0 ? data.totalPnL / positionCount : 0;
      const biggestWin = data.wins.length > 0 ? Math.max(...data.wins) : 0;
      const biggestLoss = data.losses.length > 0 ? Math.min(...data.losses) : 0;

      // YES positions stats
      const yesPositions = data.positions.filter(pos => pos.side === 'Long YES');
      const yesPnL = yesPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
      const yesWins = yesPositions.filter(pos => pos.realizedPnL > 0).length;
      const yesWinRate = yesPositions.length > 0 ? (yesWins / yesPositions.length) * 100 : 0;
      const yesAvgPnL = yesPositions.length > 0 ? yesPnL / yesPositions.length : 0;
      const yesCount = yesPositions.length;

      // NO positions stats
      const noPositions = data.positions.filter(pos => pos.side === 'Long NO');
      const noPnL = noPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
      const noWins = noPositions.filter(pos => pos.realizedPnL > 0).length;
      const noWinRate = noPositions.length > 0 ? (noWins / noPositions.length) * 100 : 0;
      const noAvgPnL = noPositions.length > 0 ? noPnL / noPositions.length : 0;
      const noCount = noPositions.length;

      return {
        tag,
        totalPnL: data.totalPnL,
        positionCount,
        winCount,
        lossCount,
        winRate,
        avgPnL,
        biggestWin,
        biggestLoss,
        yesPnL,
        yesWinRate,
        yesAvgPnL,
        yesCount,
        noPnL,
        noWinRate,
        noAvgPnL,
        noCount,
      };
    });

    // Default sort by total PnL (descending)
    tagStats.sort((a, b) => b.totalPnL - a.totalPnL);

    return {
      tagStats, // Show all tags to see both winners and losers
    };
  }, [positions]);

  // Sort the tag stats based on selected column
  const sortedTagStats = useMemo(() => {
    if (!sortColumn) return analytics.tagStats;

    const sorted = [...analytics.tagStats].sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [analytics.tagStats, sortColumn, sortDirection]);

  const handleSort = (column: keyof TagStats) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIndicator = ({ column }: { column: keyof TagStats }) => {
    if (sortColumn !== column) return null;
    return <span className="text-hyper-accent ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  if (positions.length === 0) {
    return (
      <div className="bg-hyper-panel border border-hyper-border rounded p-4">
        <div className="text-center text-hyper-textSecondary text-sm">
          No data available for analytics
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hyper-panel border border-hyper-border rounded p-4">
      <div>
        <h3 className="text-sm font-medium text-hyper-textPrimary mb-4">Tag Performance Analytics</h3>
        {/* Best and Worst Tags */}
        {sortedTagStats.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-hyper-panelHover border border-hyper-border rounded p-3">
              <div className="text-xs text-hyper-textSecondary mb-1">Best Performing Tag</div>
              <div className="text-sm font-medium text-hyper-textPrimary mb-1">
                {sortedTagStats[0].tag}
              </div>
              <div className={`text-base  font-medium ${
                sortedTagStats[0].totalPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
              }`}>
                ${formatNumber(sortedTagStats[0].totalPnL)}
              </div>
              <div className="text-xs text-hyper-textSecondary mt-1">
                {sortedTagStats[0].positionCount} {sortedTagStats[0].positionCount === 1 ? 'position' : 'positions'}
              </div>
            </div>

            {sortedTagStats.length > 1 && (
              <div className="bg-hyper-panelHover border border-hyper-border rounded p-3">
                <div className="text-xs text-hyper-textSecondary mb-1">Worst Performing Tag</div>
                <div className="text-sm font-medium text-hyper-textPrimary mb-1">
                  {sortedTagStats[sortedTagStats.length - 1].tag}
                </div>
                <div className={`text-base  font-medium ${
                  sortedTagStats[sortedTagStats.length - 1].totalPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
                }`}>
                  ${formatNumber(sortedTagStats[sortedTagStats.length - 1].totalPnL)}
                </div>
                <div className="text-xs text-hyper-textSecondary mt-1">
                  {sortedTagStats[sortedTagStats.length - 1].positionCount} {sortedTagStats[sortedTagStats.length - 1].positionCount === 1 ? 'position' : 'positions'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tag Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hyper-panelHover">
              <tr>
                <th 
                  className="px-3 py-2 text-left text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('tag')}
                >
                  Tag <SortIndicator column="tag" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('totalPnL')}
                >
                  Total PnL <SortIndicator column="totalPnL" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('positionCount')}
                >
                  Positions <SortIndicator column="positionCount" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('winRate')}
                >
                  Win Rate <SortIndicator column="winRate" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('avgPnL')}
                >
                  Avg PnL <SortIndicator column="avgPnL" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('biggestWin')}
                >
                  Biggest Win <SortIndicator column="biggestWin" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('biggestLoss')}
                >
                  Biggest Loss <SortIndicator column="biggestLoss" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('yesPnL')}
                >
                  YES PnL <SortIndicator column="yesPnL" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('yesWinRate')}
                >
                  YES WR <SortIndicator column="yesWinRate" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('yesCount')}
                >
                  YES Cnt <SortIndicator column="yesCount" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('noPnL')}
                >
                  NO PnL <SortIndicator column="noPnL" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('noWinRate')}
                >
                  NO WR <SortIndicator column="noWinRate" />
                </th>
                <th 
                  className="px-3 py-2 text-right text-xs font-medium text-hyper-textSecondary uppercase cursor-pointer hover:bg-hyper-border transition-colors select-none"
                  onClick={() => handleSort('noCount')}
                >
                  NO Cnt <SortIndicator column="noCount" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hyper-border">
              {sortedTagStats.map((stat) => (
                <tr key={stat.tag} className="hover:bg-hyper-panelHover">
                  <td className="px-3 py-2 text-hyper-textPrimary">{stat.tag}</td>
                  <td className={`px-3 py-2 text-right  ${
                    stat.totalPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
                  }`}>
                    ${formatNumber(stat.totalPnL)}
                  </td>
                  <td className="px-3 py-2 text-right text-hyper-textSecondary">
                    {stat.positionCount}
                  </td>
                  <td className="px-3 py-2 text-right text-hyper-textSecondary">
                    {stat.winRate.toFixed(1)}%
                  </td>
                  <td className={`px-3 py-2 text-right  ${
                    stat.avgPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
                  }`}>
                    ${formatNumber(stat.avgPnL)}
                  </td>
                  <td className={`px-3 py-2 text-right  ${
                    stat.biggestWin > 0 ? 'text-hyper-accent' : 'text-hyper-textSecondary'
                  }`}>
                    {stat.biggestWin > 0 ? `$${formatNumber(stat.biggestWin)}` : '-'}
                  </td>
                  <td className={`px-3 py-2 text-right  ${
                    stat.biggestLoss < 0 ? 'text-hyper-negative' : 'text-hyper-textSecondary'
                  }`}>
                    {stat.biggestLoss < 0 ? `$${formatNumber(stat.biggestLoss)}` : '-'}
                  </td>
                  <td className={`px-3 py-2 text-right  ${
                    stat.yesPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
                  }`}>
                    ${formatNumber(stat.yesPnL)}
                  </td>
                  <td className="px-3 py-2 text-right text-hyper-textSecondary">
                    {stat.yesWinRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-hyper-textSecondary">
                    {stat.yesCount}
                  </td>
                  <td className={`px-3 py-2 text-right  ${
                    stat.noPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
                  }`}>
                    ${formatNumber(stat.noPnL)}
                  </td>
                  <td className="px-3 py-2 text-right text-hyper-textSecondary">
                    {stat.noWinRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-hyper-textSecondary">
                    {stat.noCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
