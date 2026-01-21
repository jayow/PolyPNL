'use client';

import { useState } from 'react';
import { ClosedPosition } from '@/types';

interface ShareImageProps {
  position: ClosedPosition;
  showDollarPnL?: boolean;
  onToggleDollarPnL?: (show: boolean) => void;
}

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

export default function ShareImage({ position, showDollarPnL = false, onToggleDollarPnL }: ShareImageProps) {
  return (
    <div 
      className="bg-[#0B0F14] text-[#E6EDF6] relative overflow-hidden flex" 
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        width: '500px',
        height: '625px',
        aspectRatio: '4/5'
      }}
    >
      {/* Left Side - Market Info */}
      <div className="w-2/5 p-6 flex flex-col justify-between">
        {/* Top - Logo/Brand */}
        <div>
          <div className="text-xl font-bold mb-1 text-[#E6EDF6]">POLY PNL</div>
          <div className="text-xs text-[#8B949E]">Track your Polymarket trades</div>
        </div>

        {/* Middle - Market Info */}
        <div className="flex flex-col gap-3 flex-1 justify-center">
          {position.icon && (
            <img 
              src={position.icon} 
              alt="" 
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          <div>
            <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
              position.side === 'Long YES' 
                ? 'bg-[#00D26A]/20 text-[#00D26A]' 
                : 'bg-[#FF4444]/20 text-[#FF4444]'
            }`}>
              {position.side === 'Long YES' ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="text-base font-semibold leading-tight text-[#E6EDF6] break-words">
            {position.marketTitle || 'Market'}
          </div>
        </div>

        {/* Bottom - Footer */}
        <div className="text-[10px] text-[#8B949E]">
          Poly PNL
        </div>
      </div>

      {/* Right Side - Stats */}
      <div className="w-3/5 p-6 flex flex-col justify-center items-center">
        {/* Main PnL % - Large and Centered */}
        <div className="text-center mb-8">
          <div className={`text-6xl font-bold mb-2 ${
            position.realizedPnLPercent >= 0 ? 'text-[#00D26A]' : 'text-[#FF4444]'
          }`}>
            {position.realizedPnLPercent >= 0 ? '+' : ''}{position.realizedPnLPercent.toFixed(1)}%
          </div>
          {showDollarPnL && (
            <div className={`text-xl font-semibold ${
              position.realizedPnL >= 0 ? 'text-[#00D26A]' : 'text-[#FF4444]'
            }`}>
              ${formatNumber(position.realizedPnL)}
            </div>
          )}
        </div>

        {/* Bottom - Entry and Exit Prices */}
        <div className="flex items-center gap-6 mt-auto">
          <div className="text-center">
            <div className="text-xs text-[#8B949E] mb-1">Entry Price</div>
            <div className="text-lg font-semibold text-[#E6EDF6]">{position.entryVWAP.toFixed(3)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[#8B949E] mb-1">Exit Price</div>
            <div className="text-lg font-semibold text-[#E6EDF6]">{position.exitVWAP.toFixed(3)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
