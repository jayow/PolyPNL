'use client';

import { useState, useEffect, useRef } from 'react';
import { PositionSummary } from '@/types';
import { ClosedPosition } from '@/types';

interface TopStatsRowV2Props {
  summary: PositionSummary;
  positions: ClosedPosition[];
  username?: string | null;
  profileImage?: string | null;
  wallet?: string;
}

// Reuse existing formatting functions (no logic changes)
function formatNumber(num: number, decimals: number = 2): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}M`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}K`;
  } else {
    return `${sign}${absNum.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
}

function formatDays(days: number): string {
  if (days < 1) {
    return `${Math.round(days * 24)} hour${Math.round(days * 24) !== 1 ? 's' : ''}`;
  } else if (days < 7) {
    return `${days.toFixed(1)} day${days !== 1 ? 's' : ''}`;
  } else if (days < 30) {
    const weeks = days / 7;
    return `${weeks.toFixed(1)} week${weeks !== 1 ? 's' : ''}`;
  } else if (days < 365) {
    const months = days / 30;
    return `${months.toFixed(1)} month${months !== 1 ? 's' : ''}`;
  } else {
    const years = days / 365;
    return `${years.toFixed(1)} year${years !== 1 ? 's' : ''}`;
  }
}

export default function TopStatsRowV2({ summary, positions, username, profileImage, wallet }: TopStatsRowV2Props) {
  const tagsContainerRef = useRef<HTMLDivElement>(null);
  const [displayedTags, setDisplayedTags] = useState<string[]>([]);
  
  // Calculate YES/NO stats (same logic as YesNoAnalytics, no changes)
  const yesPositions = positions.filter(pos => pos.side === 'Long YES');
  const noPositions = positions.filter(pos => pos.side === 'Long NO');
  
  const yesPnL = yesPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
  const yesWins = yesPositions.filter(pos => pos.realizedPnL > 0).length;
  const yesWinRate = yesPositions.length > 0 ? (yesWins / yesPositions.length) * 100 : 0;
  const yesAvgPnL = yesPositions.length > 0 ? yesPnL / yesPositions.length : 0;
  const yesCount = yesPositions.length;

  const noPnL = noPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
  const noWins = noPositions.filter(pos => pos.realizedPnL > 0).length;
  const noWinRate = noPositions.length > 0 ? (noWins / noPositions.length) * 100 : 0;
  const noAvgPnL = noPositions.length > 0 ? noPnL / noPositions.length : 0;
  const noCount = noPositions.length;

  // Get all available tags
  const allTags = summary.topTags && summary.topTags.length > 0 
    ? summary.topTags
    : (summary.mostUsedTag ? [summary.mostUsedTag] : []);

  // Determine how many tags fit on one line
  useEffect(() => {
    if (tagsContainerRef.current && allTags.length > 0) {
      const container = tagsContainerRef.current;
      const containerWidth = container.offsetWidth;
      
      // Test how many tags fit
      const testTags = (count: number): boolean => {
        // Create temporary elements to measure
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'position: absolute; visibility: hidden; display: flex; gap: 4px;';
        tempContainer.className = 'flex flex-nowrap gap-1';
        
        const tagsToTest = allTags.slice(0, count);
        tagsToTest.forEach(tag => {
          const span = document.createElement('span');
          span.className = 'text-[11.7px] text-hyper-textSecondary px-1.5 py-0.5 bg-hyper-panelHover rounded whitespace-nowrap flex-shrink-0';
          span.textContent = tag;
          tempContainer.appendChild(span);
        });
        
        document.body.appendChild(tempContainer);
        const totalWidth = tempContainer.offsetWidth;
        document.body.removeChild(tempContainer);
        
        return totalWidth <= containerWidth;
      };
      
      // Start with 3 tags, reduce if needed
      let tagCount = Math.min(3, allTags.length);
      if (!testTags(tagCount)) {
        tagCount = 2;
        if (!testTags(tagCount)) {
          tagCount = 1;
        }
      }
      
      setDisplayedTags(allTags.slice(0, tagCount));
    } else {
      setDisplayedTags(allTags);
    }
  }, [allTags]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[150px_1.5fr_1fr_0.9fr_0.9fr_150px] gap-2 mb-2">
      {/* Card 0: User Profile - Square card with image and username */}
      {(username || wallet) && (
        <div className="bg-hyper-panel border border-hyper-border rounded p-2 flex flex-col">
          <div className="w-full flex-shrink-0 mb-1" style={{ height: '75%', minHeight: 0 }}>
            {profileImage ? (
              <img
                src={profileImage.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(profileImage)}` : profileImage}
                alt={username || 'Profile'}
                className="w-full h-full object-cover rounded"
                crossOrigin="anonymous"
              />
            ) : (
              <div
                className="w-full h-full rounded flex items-center justify-center text-white text-2xl font-semibold"
                style={{ backgroundColor: '#2E5CFF' }}
              >
                {(username || wallet) ? (username || wallet || '').charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>
          <div className="w-full flex-shrink-0 text-center flex items-center justify-center" style={{ height: '25%' }}>
            <div className="text-xs font-semibold text-hyper-textPrimary truncate w-full">
              {username || (wallet && wallet.length > 10 
                ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
                : wallet || '-')
              }
            </div>
          </div>
        </div>
      )}

      {/* Card 1: Total PnL (Hero) */}
      <div className="bg-hyper-panel border border-hyper-border rounded px-3 flex flex-col" style={{ paddingTop: '20px', paddingBottom: '12px' }}>
        <div className="flex flex-col items-center flex-shrink-0" style={{ minHeight: '60px', marginBottom: '12px' }}>
          <div className={`text-5xl font-semibold leading-none ${
            summary.totalRealizedPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
          }`} style={{ lineHeight: '1' }}>
            ${formatNumber(summary.totalRealizedPnL)}
          </div>
          <div className="text-[12.6px] text-hyper-textSecondary mt-1 tracking-wide">Total Realized PnL</div>
        </div>
        
        {/* Sub-metrics: single row, spread equally */}
        <div className="flex gap-x-1 gap-y-1.5 pt-1 border-t border-hyper-border mt-auto justify-center">
          <div className="flex-shrink-0 text-center">
            <div className="text-[9px] text-hyper-textSecondary">Avg PnL</div>
            <div className={`text-lg  font-semibold ${
              summary.avgPnLPerPosition >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(summary.avgPnLPerPosition)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-2 text-center">
            <div className="text-[9px] text-hyper-textSecondary">Avg Size</div>
            <div className="text-lg  font-semibold text-hyper-textPrimary">
              {formatNumber(summary.avgPosSize, 1)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-1 text-center">
            <div className="text-[9px] text-hyper-textSecondary">Avg Holding</div>
            <div className="text-lg  font-semibold text-hyper-textPrimary whitespace-nowrap">
              {summary.avgHoldingTime > 0 ? formatDays(summary.avgHoldingTime) : '-'}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3 text-center">
            <div className="text-[9px] text-hyper-textSecondary">Big Win</div>
            <div className="text-lg  font-semibold text-hyper-accent">
              ${formatNumber(summary.biggestWin)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3 text-center">
            <div className="text-[9px] text-hyper-textSecondary">Big Loss</div>
            <div className="text-lg  font-semibold text-hyper-negative">
              ${formatNumber(summary.biggestLoss)}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Win Rate (Summary) */}
      <div className="bg-hyper-panel border border-hyper-border rounded px-3 flex flex-col" style={{ paddingTop: '20px', paddingBottom: '12px' }}>
        <div className="flex flex-col items-center flex-shrink-0" style={{ minHeight: '60px', marginBottom: '12px' }}>
          <div className="text-5xl font-semibold text-hyper-accent leading-none" style={{ lineHeight: '1' }}>
            {summary.winrate.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </div>
          <div className="text-[12.6px] text-hyper-textSecondary mt-1 tracking-wide">Win Rate</div>
        </div>
        
        {/* Secondary items: single row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 border-t border-hyper-border mt-auto justify-center">
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">Positions</div>
            <div className="text-lg  font-semibold text-hyper-textPrimary">
              {summary.totalPositionsClosed.toLocaleString('en-US')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">Top Category</div>
            <div className="text-lg font-semibold text-hyper-textPrimary truncate" title={summary.mostUsedCategory}>
              {summary.mostUsedCategory}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary mb-0.5">Top Tags</div>
            <div ref={tagsContainerRef} className="flex flex-nowrap gap-1 justify-center overflow-hidden" style={{ height: '24px', minHeight: '24px', maxHeight: '24px' }}>
              {displayedTags.length > 0 ? (
                displayedTags.map((tag, idx) => (
                  <span key={idx} className="text-[11.7px] text-hyper-textSecondary px-1.5 py-0.5 bg-hyper-panelHover rounded whitespace-nowrap flex-shrink-0">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-[9px] text-hyper-textSecondary">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Long YES */}
      <div className="bg-hyper-panel border border-hyper-border rounded px-3 flex flex-col" style={{ paddingTop: '20px', paddingBottom: '12px' }}>
        <div className="flex flex-col items-center flex-shrink-0" style={{ minHeight: '60px', marginBottom: '12px' }}>
          {/* Highlighted PnL */}
          <div className={`text-5xl font-semibold leading-none ${
            yesPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
          }`} style={{ lineHeight: '1' }}>
            ${formatNumber(yesPnL)}
          </div>
          <div className="text-[12.6px] text-hyper-textSecondary mt-1 tracking-wide">YES Realized PnL</div>
        </div>
        
        {/* Other stats below divider */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 border-t border-hyper-border mt-auto justify-center">
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">WR</div>
            <div className="text-lg  font-semibold text-hyper-textPrimary">
              {yesWinRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">Avg</div>
            <div className={`text-lg  font-semibold ${
              yesAvgPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(yesAvgPnL)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">Count</div>
            <div className="text-lg  font-semibold text-hyper-textPrimary">
              {yesCount.toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* Card 4: Long NO */}
      <div className="bg-hyper-panel border border-hyper-border rounded px-3 flex flex-col" style={{ paddingTop: '20px', paddingBottom: '12px' }}>
        <div className="flex flex-col items-center flex-shrink-0" style={{ minHeight: '60px', marginBottom: '12px' }}>
          {/* Highlighted PnL */}
          <div className={`text-5xl font-semibold leading-none ${
            noPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
          }`} style={{ lineHeight: '1' }}>
            ${formatNumber(noPnL)}
          </div>
          <div className="text-[12.6px] text-hyper-textSecondary mt-1 tracking-wide">NO Realized PnL</div>
        </div>
        
        {/* Other stats below divider */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 border-t border-hyper-border mt-auto justify-center">
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">WR</div>
            <div className="text-lg  font-semibold text-hyper-textPrimary">
              {noWinRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">Avg</div>
            <div className={`text-lg  font-semibold ${
              noAvgPnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'
            }`}>
              ${formatNumber(noAvgPnL)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-hyper-textSecondary">Count</div>
            <div className="text-lg  font-semibold text-hyper-textPrimary">
              {noCount.toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* Card 5: Share Stats */}
      <div className="bg-hyper-panel border border-hyper-border rounded py-3 px-3 flex flex-col items-center justify-center h-full">
        <div className="text-lg text-hyper-textSecondary tracking-wide mb-2">Share</div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-hyper-textSecondary">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
          <polyline points="16 6 12 2 8 6"></polyline>
          <line x1="12" y1="2" x2="12" y2="15"></line>
        </svg>
      </div>
    </div>
  );
}
