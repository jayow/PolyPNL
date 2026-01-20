'use client';

import { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ClosedPosition } from '@/types';

interface PnLGraphProps {
  positions: ClosedPosition[];
}

function formatNumber(num: number, decimals: number = 0): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(decimals)}m`;
  } else if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(decimals)}k`;
  } else {
    return `${sign}${absNum.toFixed(decimals)}`;
  }
}

export default function PnLGraph({ positions }: PnLGraphProps) {
  // Prevent SSR hydration mismatch with recharts
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate cumulative PnL over time - group by date and aggregate
  const data = useMemo(() => {
    if (positions.length === 0) return [];

    // Group positions by date (YYYY-MM-DD)
    const positionsByDate = new Map<string, ClosedPosition[]>();
    
    for (const pos of positions) {
      const closeDate = pos.closedAt ? new Date(pos.closedAt) : new Date(pos.openedAt);
      const dateKey = closeDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!positionsByDate.has(dateKey)) {
        positionsByDate.set(dateKey, []);
      }
      positionsByDate.get(dateKey)!.push(pos);
    }

    // Sort dates chronologically
    const sortedDates = Array.from(positionsByDate.keys()).sort();

    // Calculate cumulative PnL and build chart data
    let cumulativePnL = 0;
    const chartData: Array<{ 
      date: string; 
      dateKey: string; // YYYY-MM-DD for grouping
      pnl: number; 
      cumulativePnL: number; 
      isPositive: boolean;
      positions: ClosedPosition[]; // All positions for this date
    }> = [];

    for (const dateKey of sortedDates) {
      const dayPositions = positionsByDate.get(dateKey)!;
      const totalPnL = dayPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
      
      // Get first position's date for display
      const firstPos = dayPositions[0];
      const closeDate = firstPos.closedAt ? new Date(firstPos.closedAt) : new Date(firstPos.openedAt);
      const dateStr = closeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      cumulativePnL += totalPnL;
      const isPositive = cumulativePnL >= 0;
      
      chartData.push({
        date: dateStr,
        dateKey,
        pnl: totalPnL,
        cumulativePnL: cumulativePnL,
        isPositive,
        positions: dayPositions,
      });
    }

    return chartData;
  }, [positions]);

  if (!isMounted) {
    return (
      <div className="bg-hyper-panel border border-hyper-border rounded p-4 h-64 flex items-center justify-center">
        <div className="text-xs text-hyper-textSecondary text-center">
          Loading...
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-hyper-panel border border-hyper-border rounded p-4 h-64 flex items-center justify-center">
        <div className="text-xs text-hyper-textSecondary text-center">
          No data to display
        </div>
      </div>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const positions: ClosedPosition[] = data.positions || [];
      
      // Separate wins and losses
      const wins = positions.filter(pos => pos.realizedPnL > 0);
      const losses = positions.filter(pos => pos.realizedPnL < 0);
      
      // Sort: wins descending, losses ascending (biggest loss first)
      wins.sort((a, b) => b.realizedPnL - a.realizedPnL);
      losses.sort((a, b) => a.realizedPnL - b.realizedPnL);
      
      // Get top 5 wins and top 5 losses
      const topWins = wins.slice(0, 5);
      const topLosses = losses.slice(0, 5);
      
      return (
        <div className="bg-hyper-panel border border-hyper-border rounded p-2 text-[10px] max-w-[300px] max-h-[400px] overflow-y-auto">
          <div className="text-hyper-textSecondary mb-2 font-medium">{data.date}</div>
          
          {/* Daily PnL */}
          <div className="text-hyper-textPrimary mb-1">
            PnL: <span className={`font-mono-numeric ${data.pnl >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'}`}>
              ${formatNumber(data.pnl)}
            </span>
          </div>
          
          {/* Cumulative PnL */}
          <div className="text-hyper-textPrimary mb-3">
            Cumulative: <span className={`font-mono-numeric ${data.cumulativePnL >= 0 ? 'text-hyper-accent' : 'text-hyper-negative'}`}>
              ${formatNumber(data.cumulativePnL)}
            </span>
          </div>
          
          {/* Top 5 Wins */}
          {topWins.length > 0 && (
            <div className="mb-2">
              <div className="text-hyper-textSecondary mb-1 text-[9px] font-medium">Top Wins:</div>
              <div className="space-y-0.5">
                {topWins.map((pos, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-2">
                    <div className="text-hyper-textPrimary truncate flex-1" title={pos.marketTitle || pos.eventTitle || 'Unknown'}>
                      {pos.marketTitle || pos.eventTitle || 'Unknown'}
                    </div>
                    <div className="font-mono-numeric text-hyper-accent whitespace-nowrap">
                      ${formatNumber(pos.realizedPnL)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Top 5 Losses */}
          {topLosses.length > 0 && (
            <div>
              <div className="text-hyper-textSecondary mb-1 text-[9px] font-medium">Top Losses:</div>
              <div className="space-y-0.5">
                {topLosses.map((pos, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-2">
                    <div className="text-hyper-textPrimary truncate flex-1" title={pos.marketTitle || pos.eventTitle || 'Unknown'}>
                      {pos.marketTitle || pos.eventTitle || 'Unknown'}
                    </div>
                    <div className="font-mono-numeric text-hyper-negative whitespace-nowrap">
                      ${formatNumber(pos.realizedPnL)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-hyper-panel border border-hyper-border rounded p-3 h-full flex flex-col">
      <div className="text-[10px] text-hyper-textSecondary mb-2 font-medium">
        Cumulative PnL Over Time
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1D2A3A" />
          <XAxis 
            dataKey="date" 
            stroke="#9AA7B2"
            tick={{ fill: '#9AA7B2', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#9AA7B2"
            tick={{ fill: '#9AA7B2', fontSize: 10 }}
            tickFormatter={(value) => formatNumber(value)}
            tick={(props) => {
              const { x, y, payload } = props;
              const isZero = payload.value === 0;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={4}
                    textAnchor="end"
                    fill={isZero ? "#E6EDF6" : "#9AA7B2"}
                    fontSize={isZero ? 11 : 10}
                    fontWeight={isZero ? "bold" : "normal"}
                  >
                    {formatNumber(payload.value)}
                  </text>
                </g>
              );
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Prominent zero reference line */}
          <ReferenceLine 
            y={0} 
            stroke="#9AA7B2" 
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ value: "0", position: "right", fill: "#E6EDF6", fontSize: 11, fontWeight: 'bold' }}
          />
          {/* Single continuous line with accent color */}
          <Line 
            type="monotone" 
            dataKey="cumulativePnL" 
            stroke="#2DD4BF"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: '#2DD4BF' }}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
