'use client';

import { useEffect, useRef, useState } from 'react';
import { PositionSummary, ClosedPosition } from '@/types';
import { SHARE_W, SHARE_H, SAFE_PAD } from './ShareCard';

interface ShareCardSummaryProps {
  summary: PositionSummary;
  positions: ClosedPosition[];
  username?: string | null;
  profileImage?: string | null;
  wallet?: string;
  customBackground?: string | null;
  debug?: boolean;
  id?: string;
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

// Calculate cumulative PnL data points for the graph
function calculateCumulativePnL(positions: ClosedPosition[]): Array<{ date: number; cumulativePnL: number; position?: ClosedPosition }> {
  if (positions.length === 0) return [];

  // Sort positions by closedAt date (or openedAt if closedAt is null)
  const sortedPositions = [...positions].sort((a, b) => {
    const dateA = a.closedAt ? new Date(a.closedAt).getTime() : new Date(a.openedAt).getTime();
    const dateB = b.closedAt ? new Date(b.closedAt).getTime() : new Date(b.openedAt).getTime();
    return dateA - dateB;
  });

  let cumulativePnL = 0;
  const dataPoints: Array<{ date: number; cumulativePnL: number; position?: ClosedPosition }> = [];

  for (const pos of sortedPositions) {
    cumulativePnL += pos.realizedPnL;
    const date = pos.closedAt ? new Date(pos.closedAt).getTime() : new Date(pos.openedAt).getTime();
    dataPoints.push({ date, cumulativePnL, position: pos });
  }

  return dataPoints;
}

// Draw line graph on canvas
function drawLineGraph(
  canvas: HTMLCanvasElement,
  dataPoints: Array<{ date: number; cumulativePnL: number; position?: ClosedPosition }>,
  width: number,
  height: number,
  bestPosition?: ClosedPosition,
  worstPosition?: ClosedPosition
) {
  if (dataPoints.length === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (dataPoints.length === 1) {
    // Single point - draw horizontal line
    const y = height / 2;
    ctx.strokeStyle = dataPoints[0].cumulativePnL >= 0 ? '#00D26A' : '#FF4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    return;
  }

  // Find min/max for scaling
  const minPnL = Math.min(...dataPoints.map(d => d.cumulativePnL), 0);
  const maxPnL = Math.max(...dataPoints.map(d => d.cumulativePnL), 0);
  const range = maxPnL - minPnL || 1; // Avoid division by zero

  // Padding for the graph
  const padding = 20;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Determine color based on final PnL
  const finalPnL = dataPoints[dataPoints.length - 1].cumulativePnL;
  const isPositive = finalPnL >= 0;

  // Draw the line
  ctx.strokeStyle = isPositive ? '#00D26A' : '#FF4444';
  ctx.lineWidth = 3;
  ctx.beginPath();

  const pointCoords: Array<{ x: number; y: number; position?: ClosedPosition }> = [];

  dataPoints.forEach((point, index) => {
    const x = padding + (index / (dataPoints.length - 1)) * graphWidth;
    const normalizedPnL = (point.cumulativePnL - minPnL) / range;
    const y = padding + graphHeight - (normalizedPnL * graphHeight);

    pointCoords.push({ x, y, position: point.position });

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw markers for best and worst positions
  if (bestPosition || worstPosition) {
    pointCoords.forEach((coord) => {
      if (coord.position) {
        const isBest = bestPosition && coord.position === bestPosition;
        const isWorst = worstPosition && coord.position === worstPosition;
        
        if (isBest || isWorst) {
          // Draw white circle marker
          ctx.beginPath();
          ctx.arc(coord.x, coord.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        }
      }
    });
  }

  return pointCoords;
}

export default function ShareCardSummary({ 
  summary, 
  positions, 
  username, 
  profileImage, 
  wallet, 
  customBackground = null,
  debug = false,
  id 
}: ShareCardSummaryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cumulativeData = calculateCumulativePnL(positions);
  const topTags = summary.topTags && summary.topTags.length > 0 
    ? summary.topTags.slice(0, 3)
    : [];

  // Find best and worst positions
  const bestPosition = positions.length > 0 
    ? positions.reduce((best, pos) => pos.realizedPnL > best.realizedPnL ? pos : best)
    : undefined;
  const worstPosition = positions.length > 0 
    ? positions.reduce((worst, pos) => pos.realizedPnL < worst.realizedPnL ? pos : worst)
    : undefined;

  // Calculate tooltip positions for best and worst trades
  const getTooltipPosition = (position: ClosedPosition | undefined): { x: number; y: number } | null => {
    if (!position || cumulativeData.length === 0) return null;
    
    const padding = 20;
    const graphWidth = 600 - padding * 2;
    const graphHeight = 240 - padding * 2;
    const minPnL = Math.min(...cumulativeData.map(d => d.cumulativePnL), 0);
    const maxPnL = Math.max(...cumulativeData.map(d => d.cumulativePnL), 0);
    const range = maxPnL - minPnL || 1;

    // Find the index of this position in cumulativeData
    const index = cumulativeData.findIndex(point => point.position === position);
    if (index === -1) return null;

    const point = cumulativeData[index];
    const x = padding + (index / (cumulativeData.length - 1)) * graphWidth;
    const normalizedPnL = (point.cumulativePnL - minPnL) / range;
    const y = padding + graphHeight - (normalizedPnL * graphHeight);

    return { x, y };
  };

  const bestTooltipPos = getTooltipPosition(bestPosition);
  const worstTooltipPos = getTooltipPosition(worstPosition);

  // Calculate YES/NO stats
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

  // Draw graph when component mounts or data changes
  useEffect(() => {
    if (canvasRef.current && cumulativeData.length > 0) {
      const canvas = canvasRef.current;
      drawLineGraph(canvas, cumulativeData, 600, 240, bestPosition, worstPosition);
    }
  }, [cumulativeData, bestPosition, worstPosition]);


  // Debug: log when customBackground changes
  useEffect(() => {
    if (customBackground) {
      console.log('[ShareCardSummary] Custom background set:', customBackground.substring(0, 50) + '...');
    }
  }, [customBackground]);

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
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Semi-transparent overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 15, 20, 0.5)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Top Section: Profile Card (Left) + Branding (Right) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: `${SAFE_PAD}px`,
          paddingBottom: '8px',
          flexShrink: 0,
          height: '120px', // Fixed height: 80px profile + 8px gap + 24px username + padding
        }}
      >
        {/* Profile Card - Left */}
        <div
          style={{
            backgroundColor: 'rgba(18, 26, 36, 0.8)',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '11px',
            width: '180px',
          }}
        >
          {profileImage ? (
            <img
              src={profileImage.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(profileImage)}` : profileImage}
              alt={username || 'Profile'}
              style={{
                width: '126px',
                height: '126px',
                borderRadius: '6px',
                objectFit: 'cover',
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <div
              style={{
                width: '126px',
                height: '126px',
                borderRadius: '6px',
                backgroundColor: '#2E5CFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '50px',
                fontWeight: '600',
              }}
            >
              {(username || wallet) ? (username || wallet || '').charAt(0).toUpperCase() : '?'}
            </div>
          )}
          <div style={{ fontSize: '22px', fontWeight: '600', color: '#E6EDF6', textAlign: 'center' }}>
            {username || (wallet && wallet.length > 10 
              ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
              : wallet || 'User')
            }
          </div>
        </div>

        {/* Branding - Right */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            textAlign: 'right',
            fontSize: '11px',
            color: '#E6EDF6',
            fontWeight: '600',
          }}
        >
          <div>Get your own PnL at polypnl.hanyon.app</div>
          <div>Follow us on X @jayowtrades</div>
        </div>
      </div>

      {/* Main Graph Area with Stat Cards */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          margin: `0 ${SAFE_PAD}px`,
          marginBottom: '8px',
          paddingBottom: '0px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flex: 1,
          minHeight: 0,
          justifyContent: 'flex-end',
        }}
      >
        {/* Graph */}
        <div
          style={{
            position: 'relative',
            width: '600px',
            height: '240px',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={240}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          {/* Best Position Tooltip */}
          {bestPosition && bestTooltipPos && (
            <div
              style={{
                position: 'absolute',
                left: `${bestTooltipPos.x + 10}px`,
                top: `${bestTooltipPos.y - 50}px`,
                backgroundColor: 'rgba(18, 26, 36, 0.4)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 1000,
                pointerEvents: 'none',
                maxWidth: '250px',
              }}
            >
              <div style={{ fontSize: '9.6px', fontWeight: '600', color: '#8B949E' }}>
                Best trade
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {bestPosition.icon && (
                  <img
                    src={bestPosition.icon.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(bestPosition.icon)}` : bestPosition.icon}
                    alt={bestPosition.marketTitle || 'Market'}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      objectFit: 'cover',
                    }}
                    crossOrigin="anonymous"
                  />
                )}
                <div style={{ fontSize: '9.6px', fontWeight: '600', color: '#E6EDF6' }}>
                  {bestPosition.marketTitle || bestPosition.eventTitle || 'Market'}
                </div>
              </div>
            </div>
          )}
          {/* Worst Position Tooltip */}
          {worstPosition && worstTooltipPos && (
            <div
              style={{
                position: 'absolute',
                left: `${worstTooltipPos.x + 10}px`,
                top: `${worstTooltipPos.y + 10}px`,
                backgroundColor: 'rgba(18, 26, 36, 0.4)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 1000,
                pointerEvents: 'none',
                maxWidth: '250px',
              }}
            >
              <div style={{ fontSize: '9.6px', fontWeight: '600', color: '#8B949E' }}>
                Worst trade
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {worstPosition.icon && (
                  <img
                    src={worstPosition.icon.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(worstPosition.icon)}` : worstPosition.icon}
                    alt={worstPosition.marketTitle || 'Market'}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      objectFit: 'cover',
                    }}
                    crossOrigin="anonymous"
                  />
                )}
                <div style={{ fontSize: '9.6px', fontWeight: '600', color: '#E6EDF6' }}>
                  {worstPosition.marketTitle || worstPosition.eventTitle || 'Market'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Four Stat Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '6px',
            flexShrink: 0,
          }}
        >
        {/* Card 1: Total Realized PnL */}
        <div style={{
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '11px', color: '#FFFFFF', marginBottom: '4px', textAlign: 'center' }}>
            Total Realized PnL
          </div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold',
            color: summary.totalRealizedPnL >= 0 ? '#00D26A' : '#FF4444',
            lineHeight: '1',
            textAlign: 'center',
          }}>
            ${formatNumber(summary.totalRealizedPnL)}
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '2px 0px',
            fontSize: '10.8px',
            color: '#8B949E',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'stretch',
          }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Avg PnL:</div>
                <div style={{ color: summary.avgPnLPerPosition >= 0 ? '#00D26A' : '#FF4444', fontWeight: '600', textAlign: 'center' }}>
                  ${formatNumber(summary.avgPnLPerPosition)}
                </div>
              </div>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Avg Size:</div>
                <div style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>{formatNumber(summary.avgPosSize, 1)}</div>
              </div>
            </div>
            {/* Divider Line */}
            <div style={{
              width: '1px',
              height: '60%',
              backgroundColor: 'rgba(230, 237, 246, 0.2)',
              alignSelf: 'center',
            }} />
            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Big Win:</div>
                <div style={{ color: '#00D26A', fontWeight: '600', textAlign: 'center' }}>${formatNumber(summary.biggestWin)}</div>
              </div>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Big Loss:</div>
                <div style={{ color: '#FF4444', fontWeight: '600', textAlign: 'center' }}>${formatNumber(summary.biggestLoss)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Win Rate */}
        <div style={{
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '11px', color: '#FFFFFF', marginBottom: '4px', textAlign: 'center' }}>
            Win Rate
          </div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold',
            color: '#00D26A',
            lineHeight: '1',
            textAlign: 'center',
          }}>
            {summary.winrate.toFixed(1)}%
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '2px 0px',
            fontSize: '10.8px',
            color: '#8B949E',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'stretch',
          }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Positions:</div>
                <div style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>{summary.totalPositionsClosed}</div>
              </div>
            </div>
            {/* Divider Line */}
            <div style={{
              width: '1px',
              height: '60%',
              backgroundColor: 'rgba(230, 237, 246, 0.2)',
              alignSelf: 'center',
            }} />
            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Top Tags:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                  {topTags.slice(0, 3).map((tag, idx) => (
                    <div key={idx} style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>
                      {tag}
                    </div>
                  ))}
                  {topTags.length === 0 && (
                    <div style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>-</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: YES Realized PnL */}
        <div style={{
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '11px', color: '#FFFFFF', marginBottom: '4px', textAlign: 'center' }}>
            YES Realized PnL
          </div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold',
            color: '#00D26A',
            lineHeight: '1',
            textAlign: 'center',
          }}>
            ${formatNumber(yesPnL)}
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '2px 0px',
            fontSize: '10.8px',
            color: '#8B949E',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'stretch',
          }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>WR:</div>
                <div style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>{yesWinRate.toFixed(1)}%</div>
              </div>
            </div>
            {/* Divider Line */}
            <div style={{
              width: '1px',
              height: '60%',
              backgroundColor: 'rgba(230, 237, 246, 0.2)',
              alignSelf: 'center',
            }} />
            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Count:</div>
                <div style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>{yesCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: NO Realized PnL */}
        <div style={{
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '11px', color: '#FFFFFF', marginBottom: '4px', textAlign: 'center' }}>
            NO Realized PnL
          </div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold',
            color: '#00D26A',
            lineHeight: '1',
            textAlign: 'center',
          }}>
            ${formatNumber(noPnL)}
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '2px 0px',
            fontSize: '10.8px',
            color: '#8B949E',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'stretch',
          }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>WR:</div>
                <div style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>{noWinRate.toFixed(1)}%</div>
              </div>
            </div>
            {/* Divider Line */}
            <div style={{
              width: '1px',
              height: '60%',
              backgroundColor: 'rgba(230, 237, 246, 0.2)',
              alignSelf: 'center',
            }} />
            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8B949E', marginBottom: '2px', textAlign: 'center' }}>Count:</div>
                <div style={{ color: '#E6EDF6', fontWeight: '600', textAlign: 'center' }}>{noCount}</div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
