'use client';

import { ClosedPosition } from '@/types';

// Canonical share card dimensions (16:9 landscape)
export const SHARE_W = 840;
export const SHARE_H = 472;
export const SAFE_PAD = 32;

interface ShareCardProps {
  position: ClosedPosition;
  showDollarPnL?: boolean;
  debug?: boolean;
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

export default function ShareCard({ position, showDollarPnL = false, debug = false }: ShareCardProps) {
  const marketIconUrl = position.icon;
  const marketName = (position.marketTitle || 'Market').trim();
  const firstLetter = (marketName[0] || 'M').toUpperCase();
  
  // Dynamic font size for market name: reduce if > 50 characters
  const marketNameFontSize = marketName.length > 50 ? '14px' : '16px';
  // Use 3 lines for longer titles, 2 for shorter
  const marketNameLineClamp = marketName.length > 50 ? 3 : 2;

  return (
    <div
      className="bg-[#0B0F14] text-[#E6EDF6] relative"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        width: `${SHARE_W}px`,
        height: `${SHARE_H}px`,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        columnGap: '24px',
        alignItems: 'center',
        alignContent: 'start',
        paddingTop: `${SAFE_PAD + (SHARE_H * 0.15)}px`,
        paddingRight: `${SAFE_PAD}px`,
        paddingBottom: `${SAFE_PAD}px`,
        paddingLeft: `${SAFE_PAD}px`,
        overflow: 'hidden',
        border: debug ? '1px solid red' : 'none',
      }}
    >
      {/* LEFT COLUMN: Market Icon - Same approach as Table component */}
      <div className="flex items-center justify-center" style={{ width: '100%', flexShrink: 0 }}>
        <div
          style={{
            width: '250px',
            height: '250px',
            borderRadius: '16px',
            backgroundColor: '#1D2A3A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {/* Fallback - always rendered, shows if no icon or image fails */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#121A24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '120px',
              fontWeight: 'bold',
              color: '#E6EDF6',
            }}
          >
            {firstLetter}
          </div>
          
          {/* Image - same simple approach as Table component */}
          {marketIconUrl && (
            <img 
              src={marketIconUrl} 
              alt="" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                position: 'relative',
                zIndex: 1,
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Text Content (right-aligned) */}
      <div 
        className="flex flex-col"
        style={{
          height: '100%',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          textAlign: 'right',
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
          maxWidth: '100%',
          gap: '10px',
        }}
      >
        {/* 1) SIDE YES/NO */}
        <div style={{ width: '100%', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
            <span 
              className="text-[#8B949E]"
              style={{ fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              SIDE
            </span>
            <span 
              className={`px-2 py-0.5 rounded font-semibold ${
                position.side === 'Long YES' 
                  ? 'bg-[#00D26A]/20 text-[#00D26A]' 
                  : 'bg-[#FF4444]/20 text-[#FF4444]'
              }`}
              style={{ fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {position.side === 'Long YES' ? 'YES' : 'NO'}
            </span>
          </div>
        </div>

        {/* 2) Market name (clamp to 2-3 lines based on length, right-aligned, dynamic font size) */}
        <div
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            paddingTop: '1px',
          }}
        >
          <div
            className="font-semibold text-[#E6EDF6]"
            style={{
              fontSize: marketNameFontSize,
              display: '-webkit-box',
              WebkitLineClamp: marketNameLineClamp,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              textAlign: 'right',
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              lineHeight: '1.25',
            }}
          >
            {marketName}
          </div>
        </div>

        {/* 3) BIG PnL % (hero, right-aligned) */}
        <div 
          className={`font-bold ${
            position.realizedPnLPercent >= 0 ? 'text-[#00D26A]' : 'text-[#FF4444]'
          }`}
          style={{ 
            fontSize: 'clamp(52px, 7vw, 76px)',
            textAlign: 'right',
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            lineHeight: '0.95',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {position.realizedPnLPercent >= 0 ? '+' : ''}{position.realizedPnLPercent.toFixed(1)}%
        </div>

        {/* 4) Under hero row: PnL $ (if enabled) + Bet size (only if P&L is toggled) */}
        {showDollarPnL && (
          <div 
            className="flex items-center gap-4"
            style={{
              whiteSpace: 'nowrap',
              justifyContent: 'flex-end',
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              flexWrap: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <div 
              className={`font-semibold ${
                position.realizedPnL >= 0 ? 'text-[#00D26A]' : 'text-[#FF4444]'
              }`}
              style={{ fontSize: '21px', flexShrink: 1, minWidth: 0 }}
            >
              ${formatNumber(position.realizedPnL)}
            </div>
            <div 
              className="font-semibold text-[#E6EDF6]"
              style={{ fontSize: '21px', flexShrink: 1, minWidth: 0 }}
            >
              Bet size: {formatNumber(position.size, 1)}
            </div>
          </div>
        )}

        {/* 5) Details block (2 mini columns, right-aligned) - adjusted gap for better text fit */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            width: '100%',
            minWidth: 0,
          }}
        >
          {/* Left mini column */}
          <div className="flex flex-col gap-1" style={{ alignItems: 'flex-end', minWidth: 0 }}>
            <div style={{ width: '100%', minWidth: 0 }}>
              <div 
                className="text-[#8B949E] mb-0.5"
                style={{ fontSize: '12px', textAlign: 'right' }}
              >
                Entry
              </div>
              <div 
                className="font-semibold text-[#E6EDF6]"
                style={{ 
                  fontSize: '14px', 
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {position.entryVWAP.toFixed(3)}
              </div>
            </div>
            {position.openedAt && (
              <div style={{ width: '100%', minWidth: 0 }}>
                <div 
                  className="text-[#8B949E] mb-0.5"
                  style={{ fontSize: '12px', textAlign: 'right' }}
                >
                  Date Opened
                </div>
                <div 
                  className="font-semibold text-[#E6EDF6]"
                  style={{ 
                    fontSize: '13px', 
                    textAlign: 'right',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    lineHeight: '1.3',
                  }}
                >
                  {new Date(position.openedAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right mini column */}
          <div className="flex flex-col gap-1" style={{ alignItems: 'flex-end', minWidth: 0 }}>
            <div style={{ width: '100%', minWidth: 0 }}>
              <div 
                className="text-[#8B949E] mb-0.5"
                style={{ fontSize: '12px', textAlign: 'right' }}
              >
                Exit
              </div>
              <div 
                className="font-semibold text-[#E6EDF6]"
                style={{ 
                  fontSize: '14px', 
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {position.exitVWAP.toFixed(3)}
              </div>
            </div>
            {position.closedAt && (
              <div style={{ width: '100%', minWidth: 0 }}>
                <div 
                  className="text-[#8B949E] mb-0.5"
                  style={{ fontSize: '12px', textAlign: 'right' }}
                >
                  Date Closed
                </div>
                <div 
                  className="font-semibold text-[#E6EDF6]"
                  style={{ 
                    fontSize: '13px', 
                    textAlign: 'right',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    lineHeight: '1.3',
                  }}
                >
                  {new Date(position.closedAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}