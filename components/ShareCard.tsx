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
  customBackground?: string | null;
  wallet?: string;
  username?: string | null;
  profileImage?: string | null;
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

export default function ShareCard({ position, showDollarPnL = false, debug = false, id, customBackground = null, wallet = '', username = null, profileImage = null }: ShareCardProps) {
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
        backgroundImage: customBackground ? `url(${customBackground})` : 'url(/bg.png)',
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

      {/* Username or Wallet Address with Avatar - Top Left */}
      {(username || wallet) && (
        <div
          style={{
            position: 'absolute',
            top: `${SAFE_PAD*1.4}px`,
            left: `${SAFE_PAD*1.6}px`,
            zIndex: 10,
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '20px',
            color: '#E6EDF6',
            fontWeight: '500',
            fontFamily: username ? 'system-ui, -apple-system, sans-serif' : 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            // backgroundColor removed
          }}
        >
          {profileImage ? (
            <img
              src={profileImage.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(profileImage)}` : profileImage}
              alt={username || 'Profile'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(230, 237, 246, 0.3)',
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#2E5CFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: '600',
                flexShrink: 0,
              }}
            >
              {(username || wallet) ? (username || wallet).charAt(0).toUpperCase() : '?'}
            </div>
          )}
          <span>
            {username || (wallet.length > 10 
              ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
              : wallet)
            }
          </span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '350px 350px',
          columnGap: '24px',
          alignItems: 'start',
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
          justifyContent: 'flex-start',
          width: '100%',
          flexShrink: 0,
          gap: '20px',
          marginLeft: `-${SAFE_PAD*0.5}px`,
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
            {/* Always render an image - either the market icon or polysquare.webp fallback */}
            <img 
              src={marketIconUrl ? `/api/image-proxy?url=${encodeURIComponent(marketIconUrl)}` : '/polysquare.webp'}
              alt=""
              {...(marketIconUrl ? { crossOrigin: "anonymous" } : {})}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                position: 'relative',
                zIndex: 1,
              }}
              onError={(e) => {
                // If market icon fails to load, fallback to polysquare.webp
                const img = e.target as HTMLImageElement;
                if (marketIconUrl && !img.src.includes('polysquare.webp')) {
                  img.src = '/polysquare.webp';
                  img.removeAttribute('crossOrigin');
                }
              }}
            />
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
              overflow: 'visible',
              whiteSpace: 'nowrap',
              textOverflow: 'clip',
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
                Bet size: ${formatNumber(position.size, 1)}
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

      {/* Text - Bottom Left */}
      <div
        style={{
          position: 'absolute',
          bottom: `${SAFE_PAD*2}px`,
          left: `${SAFE_PAD * 2.1}px`,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          textAlign: 'left',
          fontSize: '11px',
          color: '#E6EDF6',
          fontWeight: '600',
        }}
      >
        <div>Get your own PnL at polypnl.hanyon.app</div>
        <div>Follow us on X @jayowtrades</div>
      </div>
    </div>
  );
}