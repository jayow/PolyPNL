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
  id?: string;
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

export default function ShareCard({ position, showDollarPnL = false, debug = false, id }: ShareCardProps) {
  const marketIconUrl = position.icon;
  const marketName = (position.marketTitle || 'Market').trim();
  const firstLetter = (marketName[0] || 'M').toUpperCase();
  
  // Dynamic font size for market name: reduce if > 50 characters
  const marketNameFontSize = marketName.length > 50 ? '14px' : '16px';
  // Use 3 lines for longer titles, 2 for shorter
  const marketNameLineClamp = marketName.length > 50 ? 3 : 2;

  return (
    <div
      id={id}
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        width: `${SHARE_W}px`,
        height: `${SHARE_H}px`,
        backgroundColor: '#0B0F14',
        backgroundImage: 'url(/bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#E6EDF6',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Semi-transparent overlay for better text readability */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 15, 20, 0.5)',
          zIndex: 1,
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '350px 1fr',
          columnGap: '24px',
          alignItems: 'center',
          alignContent: 'start',
          paddingTop: `${SAFE_PAD + (SHARE_H * 0.15)}px`,
          paddingRight: `${SAFE_PAD}px`,
          paddingBottom: `${SAFE_PAD}px`,
          paddingLeft: `${SAFE_PAD}px`,
          height: '100%',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* LEFT COLUMN: Market Icon + Branding */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          width: '100%',
          flexShrink: 0,
          gap: '16px',
        }}>
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
            {/* Fallback */}
            <div
              style={{
                position: 'absolute',
                inset: '0',
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
            
            {/* Image - using proxy to avoid CORS */}
            {marketIconUrl && (
              <img 
                src={`/api/image-proxy?url=${encodeURIComponent(marketIconUrl)}`}
                alt=""
                crossOrigin="anonymous"
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
          
          {/* Branding below icon */}
          <div
            style={{
              fontSize: '11px',
              color: '#E6EDF6',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div>POLYPNL made by jayowtrades</div>
            <div>polypnl.hanyon.app</div>
          </div>
        </div>

        {/* RIGHT COLUMN: Text Content */}
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            textAlign: 'right',
            minWidth: '0',
            width: '100%',
            overflow: 'visible',
            maxWidth: '100%',
            gap: '10px',
          }}
        >
          {/* 1) YES/NO */}
          <div style={{ width: '100%', minWidth: '0' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              alignItems: 'center', 
              flexWrap: 'nowrap',
            }}>
              <span 
                style={{
                  padding: '4px 16px',
                  borderRadius: '4px',
                  fontWeight: '600',
                  fontSize: '26px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  backgroundColor: position.side === 'Long YES' ? 'rgba(0, 210, 106, 1.0)' : 'rgba(255, 68, 68, 1.0)',
                  color: '#FFFFFF',
                }}
              >
                {position.side === 'Long YES' ? 'YES' : 'NO'}
              </span>
            </div>
          </div>

          {/* 2) Market name */}
          <div
            style={{
              width: '100%',
              minWidth: '0',
              maxWidth: '100%',
              paddingTop: '1px',
            }}
          >
            <div
              style={{
                fontSize: marketNameFontSize,
                fontWeight: '600',
                color: '#E6EDF6',
                display: '-webkit-box',
                WebkitLineClamp: marketNameLineClamp,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                textAlign: 'right',
                width: '100%',
                minWidth: '0',
                maxWidth: '100%',
                lineHeight: '1.25',
              }}
            >
              {marketName}
            </div>
          </div>

          {/* 3) BIG PnL % */}
          <div 
            style={{ 
              fontSize: '76px',
              fontWeight: 'bold',
              color: position.realizedPnLPercent >= 0 ? '#00D26A' : '#FF4444',
              textAlign: 'right',
              width: '100%',
              minWidth: '0',
              maxWidth: '100%',
              lineHeight: '0.95',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {position.realizedPnLPercent >= 0 ? '+' : ''}{position.realizedPnLPercent.toFixed(1)}%
          </div>

          {/* 4) PnL $ + Bet size */}
          {showDollarPnL && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                whiteSpace: 'nowrap',
                justifyContent: 'flex-end',
                width: '100%',
                minWidth: '0',
                maxWidth: '100%',
                flexWrap: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <div 
                style={{
                  fontSize: '21px',
                  fontWeight: '600',
                  color: position.realizedPnL >= 0 ? '#00D26A' : '#FF4444',
                  flexShrink: 1,
                  minWidth: '0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                ${formatNumber(position.realizedPnL)}
              </div>
              <div 
                style={{
                  fontSize: '21px',
                  fontWeight: '600',
                  color: '#E6EDF6',
                  flexShrink: 1,
                  minWidth: '0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Bet size: {formatNumber(position.size, 1)}
              </div>
            </div>
          )}

          {/* 5) Details block */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              width: '100%',
              minWidth: '0',
            }}
          >
            {/* Left mini column */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              alignItems: 'flex-end',
              minWidth: '0',
            }}>
              <div style={{ width: '100%', minWidth: '0' }}>
                <div 
                  style={{
                    fontSize: '12px',
                    color: '#8B949E',
                    textAlign: 'right',
                    marginBottom: '2px',
                  }}
                >
                  Entry
                </div>
                <div 
                  style={{ 
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#E6EDF6',
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
                <div style={{ width: '100%', minWidth: '0' }}>
                  <div 
                    style={{
                      fontSize: '12px',
                      color: '#8B949E',
                      textAlign: 'right',
                      marginBottom: '2px',
                    }}
                  >
                    Date Opened
                  </div>
                  <div 
                    style={{ 
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#E6EDF6',
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
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              alignItems: 'flex-end',
              minWidth: '0',
            }}>
              <div style={{ width: '100%', minWidth: '0' }}>
                <div 
                  style={{
                    fontSize: '12px',
                    color: '#8B949E',
                    textAlign: 'right',
                    marginBottom: '2px',
                  }}
                >
                  Exit
                </div>
                <div 
                  style={{ 
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#E6EDF6',
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
                <div style={{ width: '100%', minWidth: '0' }}>
                  <div 
                    style={{
                      fontSize: '12px',
                      color: '#8B949E',
                      textAlign: 'right',
                      marginBottom: '2px',
                    }}
                  >
                    Date Closed
                  </div>
                  <div 
                    style={{ 
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#E6EDF6',
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
    </div>
  );
}